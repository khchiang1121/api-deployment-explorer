import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Copy, Check, Settings, Server, Database, X, Save, RotateCcw, ChevronRight, ChevronDown, MapPin, Globe, Ban, Eye, EyeOff, Layers, Activity, LayoutGrid, Loader2, ExternalLink, Filter, Globe2, Sun, Moon } from 'lucide-react';

// --- Interfaces ---

interface Endpoint {
  method: string;
  label: string;
  path: string;
}

interface APIUrl {
  label: string;
  url: string;
}

interface DeployRules {
  onlyRegions?: string[];
  onlyTypes?: string[];
  excludeRegions?: string[];
  excludeTypes?: string[];
  onlyClusterTypes?: ('Gen1' | 'Gen2')[];
}

interface APIService {
  id: string;
  category: string;
  name: string;
  scope?: 'REGION' | 'CLUSTER' | 'GLOBAL'; // New field
  urlKey: string;
  urlOverrides?: Record<string, string>;
  description: string;
  deployRules?: DeployRules | null;
  endpoints: Endpoint[];
  urls?: APIUrl[]; // New field for Global APIs (Direct URLs)
  isAvailable?: boolean; // dynamic property
}

interface Environment {
  id: string; // Generated internally: `${region}-${name}`
  region: string;
  name: string; // Cluster Name (e.g. "STG1")
  // displayName?: string;
  type: string;
  urlPattern: string;
  regionalUrlPattern?: string;
  isDeployed?: boolean;
  clusterType?: 'Gen1' | 'Gen2';
}

// 檢查 API 是否在特定環境可用
const checkApiAvailability = (api: APIService, env: Environment | undefined) => {
  if (!env) return false;

  // Global API Logic: ONLY available in "Global" region
  if (api.scope === 'GLOBAL') {
    return env.region === 'Global';
  }

  // Non-Global APIs should NOT appear in "Global" region (Optional, but cleaner)
  if (env.region === 'Global') {
    return false;
  }

  if (!api.deployRules) return true;

  const { onlyRegions, onlyTypes, excludeRegions, excludeTypes, onlyClusterTypes } = api.deployRules;
  if (excludeRegions && excludeRegions.includes(env.region)) return false;
  if (excludeTypes && (excludeTypes.includes(env.name) || excludeTypes.includes(env.type))) return false;
  if (onlyRegions && !onlyRegions.includes(env.region)) return false;
  if (onlyTypes && !onlyTypes.includes(env.name) && !onlyTypes.includes(env.type)) return false;

  // Cluster Type Check (Gen1/Gen2)
  if (onlyClusterTypes) {
    const currentClusterType = env.clusterType || 'Gen1'; // Default to Gen1
    if (!onlyClusterTypes.includes(currentClusterType)) return false;
  }

  // Regional API implies availability in the region (simplified logic, usually implies it exists)
  // For now, allow deployRules to control it still.
  return true;
};

const resolveUrl = (api: APIService, env: Environment | undefined) => {
  if (!env) return '';

  // Use Random ID directly (No attribute dependency)
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
  }

  if (!env.urlPattern) return '';
  let url = env.urlPattern;
  url = url.replace('{api}', api.urlKey || '');
  url = url.replace('{region}', env.region);
  url = url.replace('{type}', env.type);
  url = url.replace('{rawType}', env.name); // Compatibility: {rawType} now maps to name
  return url;
};

// Feature Flags
const ENABLE_HEALTH_CHECK = true; // Toggle Health Check Feature
const CONFIG_FILE_PATH = './config.dev.json';

