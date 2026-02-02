import React, { useState, useMemo, useEffect } from 'react';
import { Search, ExternalLink, Copy, Check, Settings, Server, Database, X, Save, RotateCcw, ChevronRight, ChevronDown, MapPin, Globe, Ban, Eye, EyeOff, Layers, Activity, LayoutGrid, List } from 'lucide-react';

// --- 預設資料生成邏輯 (保持不變) ---

const DEFAULT_APIS = [
  {
    id: 'api-1',
    category: '會員核心 (Member)',
    name: 'User Service',
    description: '處理使用者登入、註冊與基本資料',
    deployRules: null,
    endpoints: [
      { method: 'POST', label: '使用者登入', path: '/api/v1/auth/login' },
      { method: 'POST', label: '註冊新用戶', path: '/api/v1/auth/register' },
      { method: 'GET', label: '取得個資', path: '/api/v1/users/me' }
    ]
  },
  {
    id: 'api-2',
    category: '會員核心 (Member)',
    name: 'Profile Service',
    description: '使用者詳細檔案與偏好設定',
    endpoints: [
      { method: 'GET', label: '偏好設定', path: '/api/v1/profile/preferences' },
      { method: 'PUT', label: '更新頭像', path: '/api/v1/profile/avatar' }
    ]
  },
  {
    id: 'api-3',
    category: '訂單交易 (Order)',
    name: 'Order Service',
    description: '訂單建立與查詢',
    endpoints: [
      { method: 'GET', label: '訂單列表', path: '/api/v2/orders' },
      { method: 'POST', label: '建立訂單', path: '/api/v2/orders/create' },
      { method: 'GET', label: '訂單詳情', path: '/api/v2/orders/{id}' }
    ]
  },
  {
    id: 'api-4',
    category: '訂單交易 (Order)',
    name: 'Payment Gateway',
    description: '金流串接服務 (僅限 PRD/STG)',
    deployRules: { onlyTypes: ['PRD1', 'PRD2', 'STG1', 'STG2'] },
    endpoints: [
      { method: 'POST', label: '信用卡結帳', path: '/api/payment/credit-card' },
      { method: 'POST', label: '退款申請', path: '/api/payment/refund' }
    ]
  },
  {
    id: 'api-5',
    category: '後台管理 (Admin)',
    name: 'Dashboard API',
    description: '提供給內部後台的報表數據',
    deployRules: { excludeRegions: ['Region-03'] },
    endpoints: [
      { method: 'GET', label: '營收報表', path: '/api/admin/reports/revenue' },
      { method: 'GET', label: '活躍用戶', path: '/api/admin/stats/active-users' },
      { method: 'DELETE', label: '清除快取', path: '/api/admin/cache/clear' }
    ]
  },
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `api-gen-${i + 6}`,
    category: i < 5 ? '庫存系統 (Inventory)' : i < 10 ? '通知服務 (Notification)' : '第三方整合 (3rd Party)',
    name: `Service ${i + 6}`,
    description: `自動生成的服務描述 ${i + 6}`,
    endpoints: [
      { method: 'GET', label: '健康檢查', path: `/api/service-${i + 6}/health` },
      { method: 'GET', label: '列表查詢', path: `/api/service-${i + 6}/list` }
    ]
  }))
];

const REGIONS = Array.from({ length: 20 }, (_, i) => `Region-${String(i + 1).padStart(2, '0')}`);
const ENV_TYPES = ['PRD1', 'PRD2', 'STG1', 'STG2', 'UAT', 'DEV'];

const DEFAULT_ENVS = REGIONS.flatMap((region, rIndex) => {
  const envCount = 4 + (rIndex % 3); 
  const regionEnvs = ENV_TYPES.slice(0, envCount);
  
  return regionEnvs.map((type, eIndex) => ({
    id: `${region}-${type}`,
    region: region,
    name: type,
    type: type.replace(/\d+/, ''),
    rawType: type,
    baseUrl: `https://api.${region.toLowerCase()}.${type.toLowerCase()}.example.com`
  }));
});

// 檢查 API 是否在特定環境可用
const checkApiAvailability = (api, env) => {
  if (!api.deployRules) return true;
  if (!env) return false;

  const { onlyRegions, onlyTypes, excludeRegions, excludeTypes } = api.deployRules;
  if (excludeRegions && excludeRegions.includes(env.region)) return false;
  if (excludeTypes && (excludeTypes.includes(env.rawType) || excludeTypes.includes(env.type))) return false;
  if (onlyRegions && !onlyRegions.includes(env.region)) return false;
  if (onlyTypes && !onlyTypes.includes(env.rawType) && !onlyTypes.includes(env.type)) return false;
  return true;
};

