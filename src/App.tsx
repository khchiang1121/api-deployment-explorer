import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Copy, Check, Settings, Server, Database, X, Save, RotateCcw, ChevronRight, ChevronDown, MapPin, Globe, Ban, Eye, EyeOff, Layers, Activity, LayoutGrid, Loader2, ExternalLink, Filter } from 'lucide-react';

// --- Interfaces ---

interface Endpoint {
  method: string;
  label: string;
  path: string;
}

interface DeployRules {
  onlyRegions?: string[];
  onlyTypes?: string[];
  excludeRegions?: string[];
  excludeTypes?: string[];
}

interface APIService {
  id: string;
  category: string;
  name: string;
  scope?: 'REGION' | 'CLUSTER'; // New field
  urlKey: string;
  urlOverrides?: Record<string, string>;
  description: string;
  deployRules?: DeployRules | null;
  endpoints: Endpoint[];
  isAvailable?: boolean; // dynamic property
}

interface Environment {
  id: string;
  region: string;
  name: string; // Now acts as Cluster Name (Unique)
  displayName?: string; // New field for UI display (e.g. PRD1)
  type: string;
  rawType: string;
  urlPattern: string;
  regionalUrlPattern?: string; // New field for Regional APIs
  isDeployed?: boolean; // dynamic property
}

// 檢查 API 是否在特定環境可用
const checkApiAvailability = (api: APIService, env: Environment | undefined) => {
  if (!api.deployRules) return true;
  if (!env) return false;

  const { onlyRegions, onlyTypes, excludeRegions, excludeTypes } = api.deployRules;
  if (excludeRegions && excludeRegions.includes(env.region)) return false;
  if (excludeTypes && (excludeTypes.includes(env.rawType) || excludeTypes.includes(env.type))) return false;
  if (onlyRegions && !onlyRegions.includes(env.region)) return false;
  if (onlyTypes && !onlyTypes.includes(env.rawType) && !onlyTypes.includes(env.type)) return false;

  // Regional API implies availability in the region (simplified logic, usually implies it exists)
  // For now, allow deployRules to control it still.
  return true;
};

const resolveUrl = (api: APIService, env: Environment | undefined) => {
  if (!env) return '';
  if (api.urlOverrides && api.urlOverrides[env.id]) {
    return api.urlOverrides[env.id];
  }

  // Regional API Resolution
  if (api.scope === 'REGION') {
    if (env.regionalUrlPattern) {
      let url = env.regionalUrlPattern;
      url = url.replace('{api}', api.urlKey || '');
      url = url.replace('{region}', env.region);
      // Regional URLs should usually NOT contain {type} or {rawType} as they are shared across types
      return url;
    }
    // Fallback? Or return empty?
    // If no regional pattern is defined, we might fall back to standard but that might be wrong.
    // Let's assume for now we fall back to standard but it might be incorrect. 
    // Ideally user provided regionalUrlPattern.
  }

  if (!env.urlPattern) return '';
  let url = env.urlPattern;
  url = url.replace('{api}', api.urlKey || '');
  url = url.replace('{region}', env.region);
  url = url.replace('{type}', env.type);
  url = url.replace('{rawType}', env.rawType);
  return url;
};

// 顏色對應
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-green-100 text-green-700 border-green-200',
  PUT: 'bg-orange-100 text-orange-700 border-orange-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  PATCH: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  DEFAULT: 'bg-slate-100 text-slate-700 border-slate-200'
};