// 顏色對應
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-green-100 text-green-700 border-green-200',
  PUT: 'bg-orange-100 text-orange-700 border-orange-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  PATCH: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  DEFAULT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
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
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
      >
        {Icon && <Icon size={14} className={!selected.includes('ALL') ? 'text-blue-500' : 'text-slate-400'} />}
        <span>{displayText}</span>
        <ChevronDown size={12} className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden">

          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 dark:bg-gray-900 dark:border-gray-700">
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

  // Health Check State
  const [healthStatus, setHealthStatus] = useState<Record<string, 'online' | 'offline' | 'loading'>>({});
  const healthStatusRef = useRef<Record<string, 'online' | 'offline' | 'loading'>>({});

  // --- Theme Management ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) {
      return localStorage.getItem('theme') as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // --- URL State Management ---
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      view: params.get('view') as 'env' | 'api' | 'global' | null,
      region: params.get('region'),
      cluster: params.get('cluster'), // Mapped to env.name
      api: params.get('api') // Mapped to api.urlKey or api.name
    };
  };

  const updateUrl = (view: string, env?: Environment, api?: APIService) => {
    const params = new URLSearchParams();
    if (view) params.set('view', view);
    if (env) {
      params.set('region', env.region);
      params.set('cluster', env.name);
    }
    if (api) {
      params.set('api', api.urlKey || api.name);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  };

  // View Mode: Initialize from URL or default to 'env'
  const [viewMode, setViewMode] = useState<'env' | 'api' | 'global'>(() => {
    const { view } = getUrlParams();
    return (view === 'env' || view === 'api' || view === 'global') ? view : 'env';
  });

  // Selected States
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  const [selectedApiId, setSelectedApiId] = useState<string>('');

  const [selectedGlobalUrlIndices, setSelectedGlobalUrlIndices] = useState<Record<string, number>>({}); // Map: API ID -> URL Index

  // Sync URL when state changes
  useEffect(() => {
    if (loading) return;
    const currentEnv = environments.find(e => e.id === selectedEnvId);
    const currentApi = apis.find(a => a.id === selectedApiId);
    updateUrl(viewMode, currentEnv, currentApi);
  }, [viewMode, selectedEnvId, selectedApiId, environments, apis, loading]);

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
    fetch(CONFIG_FILE_PATH)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load config');
        return res.json();
      })
      .then(data => {
        // Process Environments: Generate Stable ID based on Region and Name
        const processedEnvs = data.envs.map((env: any) => ({
          ...env,
          id: `${env.region}-${env.name}`, // Stable ID for urlOverrides
          clusterType: env.clusterType || 'Gen1'
        }));
        setEnvironments(processedEnvs);

        // Process APIs to ensure they have IDs
        const processedApis = data.apis.map((api: any, index: number) => ({
          ...api,
          // Use existing ID if present, otherwise generate a random unique ID
          id: api.id || `api-${index}-${Math.random().toString(36).substr(2, 9)}`
        }));

        setApis(processedApis);

        // --- Restore State from URL ---
        const { region, cluster, api: apiKey } = getUrlParams();

        // 1. Restore Environment
        let initialEnvId = '';
        if (region && cluster) {
          const found = processedEnvs.find((e: any) => e.region === region && e.name === cluster);
          if (found) initialEnvId = found.id;
        }
        // Fallback to first if not found or not specified
        if (!initialEnvId && processedEnvs.length > 0) {
          initialEnvId = processedEnvs[0].id;
        }

        if (initialEnvId) {
          setSelectedEnvId(initialEnvId);
          const initEnv = processedEnvs.find((e: any) => e.id === initialEnvId);
          if (initEnv) {
            setExpandedRegions(prev => ({ ...prev, [initEnv.region]: true }));
          }
        }

        // 2. Restore API
        let initialApiId = '';
        if (apiKey) {
          const found = processedApis.find((a: any) => (a.urlKey === apiKey || a.name === apiKey));
          if (found) initialApiId = found.id;
        }
        // Fallback
        if (!initialApiId && processedApis.length > 0) {
          initialApiId = processedApis[0].id;
        }

        if (initialApiId) {
          setSelectedApiId(initialApiId);
          const initApi = processedApis.find((a: any) => a.id === initialApiId);
          if (initApi) {
            setExpandedCategories(prev => ({ ...prev, [initApi.category]: true }));
          }
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

      // Hide Global Region in 'env' view
      if (env.region === 'Global') return false;

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

        // Hide Global APIs in 'env' view
        if (api.scope === 'GLOBAL') return false;

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


  // --- Health Check Logic ---
  const checkHealth = async (url: string) => {
    if (!ENABLE_HEALTH_CHECK) return;
    if (healthStatus[url] === 'online') return; // Don't re-check if already compatible? Or maybe we should? Let's skip for now to avoid spam.

    setHealthStatus(prev => ({ ...prev, [url]: 'loading' }));
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      // Try no-cors to avoid CORS errors when checking availability
      await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });

      clearTimeout(timeoutId);
      setHealthStatus(prev => ({ ...prev, [url]: 'online' }));
    } catch (err) {
      console.warn(`Health check failed for ${url}`, err);
      setHealthStatus(prev => ({ ...prev, [url]: 'offline' }));
    }
  };

  // Trigger Health Check when Environment View list changes
  // Trigger Health Check when Environment View list changes
  useEffect(() => {
    if (!ENABLE_HEALTH_CHECK || viewMode !== 'env' || !selectedEnv) return;

    Object.values(envViewApis).flat().forEach(api => {
      if (api.isAvailable) {
        const url = resolveUrl(api, selectedEnv);
        if (url) {
          checkHealth(url);
        }
      }
    });
  }, [envViewApis, viewMode, selectedEnv]); // Removed healthStatus to avoid infinite loop


  // --- 計算邏輯：API 全景視角 ---
  const selectedApi = useMemo(() => {
    // If in Global mode, allow null (for "Show All" view)
    if (viewMode === 'global') {
      const globalApis = apis.filter(a => a.scope === 'GLOBAL');
      if (selectedApiId === '') return null; // "Show All" selected
      const current = globalApis.find(a => a.id === selectedApiId);
      return current || null;
    }
    // If in API mode, ensure selected API is NOT Global (or at least valid)
    const normalApis = apis.filter(a => a.scope !== 'GLOBAL');
    const current = normalApis.find(a => a.id === selectedApiId);
    return current || normalApis[0] || apis[0];
  }, [apis, selectedApiId, viewMode]);

  const groupedApisForSidebar = useMemo(() => {
    if (viewMode !== 'api') return {};
    const searchLower = searchQuery.toLowerCase();
    const filtered = apis.filter(api =>
      (api.name.toLowerCase().includes(searchLower) ||
        api.category.toLowerCase().includes(searchLower)) &&
      api.scope !== 'GLOBAL' // Hide Global APIs in 'api' view
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

  // Switch Mode Handler
  useEffect(() => {
    setSearchQuery('');
    setContentSearch('');

    // Auto-select first item when switching modes
    if (viewMode === 'global') {
      setSelectedApiId(''); // Default to "Show All"
    } else if (viewMode === 'api') {
      const firstNormal = apis.find(a => a.scope !== 'GLOBAL');
      if (firstNormal) setSelectedApiId(firstNormal.id);
    }
    // Reset global url index logic if needed, or just keep them
  }, [viewMode, apis]);

  const getGlobalUrlIndex = (apiId: string) => selectedGlobalUrlIndices[apiId] || 0;
  const setGlobalUrlIndex = (apiId: string, idx: number) => {
    setSelectedGlobalUrlIndices(prev => ({ ...prev, [apiId]: idx }));
  };

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
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden dark:bg-gray-950 dark:text-gray-100 transition-colors duration-200">

      {/* --- Sidebar --- */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-20 dark:bg-gray-900 dark:border-gray-800 transition-colors">

        {/* View Mode Toggle Tabs */}
        <div className="flex border-b border-slate-200 dark:border-gray-800">
          <button
            onClick={() => setViewMode('env')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'env' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500' : 'text-slate-500 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
              }`}
          >
            <Globe size={16} /> 環境視角
          </button>
          <button
            onClick={() => setViewMode('api')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'api' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500' : 'text-slate-500 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
              }`}
          >
            <LayoutGrid size={16} /> API 全景
          </button>
          <button
            onClick={() => setViewMode('global')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${viewMode === 'global' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500' : 'text-slate-500 hover:bg-slate-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
              }`}
          >
            <Globe2 size={16} /> 全域服務
          </button>
        </div>

        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0 dark:bg-gray-900 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={viewMode === 'env' ? "搜尋區域 / 環境..." : "搜尋 API 名稱..."}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Sidebar List */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin dark:scrollbar-thumb-gray-700 dark:scrollbar-track-gray-800">

          {/* Global Mode Sidebar List */}
          {viewMode === 'global' && (
            <div className="space-y-1">
              <button
                onClick={() => setSelectedApiId('')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-3 ${selectedApiId === ''
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
              >
                <LayoutGrid size={18} />
                <span>所有全域服務</span>
              </button>
              <div className="h-px bg-slate-200 my-2 mx-1 dark:bg-gray-700" />
              {apis.filter(api => api.scope === 'GLOBAL' && api.name.toLowerCase().includes(searchQuery.toLowerCase())).map(api => (
                <button
                  key={api.id}
                  onClick={() => setSelectedApiId(api.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between group ${selectedApiId === api.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'}`}
                >
                  <span className="font-medium truncate">{api.name}</span>
                </button>
              ))}
              {apis.filter(api => api.scope === 'GLOBAL' && api.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs dark:text-gray-500">
                  沒有全域服務
                </div>
              )}
            </div>
          )}

          {/* Environment Mode Sidebar List */}
          {viewMode === 'env' && Object.entries(groupedEnvs).map(([regionName, envList]) => {
            const isExpanded = expandedRegions[regionName];
            const isActiveRegion = envList.some(e => e.id === selectedEnvId);
            return (
              <div key={regionName} className="mb-1">
                <button
                  onClick={() => toggleSidebarGroup(regionName, 'region')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${isActiveRegion ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className={isActiveRegion ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                    <span>{regionName}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-slate-100 mt-1 space-y-1 mb-2 dark:border-gray-700">
                    {envList.map(env => (
                      <button
                        key={env.id}
                        onClick={() => setSelectedEnvId(env.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between ${selectedEnvId === env.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'}`}
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
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-semibold transition-all ${isActiveCat ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers size={16} className={isActiveCat ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                    <span className="truncate">{catName}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="ml-4 pl-3 border-l-2 border-slate-100 mt-1 space-y-1 mb-2 dark:border-gray-700">
                    {apiList.map(api => (
                      <button
                        key={api.id}
                        onClick={() => setSelectedApiId(api.id)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center justify-between ${selectedApiId === api.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'}`}
                      >
                        <span className="font-medium truncate">{api.name}</span>
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
      <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-gray-950/50">

        {/* Header (Dynamic based on View Mode) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm shrink-0 z-10 dark:bg-gray-900 dark:border-gray-800 transition-colors">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`p-2 rounded-lg shadow-sm text-white ${viewMode === 'env' && selectedEnv?.name.includes('PRD') ? 'bg-slate-800' : 'bg-blue-600'}`}>
              {viewMode === 'env' ? <Server size={20} /> : viewMode === 'global' ? <Globe2 size={20} /> : <Database size={20} />}
            </div>
            <div className="min-w-0">
              {viewMode === 'global' ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
                    <Globe2 size={12} /> 全域服務
                  </div>
                  <h1 className="text-lg font-bold text-slate-800 truncate dark:text-gray-100">
                    {selectedApi ? selectedApi.name : '所有全域服務'}
                    {selectedApi && <span className="text-sm font-normal text-slate-400 mx-2 dark:text-gray-400">{selectedApi.description}</span>}
                  </h1>
                </>
              ) : viewMode === 'env' ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
                    <MapPin size={12} /> {selectedEnv?.region} <ChevronRight size={12} />
                    <span className={`px-1.5 rounded text-[10px] font-bold border ${getEnvColor(selectedEnv?.type)}`}>{selectedEnv?.type}</span>
                    {selectedEnv?.clusterType && (
                      <span className={`px-1.5 rounded text-[10px] font-bold border ${selectedEnv.clusterType === 'Gen2' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                        {selectedEnv.clusterType}
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold text-slate-800 truncate dark:text-gray-100">{selectedEnv?.urlPattern}</h1>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
                    <Layers size={12} /> {selectedApi?.category}
                    {selectedApi?.scope === 'REGION' && <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 rounded border border-purple-200">區域性服務</span>}
                    {selectedApi?.scope === 'GLOBAL' && <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 rounded border border-indigo-200">全域服務</span>}
                    {selectedApi?.deployRules && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded border border-amber-200">特殊部署規則</span>}
                  </div>
                  <h1 className="text-lg font-bold text-slate-800 truncate dark:text-gray-100">{selectedApi?.name} <span className="text-sm font-normal text-slate-400 mx-2 dark:text-gray-400">{selectedApi?.description}</span></h1>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${hideUndeployed ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'}`}
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
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-gray-800 border-transparent rounded-lg text-sm focus:bg-white dark:focus:bg-gray-700 focus:border-blue-500 outline-none border transition-all dark:text-gray-100 dark:placeholder-gray-500"
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                />
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-500 dark:text-gray-400 transition-colors"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={openConfig} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800">
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
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700 mb-4 px-1 dark:text-slate-300">
                    <Layers size={20} className="text-blue-500" />
                    {category}
                    <span className="text-xs text-slate-400 bg-white border px-2 rounded-full dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400">{apiList.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                    {apiList.map((api) => {
                      const isAvailable = api.isAvailable;
                      return (
                        <div key={api.id} className={`flex flex-col rounded-xl border shadow-sm transition-all overflow-hidden ${isAvailable ? 'bg-white border-slate-200 hover:shadow-lg hover:border-blue-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-500/50' : 'bg-slate-50 border-slate-200 opacity-60 dark:bg-slate-800/50 dark:border-slate-700'}`}>
                          <div className={`p-4 border-b border-slate-100 ${isAvailable ? 'bg-white dark:bg-slate-800' : 'bg-slate-100/50 dark:bg-slate-800/50'} dark:border-slate-700`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex flex-col min-w-0 pr-2">
                                <h4 className={`font-bold text-base truncate ${isAvailable ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-500'}`}>{api.name}</h4>
                                {api.scope === 'REGION' && <span className="text-[9px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 w-fit mt-0.5 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700">區域性</span>}
                                {api.scope === 'GLOBAL' && <span className="text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 w-fit mt-0.5 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700">全域</span>}
                              </div>
                              {!isAvailable && <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full flex items-center gap-1 shrink-0 dark:bg-slate-700 dark:text-slate-400"><Ban size={10} /> 未部署</span>}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 h-8 dark:text-slate-400">{api.description || '暫無描述'}</p>

                            {/* Base URL Display */}
                            {isAvailable && (
                              <div className="mt-3 flex items-center gap-1.5 p-2 bg-slate-50 rounded md:rounded-lg border border-slate-100 group-hover:border-blue-100 transition-colors dark:bg-slate-900 dark:border-slate-700">
                                <Globe size={12} className="text-slate-400 shrink-0" />
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  {ENABLE_HEALTH_CHECK && (
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${healthStatus[resolveUrl(api, selectedEnv)] === 'online' ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.4)]' :
                                        healthStatus[resolveUrl(api, selectedEnv)] === 'loading' ? 'bg-slate-300 animate-pulse' :
                                          'bg-red-500'
                                        }`}
                                      title={healthStatus[resolveUrl(api, selectedEnv)] || 'Unknown'}
                                    />
                                  )}
                                  <code className="text-[10px] text-slate-600 font-mono truncate select-all dark:text-slate-300">
                                    {resolveUrl(api, selectedEnv)}
                                  </code>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 bg-slate-50/50 p-2 space-y-2 dark:bg-slate-800/50">
                            {api.endpoints.map((ep, idx) => {
                              const baseUrl = resolveUrl(api, selectedEnv);
                              const fullUrl = isAvailable ? `${baseUrl}${ep.path}` : null;
                              const uniqueKey = `${selectedEnvId}-${api.id}-${idx}`;
                              const isCopied = copiedKey === uniqueKey;
                              return (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm hover:border-blue-200 group dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-500/30">
                                  <div className="mb-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.DEFAULT}`}>{ep.method}</span>
                                      <span className="text-xs font-semibold text-slate-700 truncate dark:text-slate-200">{ep.label}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono truncate pl-1 dark:text-slate-400" title={ep.path}>
                                      {ep.path}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => isAvailable && copyToClipboard(fullUrl, uniqueKey)} disabled={!isAvailable} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border transition-colors ${!isAvailable ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-700 dark:border-slate-600' : isCopied ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-white hover:bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 dark:text-slate-300'}`}>
                                      {isAvailable && isCopied ? <Check size={12} /> : <Copy size={12} />} {isAvailable ? (isCopied ? '已複製' : '複製') : '不可用'}
                                    </button>
                                    <button onClick={() => isAvailable && fullUrl && window.open(fullUrl, '_blank')} disabled={!isAvailable} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border transition-colors ${!isAvailable ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 dark:border-slate-600' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600 dark:text-slate-300'}`}>
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
              <div className="bg-white rounded-xl border border-blue-100 p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center dark:bg-gray-900 dark:border-blue-900/30">
                <h3 className="text-sm font-bold text-slate-600 mr-2 dark:text-gray-300">此服務包含端點：</h3>
                {selectedApi?.endpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg dark:bg-gray-800 dark:border-gray-700">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.DEFAULT}`}>{ep.method}</span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{ep.path}</span>
                    <span className="text-xs text-slate-400 border-l pl-2 border-slate-200 dark:border-slate-700">{ep.label}</span>
                  </div>
                ))}
              </div>

              {/* Matrix Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
                {Object.entries(apiMatrixData).map(([region, envs]) => (
                  <div key={region} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 dark:bg-gray-900 dark:border-gray-800">
                    <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center dark:bg-gray-800 dark:border-gray-700">
                      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-gray-200">
                        <MapPin size={16} className="text-blue-500" />
                        {region}
                      </div>
                      <span className="text-xs text-slate-400">{envs.length} 環境</span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-gray-800">
                      {envs.map(env => {
                        const isDeployed = env.isDeployed;
                        return (
                          <div key={env.id} className={`p-4 flex flex-col gap-3 transition-colors ${isDeployed ? 'bg-white hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-800/50' : 'bg-slate-50/50 dark:bg-gray-900/50'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${isDeployed ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300'}`} />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-1.5 rounded border ${getEnvColor(env.type)}`}>{env.type}</span>
                                    {env.clusterType && (
                                      <span className={`text-[10px] px-1.5 rounded border ${env.clusterType === 'Gen2' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                        {env.clusterType}
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-slate-700 dark:text-gray-200">{env.name}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5 dark:text-gray-500">{resolveUrl(selectedApi, env)}</div>
                                </div>
                              </div>
                              {!isDeployed && <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded dark:bg-gray-800 dark:text-gray-500">未部署</span>}
                            </div>

                            {/* Action Buttons for this Env */}
                            {isDeployed && (
                              <div className="grid grid-cols-2 gap-3">
                                {selectedApi.endpoints.map((ep, i) => {
                                  const baseUrl = resolveUrl(selectedApi, env);
                                  const fullUrl = `${baseUrl}${ep.path}`;
                                  const uniqueKey = `matrix-${env.id}-${i}`;
                                  const isCopied = copiedKey === uniqueKey;
                                  return (
                                    <div key={i} className="group flex items-stretch bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all overflow-hidden h-full dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-500/50">
                                      {/* Primary: Open */}
                                      <a
                                        href={fullUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors truncate dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                                        title={`Open: ${fullUrl}`}
                                      >
                                        <ExternalLink size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                                        <span className="truncate">{ep.label}</span>
                                      </a>

                                      {/* Divider */}
                                      <div className="w-[1px] my-1.5 bg-slate-100 group-hover:bg-slate-200 dark:bg-gray-700" />

                                      {/* Secondary: Copy */}
                                      <button
                                        onClick={() => copyToClipboard(fullUrl, uniqueKey)}
                                        className={`px-3 flex items-center justify-center transition-colors focus:outline-none ${isCopied
                                          ? 'bg-green-50 text-green-600'
                                          : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'
                                          }`}
                                        title="Copy URL"
                                      >
                                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                      </button>
                                    </div>
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

          {/* --- VIEW MODE: GLOBAL --- */}

          {viewMode === 'global' && (
            <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200 pb-12">
              {(() => {
                // Determine which APIs to show: Single Selected or All Global
                const apisToShow = selectedApi
                  ? [selectedApi]
                  : apis.filter(a => a.scope === 'GLOBAL' && a.name.toLowerCase().includes(searchQuery.toLowerCase()));

                if (apisToShow.length === 0) {
                  return (
                    <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-500">
                      <p>未設定全域服務</p>
                    </div>
                  );
                }

                return apisToShow.map(api => {
                  const activeUrlIdx = getGlobalUrlIndex(api.id);

                  return (
                    <div key={api.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500 dark:bg-slate-800 dark:border-slate-700">
                      <div className="bg-slate-50 border-b border-slate-100 p-4 dark:bg-slate-800 dark:border-slate-700">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-slate-100">
                          <Globe2 className="text-blue-500" size={20} />
                          {api.name}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">{api.description}</p>
                      </div>

                      {api.urls && api.urls.length > 0 ? (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {api.urls.map((urlItem, urlIdx) => (
                            <div key={urlIdx} className="bg-slate-50 rounded-lg border border-slate-200 p-3 h-full hover:border-blue-300 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:hover:border-blue-500/50">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <div>
                                  <span className="text-xs font-bold text-slate-700 block dark:text-slate-200">{urlItem.label}</span>
                                  <span className="text-[10px] text-slate-400 block -mt-0.5 truncate dark:text-slate-500" title={urlItem.url}>{urlItem.url}</span>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {api.endpoints.map((ep, epIdx) => {
                                  const fullUrl = urlItem.url ? `${urlItem.url}${ep.path}` : null;
                                  const uniqueKey = `${api.id}-${urlIdx}-${epIdx}`;
                                  const isCopied = copiedKey === uniqueKey;

                                  return (
                                    <div key={epIdx} className="group flex items-stretch bg-white border border-slate-200 rounded-md hover:border-blue-400 hover:shadow-sm transition-all overflow-hidden dark:bg-slate-800 dark:border-slate-700 dark:hover:border-blue-500/50">
                                      {/* Primary: Open */}
                                      {fullUrl ? (
                                        <a
                                          href={fullUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors truncate dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                                          title={`Open: ${fullUrl}`}
                                        >
                                          <ExternalLink size={12} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                                          <span className="truncate">{ep.label}</span>
                                        </a>
                                      ) : (
                                        <div className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed">
                                          <ExternalLink size={12} className="text-slate-300" />
                                          <span className="truncate">{ep.label}</span>
                                        </div>
                                      )}

                                      {/* Divider */}
                                      <div className="w-[1px] my-1 bg-slate-100 group-hover:bg-slate-200" />

                                      {/* Secondary: Copy */}
                                      <button
                                        onClick={() => fullUrl && copyToClipboard(fullUrl, uniqueKey)}
                                        disabled={!fullUrl}
                                        className={`px-2 flex items-center justify-center transition-colors focus:outline-none ${!fullUrl ? 'cursor-not-allowed text-slate-300' : isCopied
                                          ? 'bg-green-50 text-green-600'
                                          : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'
                                          }`}
                                        title={fullUrl ? "Copy URL" : "No URL"}
                                      >
                                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-400 italic">
                          未設定任何環境連結
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}

        </div >


        {isConfigOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col dark:bg-slate-800 dark:border dark:border-slate-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 dark:text-slate-100"><Settings className="text-blue-600" size={24} /> 資料源設定</h2>
                <button onClick={() => setIsConfigOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" /></button>
              </div>
              <div className="flex-1 overflow-hidden p-6 grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/50">
                <textarea value={configEnvs} onChange={(e) => setConfigEnvs(e.target.value)} className="flex-1 p-4 font-mono text-xs border border-slate-300 rounded-xl resize-none outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300" spellCheck="false" placeholder="JSON Environments..." />
                <textarea value={configApis} onChange={(e) => setConfigApis(e.target.value)} className="flex-1 p-4 font-mono text-xs border border-slate-300 rounded-xl resize-none outline-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300" spellCheck="false" placeholder="JSON APIs..." />
              </div>
              <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl flex justify-between dark:bg-slate-800 dark:border-slate-700">
                <button onClick={resetConfig} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20"><RotateCcw size={16} /> 重置</button>
                <div className="flex gap-3">
                  <button onClick={() => setIsConfigOpen(false)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg dark:text-slate-300 dark:hover:bg-slate-700">取消</button>
                  <button onClick={saveConfig} className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg"><Save size={18} /> 套用</button>
                </div>
              </div>
            </div>
          </div>
        )
        }
      </div >
    </div >
  );
};

export default App;