// 顏色對應
const METHOD_COLORS = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-green-100 text-green-700 border-green-200',
  PUT: 'bg-orange-100 text-orange-700 border-orange-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  PATCH: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  DEFAULT: 'bg-slate-100 text-slate-700 border-slate-200'
};

const App = () => {
  // --- 狀態 ---
  const [environments, setEnvironments] = useState(DEFAULT_ENVS);
  const [apis, setApis] = useState(DEFAULT_APIS);
  
  // View Mode: 'env' (Environment Centric) | 'api' (API Matrix Centric)
  const [viewMode, setViewMode] = useState('env'); 
  
  // Selected States
  const [selectedEnvId, setSelectedEnvId] = useState(DEFAULT_ENVS[0].id);
  const [selectedApiId, setSelectedApiId] = useState(DEFAULT_APIS[0].id);
  
  const [expandedRegions, setExpandedRegions] = useState({ [DEFAULT_ENVS[0].region]: true });
  const [expandedCategories, setExpandedCategories] = useState({ [DEFAULT_APIS[0].category]: true });

  const [searchQuery, setSearchQuery] = useState(''); // Unified search for sidebar
  const [contentSearch, setContentSearch] = useState(''); // Unified search for content area
  
  const [hideUndeployed, setHideUndeployed] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const [configEnvs, setConfigEnvs] = useState('');
  const [configApis, setConfigApis] = useState('');

  // --- 計算邏輯：環境視角 ---
  const selectedEnv = useMemo(() => 
    environments.find(e => e.id === selectedEnvId) || environments[0], 
  [environments, selectedEnvId]);

  const groupedEnvs = useMemo(() => {
    if (viewMode !== 'env') return {};
    const searchLower = searchQuery.toLowerCase();
    const filtered = environments.filter(env => 
      env.region.toLowerCase().includes(searchLower) ||
      env.name.toLowerCase().includes(searchLower)
    );
    const groups = {};
    filtered.forEach(env => {
      if (!groups[env.region]) groups[env.region] = [];
      groups[env.region].push(env);
    });
    return groups;
  }, [environments, searchQuery, viewMode]);

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
          api.category?.toLowerCase().includes(searchLower) ||
          api.endpoints.some(ep => ep.path.toLowerCase().includes(searchLower));
        
        if (hideUndeployed && !api.isAvailable) return false;
        return matchesSearch;
      });

    const groups = {};
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
    const groups = {};
    filtered.forEach(api => {
      const cat = api.category || '未分類';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(api);
    });
    return groups;
  }, [apis, searchQuery, viewMode]);

  const apiMatrixData = useMemo(() => {
    if (viewMode !== 'api') return {};
    // Group all environments by region to show the matrix
    const groups = {};
    
    // Sort regions naturally
    const sortedRegions = [...new Set(environments.map(e => e.region))].sort();

    sortedRegions.forEach(region => {
      const regionEnvs = environments.filter(e => e.region === region);
      // Process each env against selectedApi
      const processedEnvs = regionEnvs.map(env => ({
        ...env,
        isDeployed: checkApiAvailability(selectedApi, env)
      }));

      // Filter if needed
      const visibleEnvs = hideUndeployed 
        ? processedEnvs.filter(e => e.isDeployed) 
        : processedEnvs;

      if (visibleEnvs.length > 0) {
        groups[region] = visibleEnvs;
      }
    });
    return groups;
  }, [environments, selectedApi, hideUndeployed, viewMode]);


  // --- Actions ---
  const copyToClipboard = (text, key) => {
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

  const getEnvColor = (type) => {
    const t = (type || '').toUpperCase();
    if (t.includes('PRD')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (t.includes('QA') || t.includes('STG')) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  const toggleSidebarGroup = (key, type) => {
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

  const resetConfig = () => {
    if(confirm('Reset?')) {
      setEnvironments(DEFAULT_ENVS);
      setApis(DEFAULT_APIS);
      setIsConfigOpen(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* --- Sidebar --- */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-lg z-20">
        
        {/* View Mode Toggle Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setViewMode('env')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              viewMode === 'env' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Globe size={16} /> 環境視角
          </button>
          <button
            onClick={() => setViewMode('api')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              viewMode === 'api' ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'
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
                        <span className="font-medium truncate">{env.name}</span>
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
                  <h1 className="text-lg font-bold text-slate-800 truncate">{selectedEnv?.baseUrl}</h1>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
                    <Layers size={12} /> {selectedApi?.category}
                    {selectedApi?.deployRules && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 rounded border border-amber-200">特殊部署規則</span>}
                  </div>
                  <h1 className="text-lg font-bold text-slate-800 truncate">{selectedApi?.name} <span className="text-sm font-normal text-slate-400 mx-2">{selectedApi?.description}</span></h1>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
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
            <div className="max-w-7xl mx-auto space-y-8 pb-12">
              {Object.entries(envViewApis).map(([category, apiList]) => (
                <div key={category} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-700 mb-4 px-1">
                    <Layers size={20} className="text-blue-500" />
                    {category}
                    <span className="text-xs text-slate-400 bg-white border px-2 rounded-full">{apiList.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {apiList.map((api) => {
                      const isAvailable = api.isAvailable;
                      return (
                        <div key={api.id} className={`flex flex-col rounded-xl border shadow-sm transition-all overflow-hidden ${isAvailable ? 'bg-white border-slate-200 hover:shadow-lg hover:border-blue-300' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                          <div className={`p-4 border-b border-slate-100 ${isAvailable ? 'bg-white' : 'bg-slate-100/50'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className={`font-bold text-base truncate pr-2 ${isAvailable ? 'text-slate-800' : 'text-slate-500'}`}>{api.name}</h4>
                              {!isAvailable && <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full flex items-center gap-1"><Ban size={10} /> 未部署</span>}
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2 h-8">{api.description || '暫無描述'}</p>
                          </div>
                          <div className="flex-1 bg-slate-50/50 p-2 space-y-2">
                            {api.endpoints.map((ep, idx) => {
                              const fullUrl = isAvailable ? `${selectedEnv?.baseUrl}${ep.path}` : null;
                              const uniqueKey = `${selectedEnvId}-${api.id}-${idx}`;
                              const isCopied = copiedKey === uniqueKey;
                              return (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm hover:border-blue-200 group">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || METHOD_COLORS.DEFAULT}`}>{ep.method}</span>
                                    <span className="text-xs font-semibold text-slate-700 truncate">{ep.label}</span>
                                  </div>
                                  <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => isAvailable && copyToClipboard(fullUrl, uniqueKey)} disabled={!isAvailable} className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border ${!isAvailable ? 'cursor-not-allowed bg-slate-100' : isCopied ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                                      {isAvailable && isCopied ? <Check size={12} /> : <Copy size={12} />} {isAvailable ? (isCopied ? '已複製' : '複製') : '不可用'}
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
            <div className="max-w-7xl mx-auto pb-12">
               {/* Endpoints Info Card */}
               <div className="bg-white rounded-xl border border-blue-100 p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
                 <h3 className="text-sm font-bold text-slate-600 mr-2">此服務包含端點：</h3>
                 {selectedApi?.endpoints.map((ep, i) => (
                   <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                     <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                     <span className="text-xs font-mono text-slate-600">{ep.path}</span>
                     <span className="text-xs text-slate-400 border-l pl-2 border-slate-200">{ep.label}</span>
                   </div>
                 ))}
               </div>

               {/* Matrix Grid */}
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
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
                                     <span className="font-bold text-sm text-slate-800">{env.name}</span>
                                     <span className={`text-[10px] px-1.5 rounded border ${getEnvColor(env.type)}`}>{env.type}</span>
                                   </div>
                                   <div className="text-[10px] text-slate-400 font-mono mt-0.5">{env.baseUrl}</div>
                                 </div>
                               </div>
                               {!isDeployed && <span className="text-xs text-slate-400 font-medium px-2 py-1 bg-slate-100 rounded">未部署</span>}
                             </div>

                             {/* Action Buttons for this Env */}
                             {isDeployed && (
                               <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                 {selectedApi.endpoints.map((ep, i) => {
                                   const fullUrl = `${env.baseUrl}${ep.path}`;
                                   const uniqueKey = `matrix-${env.id}-${i}`;
                                   const isCopied = copiedKey === uniqueKey;
                                   return (
                                     <button
                                       key={i}
                                       onClick={() => copyToClipboard(fullUrl, uniqueKey)}
                                       className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                         isCopied 
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