const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
  icon: Icon
}: {
  label: string,
  options: string[],
  selected: string[],
  onChange: (val: string[]) => void,
  icon?: any
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input and reset search when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTimeout(() => setSearchTerm(''), 200);
    }
  }, [isOpen]);

  // Logic Helpers
  const realOptions = useMemo(() => options.filter(o => o !== 'ALL'), [options]);

  const filteredOptions = useMemo(() =>
    realOptions.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase())),
    [realOptions, searchTerm]
  );

  const isOptionSelected = (opt: string) => {
    return selected.includes('ALL') || selected.includes(opt);
  };

  const areAllFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(isOptionSelected);

  // Handlers
  const handleToggleSingle = (option: string) => {
    let newSelection: string[];

    // Expand 'ALL' to real items if needed
    const currentItems = selected.includes('ALL') ? [...realOptions] : [...selected];

    if (currentItems.includes(option)) {
      // Remove
      newSelection = currentItems.filter(item => item !== option);
    } else {
      // Add
      newSelection = [...currentItems, option];
    }

    // Check if we should collapse to ALL
    if (newSelection.length >= realOptions.length) {
      onChange(['ALL']);
    } else {
      onChange(newSelection);
    }
  };

  const handleToggleSelectAll = () => {
    // [Drill-Down UX]
    // If we are searching and currently have 'ALL' selected, 
    // interacting with "Select All Search Results" implies the user wants to narrow down to these results,
    // rather than deselecting them from the global set (which is the standard toggle behavior).
    if (selected.includes('ALL') && searchTerm) {
      if (areAllFilteredSelected) {
        // If they are strictly all filtered selected (and we are in ALL), 
        // normally this would deselect.
        // But here we want to "Isolate".
        // Use Case: User wants to see ONLY these.
        // But what if they check it again? 
        // If they click it when it looks checked (part of ALL), we switch to ONLY these.
        // Wait, if we switch to ONLY these, they remain checked. Visually no change in the dropdown for these items,
        // but HUGE change for the rest (unchecked).
        onChange([...filteredOptions]);
        return;
      }
    }

    // Expand 'ALL' to real items for manipulation
    let currentItems = selected.includes('ALL') ? [...realOptions] : [...selected];

    if (areAllFilteredSelected) {
      // Deselect all filtered items
      currentItems = currentItems.filter(item => !filteredOptions.includes(item));
    } else {
      // Select all filtered items
      const toAdd = filteredOptions.filter(item => !currentItems.includes(item));
      currentItems = [...currentItems, ...toAdd];
    }

    // Check if we should collapse to ALL
    if (currentItems.length >= realOptions.length) {
      onChange(['ALL']);
    } else {
      onChange(currentItems);
    }
  };

  const displayText = selected.includes('ALL')
    ? `所有${label}`
    : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isOpen || !selected.includes('ALL')
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
      >
        {Icon && <Icon size={14} className={!selected.includes('ALL') ? 'text-blue-500' : 'text-slate-400'} />}
        <span>{displayText}</span>
        <ChevronDown size={12} className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden">

          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="搜尋..."
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Select All Option (Contextual) */}
          <button
            onClick={handleToggleSelectAll}
            className={`flex items-center gap-2 px-3 py-2 text-xs w-full text-left transition-colors border-b border-slate-100 ${areAllFilteredSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${areAllFilteredSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
              }`}>
              {areAllFilteredSelected && <Check size={10} className="text-white" />}
            </div>
            <span className="italic">{searchTerm ? `全選搜尋結果 (${filteredOptions.length})` : '全選 (ALL)'}</span>
          </button>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto scrollbar-thin p-1">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">沒有相符的項目</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = isOptionSelected(option);
                return (
                  <button
                    key={option}
                    onClick={() => handleToggleSingle(option)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-md w-full text-left transition-colors ${isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                      }`}>
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    <span className="truncate">{option}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => {
  // --- 狀態 ---
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [apis, setApis] = useState<APIService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'env' (Environment Centric) | 'api' (API Matrix Centric)
  const [viewMode, setViewMode] = useState<'env' | 'api'>('env');

  // Selected States
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [selectedApiId, setSelectedApiId] = useState<string>('');

  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const [searchQuery, setSearchQuery] = useState(''); // Unified search for sidebar
  const [contentSearch, setContentSearch] = useState(''); // Unified search for content area

  const [hideUndeployed, setHideUndeployed] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [configEnvs, setConfigEnvs] = useState('');
  const [configApis, setConfigApis] = useState('');

  // Filters (Multi-select)
  const [regionFilter, setRegionFilter] = useState<string[]>(['ALL']);
  const [nameFilter, setNameFilter] = useState<string[]>(['ALL']);

  // Fetch Config on Mount
  useEffect(() => {
    fetch('./config.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load config');
        return res.json();
      })
      .then(data => {
        setEnvironments(data.envs);
        setApis(data.apis);

        // Set initial selected states
        if (data.envs.length > 0) {
          setSelectedEnvId(data.envs[0].id);
          setExpandedRegions({ [data.envs[0].region]: true });
        }
        if (data.apis.length > 0) {
          setSelectedApiId(data.apis[0].id);
          setExpandedCategories({ [data.apis[0].category]: true });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // --- Derived Options for Filters ---
  const uniqueRegions = useMemo(() =>
    ['ALL', ...new Set(environments.map(e => e.region))].sort(),
    [environments]);

  const uniqueNames = useMemo(() => {
    const filteredEnvs = regionFilter.includes('ALL')
      ? environments
      : environments.filter(e => regionFilter.includes(e.region));

    return ['ALL', ...new Set(filteredEnvs.map(e => e.name))].sort();
  }, [environments, regionFilter]);


  // --- 計算邏輯：環境視角 ---
  const selectedEnv = useMemo(() =>
    environments.find(e => e.id === selectedEnvId) || environments[0],
    [environments, selectedEnvId]);

  const groupedEnvs = useMemo(() => {
    if (viewMode !== 'env') return {};
    const searchLower = searchQuery.toLowerCase();

    // Apply Filters
    const filtered = environments.filter(env => {
      const display = env.displayName || env.name;
      const matchesSearch = env.region.toLowerCase().includes(searchLower) ||
        display.toLowerCase().includes(searchLower) ||
        env.name.toLowerCase().includes(searchLower);

      const matchesRegion = regionFilter.includes('ALL') || regionFilter.includes(env.region);
      const matchesName = nameFilter.includes('ALL') || nameFilter.includes(env.name);

      // console.log(`Env ${env.name}: Search=${matchesSearch}, Region=${matchesRegion}, Name=${matchesName}`);

      return matchesSearch && matchesRegion && matchesName;
    });

    const groups: Record<string, Environment[]> = {};
    filtered.forEach(env => {
      if (!groups[env.region]) groups[env.region] = [];
      groups[env.region].push(env);
    });
    return groups;
  }, [environments, searchQuery, viewMode, regionFilter, nameFilter]);

  const envViewApis = useMemo(() => {
    if (viewMode !== 'env') return {};
    const searchLower = contentSearch.toLowerCase();

    const filtered = apis
      .map(api => ({
        ...api,
        isAvailable: checkApiAvailability(api, selectedEnv)
      }))
      .filter(api => {
        const matchesSearch =
          api.name.toLowerCase().includes(searchLower) ||
          (api.category && api.category.toLowerCase().includes(searchLower)) ||
          api.endpoints.some(ep => ep.path.toLowerCase().includes(searchLower));

        if (hideUndeployed && !api.isAvailable) return false;
        return matchesSearch;
      });

    const groups: Record<string, APIService[]> = {};
    filtered.forEach(api => {
      const cat = api.category || '未分類';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(api);
    });
    return groups;
  }, [apis, contentSearch, selectedEnv, hideUndeployed, viewMode]);


  // --- 計算邏輯：API 全景視角 ---
  const selectedApi = useMemo(() =>
    apis.find(a => a.id === selectedApiId) || apis[0],
    [apis, selectedApiId]);

  const groupedApisForSidebar = useMemo(() => {
    if (viewMode !== 'api') return {};
    const searchLower = searchQuery.toLowerCase();
    const filtered = apis.filter(api =>
      api.name.toLowerCase().includes(searchLower) ||
      api.category.toLowerCase().includes(searchLower)
    );
    const groups: Record<string, APIService[]> = {};
    filtered.forEach(api => {
      const cat = api.category || '未分類';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(api);
    });
    return groups;
  }, [apis, searchQuery, viewMode]);

  const apiMatrixData = useMemo(() => {
    if (viewMode !== 'api') return {};

    // 1. Filter Environments based on Region/Name filters
    const filteredEnvs = environments.filter(env =>
      (regionFilter.includes('ALL') || regionFilter.includes(env.region)) &&
      (nameFilter.includes('ALL') || nameFilter.includes(env.name))
    );

    // Group filtered environments by region to show the matrix
    const groups: Record<string, Environment[]> = {};

    // Sort regions naturally from the filtered set
    const sortedRegions = [...new Set(filteredEnvs.map(e => e.region))].sort();

    sortedRegions.forEach(region => {
      const regionEnvs = filteredEnvs.filter(e => e.region === region);
      // Process each env against selectedApi
      const processedEnvs = regionEnvs.map(env => ({
        ...env,
        isDeployed: checkApiAvailability(selectedApi, env)
      }));

      // Filter if needed (Deployment Status)
      const visibleEnvs = hideUndeployed
        ? processedEnvs.filter(e => e.isDeployed)
        : processedEnvs;

      if (visibleEnvs.length > 0) {
        groups[region] = visibleEnvs;
      }
    });
    return groups;
  }, [environments, selectedApi, hideUndeployed, viewMode, regionFilter, nameFilter]);


  // --- Actions ---
  const copyToClipboard = (text: string | null, key: string) => {
    if (!text) return;
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1000);
    } catch (err) { console.error('Copy failed'); }
    document.body.removeChild(textArea);
  };

  const getEnvColor = (type: string) => {
    const t = (type || '').toUpperCase();
    if (t.includes('PRD')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (t.includes('QA') || t.includes('STG')) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const toggleSidebarGroup = (key: string, type: 'region' | 'cat') => {
    const setter = type === 'region' ? setExpandedRegions : setExpandedCategories;
    setter(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Switch Mode Reset
  useEffect(() => {
    setSearchQuery('');
    setContentSearch('');
  }, [viewMode]);

  const openConfig = () => {
    setConfigEnvs(JSON.stringify(environments, null, 2));
    setConfigApis(JSON.stringify(apis, null, 2));
    setIsConfigOpen(true);
  };

  const saveConfig = () => {
    try {
      const newEnvs = JSON.parse(configEnvs);
      const newApis = JSON.parse(configApis);
      setEnvironments(newEnvs);
      setApis(newApis);
      setIsConfigOpen(false);
    } catch (e) { alert("Format Error"); }
  };

  // We no longer have DEFAULT variables to reset to, so we likely want to re-fetch or just alert.
  // For now, removing reset button or making it reload window would be simplest.
  // Or we can keep the initial data in a ref if we want to "reset to last loaded".
  // Let's change reset to just reload page or re-fetch.
  const resetConfig = () => {
    if (confirm('Reset to initial config? This will reload the page.')) {
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 className="animate-spin text-blue-500" size={48} />
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Ban className="text-red-500" size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Configuration Error</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">

      {/* --- Sidebar --- */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-20">

        {/* View Mode Toggle Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setViewMode('env')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'env' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
              }`}
          >
            <Globe size={16} /> 環境視角
          </button>
          <button
            onClick={() => setViewMode('api')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'api' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
              }`}
          >
            <LayoutGrid size={16} /> API 全景
          </button>
        </div>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={viewMode === 'env' ? "搜尋區域 / 環境..." : "搜尋 API 名稱..."}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Sidebar List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">

          {/* Environment Mode Sidebar List */}
          {viewMode === 'env' && Object.entries(groupedEnvs).map(([regionName, envList]) => {
            const isExpanded = expandedRegions[regionName];
            const isActiveRegion = envList.some(e => e.id === selectedEnvId);
            return (
              <div key={regionName} className="mb-1">
                <button
                  onClick={() => toggleSidebarGroup(regionName, 'region')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${isActiveRegion ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className={isActiveRegion ? 'text-blue-600' : 'text-slate-400'} />
                    <span>{regionName}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-slate-100 mt-1 space-y-1 mb-2">
                    {envList.map(env => (
                      <button
                        key={env.id}
                        onClick={() => setSelectedEnvId(env.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between ${selectedEnvId === env.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <span className="font-medium truncate">{env.displayName || env.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded opacity-90 ${selectedEnvId === env.id ? 'bg-white/20 text-white' : getEnvColor(env.type)}`}>
                          {env.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* API Mode Sidebar List */}
          {viewMode === 'api' && Object.entries(groupedApisForSidebar).map(([catName, apiList]) => {
            const isExpanded = expandedCategories[catName];
            const isActiveCat = apiList.some(a => a.id === selectedApiId);
            return (
              <div key={catName} className="mb-1">
                <button
                  onClick={() => toggleSidebarGroup(catName, 'cat')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${isActiveCat ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers size={16} className={isActiveCat ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="truncate">{catName}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-slate-100 mt-1 space-y-1 mb-2">
                    {apiList.map(api => (
                      <button
                        key={api.id}
                        onClick={() => setSelectedApiId(api.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between group ${selectedApiId === api.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <span className="font-medium truncate">{api.name}</span>
                        {api.deployRules && <span className={`w-2 h-2 rounded-full ${selectedApiId === api.id ? 'bg-blue-300' : 'bg-slate-300'}`} title="有特殊部署規則" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/50">

        {/* Header (Dynamic based on View Mode) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`p-2 rounded-lg shadow-sm text-white ${viewMode === 'env' && selectedEnv?.name.includes('PRD') ? 'bg-slate-800' : 'bg-blue-600'}`}>
              {viewMode === 'env' ? <Server size={20} /> : <Database size={20} />}
            </div>
            <div className="min-w-0">
              {viewMode === 'env' ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
                    <MapPin size={12} /> {selectedEnv?.region} <ChevronRight size={12} />
                    <span className={`px-1.5 rounded text-[10px] font-bold border ${getEnvColor(selectedEnv?.type)}`}>{selectedEnv?.type}</span>
                  </div>
                  <h1 className="text-lg font-bold text-slate-800 truncate">{selectedEnv?.urlPattern} (Template)</h1>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
                    <Layers size={12} /> {selectedApi?.category}
                    {selectedApi?.scope === 'REGION' && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 rounded border border-purple-200">區域性服務</span>}
                    {selectedApi?.deployRules && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded border border-amber-200">特殊部署規則</span>}
                  </div>
                  <h1 className="text-lg font-bold text-slate-800 truncate">{selectedApi?.name} <span className="text-sm font-normal text-slate-400 mx-2">{selectedApi?.description}</span></h1>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* New Filters (Multi-Select) */}
            <div className="flex items-center gap-2 border-r border-slate-200 pr-3 hidden md:flex">
              <MultiSelect
                label="區域"
                options={uniqueRegions}
                selected={regionFilter}
                onChange={setRegionFilter}
                icon={Filter}
              />
              <MultiSelect
                label="Cluster"
                options={uniqueNames}
                selected={nameFilter}
                onChange={setNameFilter}
              />
            </div>
            <button
              onClick={() => setHideUndeployed(!hideUndeployed)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${hideUndeployed ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {hideUndeployed ? <EyeOff size={14} /> : <Eye size={14} />}
              {hideUndeployed ? '隱藏未部署' : '顯示全部'}
            </button>
            {viewMode === 'env' && (
              <div className="relative w-56">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="過濾 API..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none border transition-all"
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                />
              </div>
            )}
            <button onClick={openConfig} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg">
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">

          {/* --- VIEW MODE: ENVIRONMENT (Original Grid) --- */}
          {viewMode === 'env' && (
            <div className="w-full px-6 mx-auto space-y-8 pb-12">
              {Object.entries(envViewApis).map(([category, apiList]) => (
                <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700 mb-4 px-1">
                    <Layers size={20} className="text-blue-500" />
                    {category}
                    <span className="text-xs text-slate-400 bg-white border px-2 rounded-full">{apiList.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                    {apiList.map((api) => {
                      const isAvailable = api.isAvailable;
                      return (
                        <div key={api.id} className={`flex flex-col rounded-xl border shadow-sm transition-all overflow-hidden ${isAvailable ? 'bg-white border-slate-200 hover:shadow-lg hover:border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                          <div className={`p-4 border-b border-slate-100 ${isAvailable ? 'bg-white' : 'bg-slate-100/50'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex flex-col min-w-0 pr-2">
                                <h4 className={`font-bold text-base truncate ${isAvailable ? 'text-slate-800' : 'text-slate-500'}`}>{api.name}</h4>
                                {api.scope === 'REGION' && <span className="text-[9px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 w-fit mt-0.5">區域性</span>}
                              </div>
                              {!isAvailable && <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full flex items-center gap-1 shrink-0"><Ban size={10} /> 未部署</span>}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 h-8">{api.description || '暫無描述'}</p>

                            {/* Base URL Display */}
                            {isAvailable && (
                              <div className="mt-3 flex items-center gap-1.5 p-2 bg-slate-50 rounded md:rounded-lg border border-slate-100 group-hover:border-blue-100 transition-colors">
                                <Globe size={12} className="text-slate-400 shrink-0" />
                                <code className="text-[10px] text-slate-600 font-mono truncate select-all">
                                  {resolveUrl(api, selectedEnv)}
                                </code>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 bg-slate-50/50 p-2 space-y-2">
                            {api.endpoints.map((ep, idx) => {
                              const baseUrl = resolveUrl(api, selectedEnv);
                              const fullUrl = isAvailable ? `${baseUrl}${ep.path}` : null;
                              const uniqueKey = `${selectedEnvId}-${api.id}-${idx}`;
                              const isCopied = copiedKey === uniqueKey;
                              return (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm hover:border-blue-200 group">
                                  <div className="mb-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.DEFAULT}`}>{ep.method}</span>
                                      <span className="text-xs font-semibold text-slate-700 truncate">{ep.label}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono truncate pl-1" title={ep.path}>
                                      {ep.path}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => isAvailable && copyToClipboard(fullUrl, uniqueKey)} disabled={!isAvailable} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border ${!isAvailable ? 'cursor-not-allowed bg-slate-100' : isCopied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                                      {isAvailable && isCopied ? <Check size={12} /> : <Copy size={12} />} {isAvailable ? (isCopied ? '已複製' : '複製') : '不可用'}
                                    </button>
                                    <button onClick={() => isAvailable && fullUrl && window.open(fullUrl, '_blank')} disabled={!isAvailable} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border ${!isAvailable ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'}`}>
                                      <ExternalLink size={12} /> {isAvailable ? '前往' : '不可用'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* --- VIEW MODE: API MATRIX (New Feature) --- */}
          {viewMode === 'api' && (
            <div className="w-full px-6 mx-auto pb-12">
              {/* Endpoints Info Card */}
              <div className="bg-white rounded-xl border border-blue-100 p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
                <h3 className="text-sm font-bold text-slate-600 mr-2">此服務包含端點：</h3>
                {selectedApi?.endpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.DEFAULT}`}>{ep.method}</span>
                    <span className="text-xs font-mono text-slate-600">{ep.path}</span>
                    <span className="text-xs text-slate-400 border-l pl-2 border-slate-200">{ep.label}</span>
                  </div>
                ))}
              </div>

              {/* Matrix Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
                {Object.entries(apiMatrixData).map(([region, envs]) => (
                  <div key={region} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <MapPin size={16} className="text-blue-500" />
                        {region}
                      </div>
                      <span className="text-xs text-slate-400">{envs.length} 環境</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {envs.map(env => {
                        const isDeployed = env.isDeployed;
                        return (
                          <div key={env.id} className={`p-4 flex flex-col gap-3 transition-colors ${isDeployed ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${isDeployed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 rounded border ${getEnvColor(env.type)}`}>{env.type}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{resolveUrl(selectedApi, env)}</div>
                                </div>
                              </div>
                              {!isDeployed && <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded">未部署</span>}
                            </div>

                            {/* Action Buttons for this Env */}
                            {isDeployed && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {selectedApi.endpoints.map((ep, i) => {
                                  const baseUrl = resolveUrl(selectedApi, env);
                                  const fullUrl = `${baseUrl}${ep.path}`;
                                  const uniqueKey = `matrix-${env.id}-${i}`;
                                  const isCopied = copiedKey === uniqueKey;
                                  return (
                                    <button
                                      key={i}
                                      onClick={() => copyToClipboard(fullUrl, uniqueKey)}
                                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${isCopied
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                        }`}
                                      title={`${ep.method} ${ep.path}`}
                                    >
                                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                      <span className="truncate max-w-[80px]">{ep.label}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(apiMatrixData).length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <Activity size={48} className="mx-auto mb-4 opacity-20" />
                  <p>在此條件下找不到任何已部署的環境</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Config Modal (Same as before) */}
        {isConfigOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Settings className="text-blue-600" size={24} /> 資料源設定</h2>
                <button onClick={() => setIsConfigOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600" /></button>
              </div>
              <div className="flex-1 overflow-hidden p-6 grid grid-cols-2 gap-6 bg-slate-50">
                <textarea value={configEnvs} onChange={(e) => setConfigEnvs(e.target.value)} className="flex-1 p-4 font-mono text-xs border border-slate-300 rounded-xl resize-none outline-none" spellCheck="false" placeholder="JSON Environments..." />
                <textarea value={configApis} onChange={(e) => setConfigApis(e.target.value)} className="flex-1 p-4 font-mono text-xs border border-slate-300 rounded-xl resize-none outline-none" spellCheck="false" placeholder="JSON APIs..." />
              </div>
              <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl flex justify-between">
                <button onClick={resetConfig} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"><RotateCcw size={16} /> 重置</button>
                <div className="flex gap-3">
                  <button onClick={() => setIsConfigOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                  <button onClick={saveConfig} className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg"><Save size={18} /> 套用</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;