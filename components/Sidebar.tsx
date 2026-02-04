import React, { useState } from 'react';
import { Upload, Settings, Loader2, Plus, MapPin, Check, X, FileUp, Globe } from 'lucide-react';
import { AppView, Layer } from '../types';
import { LamasFileLoader } from './LamasFileLoader';

interface SidebarProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, name: string) => void;
  isLoading: boolean;
  onStartPickLocation: (name: string) => void;
  onFinishPickLocation: () => void;
  onCancelPickLocation: () => void;
  isPickingLocation: boolean;
  pickingLayerName?: string;
  draftCount?: number;
  onAddLayer?: (layer: Layer) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  onFileUpload,
  isLoading,
  onStartPickLocation,
  onFinishPickLocation,
  onCancelPickLocation,
  isPickingLocation,
  pickingLayerName,
  draftCount = 0,
  onAddLayer
}) => {
  const [layerName, setLayerName] = useState('');
  const [newLayerName, setNewLayerName] = useState('');
  
  const displayLayerName = pickingLayerName || newLayerName || 'New Layer';

  return (
    <div className="space-y-8 px-1">
      {/* Create New Layer Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Plus size={14} className="text-coral-500" /> Manual Data
            </h3>
        </div>
        
        <div className={`relative bg-white rounded-2xl transition-all duration-300 ${isPickingLocation ? 'shadow-lg ring-1 ring-coral-100' : 'shadow-sm border border-slate-100'}`}>
           {isPickingLocation && <div className="absolute inset-x-0 -top-px h-1 bg-gradient-to-r from-coral-500 via-purple-500 to-coral-500 rounded-t-2xl" />}
           
           <div className="p-5">
           {!isPickingLocation ? (
             <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Layer Name</label>
                  <input 
                      type="text" 
                      value={newLayerName}
                      onChange={(e) => setNewLayerName(e.target.value)}
                      placeholder="e.g. Survey Points"
                      className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
                </div>
                
                <button 
                  onClick={() => onStartPickLocation(newLayerName)}
                  disabled={!newLayerName.trim()}
                  className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-coral-600 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-700"
                >
                  <MapPin size={16} />
                  Start Picking Locations
                </button>
             </div>
           ) : (
             <div className="space-y-4">
               <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase">Editing</span>
                    <span className="text-sm font-bold text-slate-800 truncate block max-w-[140px]">{displayLayerName}</span>
                  </div>
                  <span className="text-xs font-bold bg-coral-50 text-coral-600 px-3 py-1 rounded-full border border-coral-100">
                    {draftCount} Points
                  </span>
               </div>
               
               <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                 <span className="font-semibold text-coral-600">Tip:</span> Click anywhere on the map to place a pin.
               </div>

               <div className="grid grid-cols-2 gap-2 pt-1">
                 <button 
                    onClick={onCancelPickLocation}
                    className="py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                  >
                    <X size={14} />
                    Cancel
                 </button>
                 <button 
                    onClick={onFinishPickLocation}
                    className="py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold bg-coral-600 text-white hover:bg-coral-700 shadow-md hover:shadow-lg transition-all"
                  >
                    <Check size={14} />
                    Save
                 </button>
               </div>
             </div>
           )}
           </div>
        </div>
      </section>

      {/* Upload Section */}
      <section className={isPickingLocation ? 'opacity-40 pointer-events-none filter grayscale transition-all duration-500' : 'transition-all duration-500'}>
        <div className="flex items-center justify-between mb-4">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Upload size={14} className="text-emerald-500" /> Import File
            </h3>
        </div>
       
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
           <div>
             <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Layer Name (Optional)</label>
             <input 
                type="text" 
                value={layerName}
                onChange={(e) => setLayerName(e.target.value)}
                placeholder="e.g. City Boundaries"
                className="w-full px-4 py-2.5 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 outline-none transition-all placeholder:text-slate-400 font-medium"
             />
           </div>
           
           <div className="relative group">
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept=".geojson,.json,.shp,.zip,.csv,.xlsx,.xls"
                onChange={(e) => onFileUpload(e, layerName)}
                disabled={isLoading}
              />
              <label 
                htmlFor="file-upload" 
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${isLoading ? 'bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-coral-400 hover:bg-coral-50/50 group-hover:shadow-sm'}`}
              >
                {isLoading ? (
                    <div className="flex flex-col items-center text-slate-400">
                        <Loader2 className="animate-spin mb-3 text-coral-500" size={28} />
                        <span className="text-xs font-medium">Processing File...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-slate-400 group-hover:text-coral-600 transition-colors">
                        <div className="p-3 bg-slate-50 rounded-full mb-3 group-hover:bg-white group-hover:shadow-sm transition-all">
                            <FileUp size={24} />
                        </div>
                        <span className="text-sm font-semibold text-slate-600 group-hover:text-coral-700">Click to Upload</span>
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">GeoJSON • Shapefile • CSV • ZIP</span>
                    </div>
                )}
              </label>
           </div>
        </div>
      </section>

      {/* National Data Section (LAMAS) */}
      {onAddLayer && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Globe size={14} className="text-blue-500" /> National Data
            </h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <LamasFileLoader onAddLayer={onAddLayer} />
          </div>
        </section>
      )}

      {/* Info Section */}
      <div className="bg-gradient-to-br from-coral-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg shadow-coral-200">
        <h4 className="font-bold flex items-center gap-2 mb-3 text-sm">
            <Settings size={16} className="text-coral-200" /> Quick Tips
        </h4>
        <ul className="space-y-2.5 pl-1">
          <li className="flex gap-2 text-xs text-coral-100 leading-snug">
            <span className="w-1 h-1 bg-indigo-300 rounded-full mt-1.5 flex-shrink-0" />
            Use "Manual Data" to drop custom pins.
          </li>
          <li className="flex gap-2 text-xs text-coral-100 leading-snug">
            <span className="w-1 h-1 bg-indigo-300 rounded-full mt-1.5 flex-shrink-0" />
            Upload a .ZIP file for complex Shapefiles.
          </li>
          <li className="flex gap-2 text-xs text-coral-100 leading-snug">
            <span className="w-1 h-1 bg-indigo-300 rounded-full mt-1.5 flex-shrink-0" />
            Try the "Explore" tab to find places with AI.
          </li>
        </ul>
      </div>
    </div>
  );
};