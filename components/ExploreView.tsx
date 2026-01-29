import React, { useState } from 'react';
import { Search, MapPin, Navigation, Plus, Loader2, AlertCircle, Globe } from 'lucide-react';
import { fetchNominatimPlaces } from '../utils/nominatim';
import { getNextLayerColor } from '../utils/layerColors';
import { Feature } from 'geojson';
import { Layer } from '../types';

interface ExploreViewProps {
    onAddLayer: (layer: Layer) => void;
    mapCenter: { lat: number, lng: number } | null;
}

export const ExploreView: React.FC<ExploreViewProps> = ({ onAddLayer, mapCenter }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<Feature[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsLoading(true);
        setError(null);
        setResults([]);
        try {
            // OpenStreetMap search
            const features = await fetchNominatimPlaces(query, mapCenter || undefined, 15000);
            if (features.length === 0) {
                setError("No results found. Try a more general search.");
            } else {
                setResults(features);
            }
        } catch (err: any) {
            setError(err.message || "Error searching data.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddAsLayer = (feature?: Feature) => {
        const dataToBatch = feature ? [feature] : results;
        let layerName = feature ? (feature.properties?.name || 'Selected Property') : `${query}`;
        
        layerName += ' (OpenStreetMap)';

        const newLayer: Layer = {
            id: `explore-${Date.now()}`,
            name: layerName,
            visible: true,
            data: { type: 'FeatureCollection', features: dataToBatch },
            color: getNextLayerColor(),
            opacity: 1,
            type: 'point',
            grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
            lastUpdated: Date.now()
        };

        onAddLayer(newLayer);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            {/* Mode Toggle */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-bold text-slate-800">Data Explorer</h1>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest bg-coral-600 text-white shadow-md">
                        <Globe size={14} /> OpenStreetMap
                    </div>
                </div>
            </div>

            {/* Search Area */}
            <div className="px-6 py-8 transition-all bg-gradient-to-br from-coral-50/50 to-sky-50/50">
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-6">
                        Search Global Data
                    </h2>
                    
                    <form onSubmit={handleSearch} className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors">
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                        </div>
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search places, addresses or businesses..."
                            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-200 bg-white shadow-lg text-lg focus:ring-0 focus:border-slate-400 outline-none transition-all placeholder:text-slate-400"
                        />
                    </form>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-12">
                <div className="max-w-3xl mx-auto">
                    {error && (
                        <div className="flex flex-col items-center py-20 text-center animate-in fade-in duration-500">
                            <div className="p-4 bg-red-50 rounded-full mb-4 text-red-500">
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">{error}</h3>
                            <p className="text-slate-500 mt-1">Try changing your search terms or check your internet connection.</p>
                        </div>
                    )}

                    {!isLoading && !error && results.length === 0 && (
                        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-40 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center">
                                    <Navigation size={32} className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700 mt-8">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                                <h3 className="text-lg font-bold text-slate-800">Results ({results.length})</h3>
                                <button 
                                    onClick={() => handleAddAsLayer()}
                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition-all shadow-md"
                                >
                                    Add All
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {results.map((f, idx) => (
                                    <div key={idx} className="group bg-white p-4 rounded-lg border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-2 bg-coral-50 text-coral-600 rounded-lg">
                                                <MapPin size={20} />
                                            </div>
                                            <button 
                                                onClick={() => handleAddAsLayer(f)}
                                                className="p-1.5 bg-slate-50 text-slate-400 hover:bg-coral-600 hover:text-white rounded-lg transition-all"
                                                title="Add to Map"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-1 truncate">{f.properties?.name}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{f.properties?.address}</p>
                                        <div className="flex items-center gap-2 mt-auto">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded">
                                                {f.properties?.category}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};