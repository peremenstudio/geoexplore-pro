import React, { useState } from 'react';
import { Layer } from '../types';
import { Eye, EyeOff, Trash2, MapPin, ZoomIn, Grid, Plus, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

interface LayerManagerProps {
  layers: Layer[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onStyleChange: (id: string, style: Partial<Layer>) => void;
  onZoom: (id: string) => void;
  onEdit: (id: string) => void;
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
    layers, onToggle, onDelete, onStyleChange, onZoom, onEdit
}) => {
  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur rounded-t-xl">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <MapPin size={18} className="text-coral-600" /> 
                Layers ({layers.length})
            </h2>
        </div>

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