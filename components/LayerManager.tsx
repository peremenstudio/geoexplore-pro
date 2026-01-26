import React, { useState } from 'react';
import { Layer } from '../types';
import { Eye, EyeOff, Trash2, MapPin, ZoomIn, Grid, Plus, CloudDownload, ChevronDown, ChevronUp, Crosshair, Loader2, Search, Globe, Check, X, Home, Building2, Info } from 'lucide-react';

interface LayerManagerProps {
  layers: Layer[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onStyleChange: (id: string, style: Partial<Layer>) => void;
  onZoom: (id: string) => void;
  onEdit: (id: string) => void;

  // Fetch Props
  onPickFetchLocation: () => void;
  isPickingFetch: boolean;
  fetchLocation: { lat: number, lng: number } | null;
  onExecuteFetch: (config: { name: string, query: string, radius: number }) => void;
  onExecuteNadlanFetch: (city: string) => void;
  isFetching: boolean;
  fetchRadius: number;
  onFetchRadiusChange: (radius: number) => void;
}

const LayerItem: React.FC<{ 
    layer: Layer; 
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onStyleChange: (id: string, style: Partial<Layer>) => void;
    onZoom: (id: string) => void;
    onEdit: (id: string) => void;
}> = ({ layer, onToggle, onDelete, onStyleChange, onZoom, onEdit }) => {
    const [isGridOpen, setIsGridOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const updateGrid = (updates: Partial<typeof layer.grid>) => {
        onStyleChange(layer.id, {
            grid: { ...layer.grid, ...updates }
        });
    };

    return (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: layer.color }}
                    />
                    <span className="font-medium text-sm text-slate-700 truncate" title={layer.name}>
                        {layer.name}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                     <button 
                        onClick={() => onToggle(layer.id)}
                        className={`p-1.5 rounded hover:bg-slate-200 ${layer.visible ? 'text-slate-600' : 'text-slate-400'}`}
                        title={layer.visible ? "Hide Layer" : "Show Layer"}
                    >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button 
                        onClick={() => onZoom(layer.id)}
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-600"
                        title="Zoom to Layer"
                    >
                        <ZoomIn size={14} />
                    </button>
                     <button 
                        onClick={() => setIsGridOpen(!isGridOpen)}
                        className={`p-1.5 rounded hover:bg-slate-200 ${layer.grid.show ? 'text-coral-600 bg-coral-50' : 'text-slate-600'}`}
                        title="Grid Analysis"
                    >
                        <Grid size={14} />
                    </button>
                    
                    {isDeleting ? (
                        <div className="flex items-center gap-1 bg-red-50 p-0.5 rounded animate-in fade-in duration-200">
                            <button 
                                onClick={() => onDelete(layer.id)}
                                className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200"
                                title="Confirm Delete"
                            >
                                <Check size={14} />
                            </button>
                            <button 
                                onClick={() => setIsDeleting(false)}
                                className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
                                title="Cancel"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsDeleting(true)}
                            className="p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                            title="Delete Layer"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-3 pl-5 mb-2">
                <div className="flex-1">
                    <input 
                        type="color" 
                        value={layer.color}
                        onChange={(e) => onStyleChange(layer.id, { color: e.target.value })}
                        className="w-full h-6 rounded cursor-pointer overflow-hidden"
                        title="Change Color"
                    />
                </div>
                <div className="w-20">
                    <input 
                        type="range" 
                        min="0" max="1" step="0.1"
                        value={layer.opacity}
                        onChange={(e) => onStyleChange(layer.id, { opacity: Number(e.target.value) })}
                        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-500"
                        title="Opacity"
                    />
                </div>
            </div>

            {/* Grid Controls Dropdown */}
            {isGridOpen && (
                <div className="mt-2 p-3 bg-slate-100 rounded-md border border-slate-200 text-xs animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                        <span className="font-semibold text-slate-700">Grid Analysis</span>
                        <div 
                            onClick={() => updateGrid({ show: !layer.grid.show })}
                            className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${layer.grid.show ? 'bg-coral-600' : 'bg-slate-300'}`}
                            title="Enable Grid"
                        >
                             <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${layer.grid.show ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                    
                    <div className={`space-y-3 ${layer.grid.show ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                         {/* Show Counts Toggle */}
                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">Show Counts</span>
                            <div 
                                onClick={() => updateGrid({ showLabels: !layer.grid.showLabels })}
                                className={`relative w-8 h-4 rounded-full cursor-pointer transition-colors ${layer.grid.showLabels ? 'bg-coral-600' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${layer.grid.showLabels ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </div>

                        <div>
                             <div className="flex justify-between mb-1 text-slate-500">
                                <span>Cell Size (km)</span>
                                <span>{layer.grid.size.toFixed(1)}</span>
                             </div>
                             <input 
                                type="range" 
                                min="0.5" max="2" step="0.1"
                                value={layer.grid.size}
                                onChange={(e) => updateGrid({ size: Number(e.target.value) })}
                                className="w-full h-1 bg-slate-300 rounded appearance-none cursor-pointer accent-coral-600"
                             />
                        </div>
                        <div>
                             <div className="flex justify-between mb-1 text-slate-500">
                                <span>Grid Opacity</span>
                                <span>{Math.round(layer.grid.opacity * 100)}%</span>
                             </div>
                             <input 
                                type="range" 
                                min="0.1" max="1" step="0.1"
                                value={layer.grid.opacity}
                                onChange={(e) => updateGrid({ opacity: Number(e.target.value) })}
                                className="w-full h-1 bg-slate-300 rounded appearance-none cursor-pointer accent-coral-600"
                             />
                        </div>
                    </div>
                </div>
            )}
            
            <div className="mt-3 px-1">
                 <button 
                    onClick={() => onEdit(layer.id)}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors border border-slate-200"
                >
                    <Plus size={12} /> Add Points
                </button>
            </div>

            <div className="mt-2 text-[10px] text-slate-400 pl-1 uppercase tracking-wider">
                {layer.data.features.length} Features • {layer.type}
            </div>
        </div>
    );
}

export const LayerManager: React.FC<LayerManagerProps> = ({ 
    layers, onToggle, onDelete, onStyleChange, onZoom, onEdit,
    onPickFetchLocation, isPickingFetch, fetchLocation, onExecuteFetch, onExecuteNadlanFetch, isFetching,
    fetchRadius, onFetchRadiusChange
}) => {
  const [activeTab, setActiveTab] = useState<'osm' | 'nadlan'>('osm');
  const [isFetchOpen, setIsFetchOpen] = useState(false);
  
  // OSM State
  const [fetchName, setFetchName] = useState('');
  const [fetchQuery, setFetchQuery] = useState('');

  // Nadlan State
  const [nadlanCity, setNadlanCity] = useState('');

  const handleFetch = () => {
      onExecuteFetch({
          name: fetchName,
          query: fetchQuery,
          radius: fetchRadius
      });
  };

  const handleNadlanFetch = () => {
    onExecuteNadlanFetch(nadlanCity);
  };

  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur rounded-t-xl flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <MapPin size={18} className="text-coral-600" /> 
                Layers ({layers.length})
            </h2>
            <button 
                onClick={() => setIsFetchOpen(!isFetchOpen)}
                className={`p-1.5 rounded transition-colors ${isFetchOpen ? 'bg-coral-100 text-coral-700' : 'hover:bg-slate-100 text-slate-600'}`}
                title="Fetch New Data"
            >
                <CloudDownload size={18} />
            </button>
        </div>

        {/* Fetch Data Panel */}
        {isFetchOpen && (
            <div className="bg-slate-50 border-b border-slate-200 shadow-inner flex flex-col animate-in slide-in-from-top-2 duration-300">
                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <button 
                        onClick={() => setActiveTab('osm')}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${activeTab === 'osm' ? 'text-sky-600 bg-white border-b-2 border-sky-600' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                             <Globe size={14} /> OSM Search
                        </div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('nadlan')}
                        className={`flex-1 py-2 text-xs font-bold transition-colors ${activeTab === 'nadlan' ? 'text-amber-600 bg-white border-b-2 border-amber-600' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                             <Home size={14} /> עסקאות נדל"ן
                        </div>
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {activeTab === 'osm' ? (
                        <div className="space-y-3">
                             <div>
                                 <label className="block text-xs font-semibold text-slate-500 mb-1">Layer Name (Optional)</label>
                                 <input 
                                    type="text" 
                                    value={fetchName}
                                    onChange={(e) => setFetchName(e.target.value)}
                                    placeholder="e.g. London Museums"
                                    className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                 />
                             </div>
                             
                             <div>
                                 <label className="block text-xs font-semibold text-slate-500 mb-1">Search Query</label>
                                 <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={fetchQuery}
                                        onChange={(e) => setFetchQuery(e.target.value)}
                                        placeholder="e.g. Pizza in New York"
                                        className="w-full pl-8 pr-2 py-1.5 rounded border border-slate-300 text-sm focus:ring-1 focus:ring-sky-500 outline-none"
                                    />
                                 </div>
                             </div>

                             <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-semibold text-slate-500">Radius (Biasing only)</label>
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded">{fetchRadius}m</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="100" max="5000" step="100"
                                    value={fetchRadius}
                                    onChange={(e) => onFetchRadiusChange(Number(e.target.value))}
                                    className="w-full h-1.5 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600 mt-2"
                                />
                             </div>

                             <div>
                                 <label className="block text-xs font-semibold text-slate-500 mb-1">Center Location</label>
                                 <button 
                                    onClick={onPickFetchLocation}
                                    className={`w-full py-2 px-3 rounded border flex items-center justify-center gap-2 text-xs font-bold transition-colors ${
                                        isPickingFetch 
                                        ? 'bg-sky-600 text-white border-sky-600 animate-pulse' 
                                        : fetchLocation 
                                            ? 'bg-white text-sky-700 border-sky-300 shadow-sm' 
                                            : 'bg-white text-slate-500 border-slate-300 hover:border-sky-300'
                                    }`}
                                 >
                                     <Crosshair size={14} />
                                     {isPickingFetch ? 'Click Map to Pick Center...' : fetchLocation ? `${fetchLocation.lat.toFixed(4)}, ${fetchLocation.lng.toFixed(4)}` : 'Pick Center Point'}
                                 </button>
                             </div>

                             <button 
                                onClick={handleFetch}
                                disabled={!fetchQuery || isFetching}
                                className="w-full py-2 bg-sky-600 text-white rounded font-bold text-sm shadow-sm hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                             >
                                {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                                Fetch Data
                             </button>
                        </div>
                    ) : (
                        <div className="space-y-3" dir="rtl">
                             <div className="bg-amber-50 p-2 rounded border border-amber-100 text-[10px] text-amber-700 mb-2 flex items-start gap-2">
                                 <Info size={12} className="mt-0.5 flex-shrink-0" />
                                 <span>Fetches official data including <strong>plot and parcel</strong> from the Tax Authority website (nadlan.gov.il). The system will perform automatic geocoding when possible.</span>
                             </div>
                             
                             <div>
                                 <label className="block text-xs font-bold text-slate-600 mb-1">שם העיר (בעברית)</label>
                                 <div className="relative">
                                    <Building2 size={14} className="absolute right-2.5 top-2 text-amber-500" />
                                    <input 
                                        type="text" 
                                        value={nadlanCity}
                                        onChange={(e) => setNadlanCity(e.target.value)}
                                        placeholder="למשל: תל אביב יפו"
                                        className="w-full pr-8 pl-2 py-2 rounded border border-amber-200 text-sm focus:ring-1 focus:ring-amber-500 outline-none bg-white font-medium"
                                    />
                                 </div>
                             </div>

                             <button 
                                onClick={handleNadlanFetch}
                                disabled={!nadlanCity || isFetching}
                                className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                             >
                                {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Home size={16} />}
                                משוך מידע מפורט (גוש/חלקה)
                             </button>
                             
                             <p className="text-[9px] text-slate-400 text-center italic">
                                * המשיכה כוללת פרטי רישום מקרקעין מלאים
                             </p>
                        </div>
                    )}
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {layers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm italic">
                    No layers added yet.
                </div>
            ) : (
                layers.map(layer => (
                    <LayerItem 
                        key={layer.id} 
                        layer={layer} 
                        onToggle={onToggle}
                        onDelete={onDelete}
                        onStyleChange={onStyleChange}
                        onZoom={onZoom}
                        onEdit={onEdit}
                    />
                ))
            )}
        </div>
    </div>
  );
};