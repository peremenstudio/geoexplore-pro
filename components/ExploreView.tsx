import React, { useState } from 'react';
import { Search, MapPin, Navigation, Plus, Loader2, AlertCircle, Globe, Sparkles } from 'lucide-react';
import { fetchNominatimPlaces } from '../utils/nominatim';
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
        const layerName = feature ? (feature.properties?.name || 'Selected Property') : `${query} (OSM)`;

        const newLayer: Layer = {
            id: `explore-${Date.now()}`,
            name: layerName,
            visible: true,
            data: { type: 'FeatureCollection', features: dataToBatch },
            color: '#0ea5e9',
            opacity: 1,
            type: 'point',
            grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
            lastUpdated: Date.now()
        };

        onAddLayer(newLayer);
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] overflow-hidden">
            {/* Hero Section */}
            <div className="relative pt-12 pb-16 px-6 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-coral-50/50 to-sky-50/50 -z-10" />
                <div className="max-w-4xl mx-auto text-center space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-coral-100 shadow-sm text-coral-600 text-xs font-bold uppercase tracking-widest animate-pulse">
                        <Sparkles size={14} /> Connected to OpenStreetMap
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                        Discover the World <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-coral-600 to-sky-500">in Real Time</span>
                    </h2>
                    
                    <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto group">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-coral-500 transition-colors">
                            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />}
                        </div>
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search places, addresses or businesses..."
                            className="w-full pl-14 pr-32 py-5 rounded-3xl border-0 bg-white shadow-2xl shadow-coral-100 text-xl focus:ring-4 focus:ring-coral-500/10 outline-none transition-all placeholder:text-slate-300"
                        />
                        <button 
                            type="submit"
                            disabled={isLoading || !query.trim()}
                            className="absolute right-2.5 top-2.5 bottom-2.5 bg-coral-600 text-white px-8 rounded-2xl font-bold hover:bg-coral-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-coral-200"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pb-12">
                <div className="max-w-6xl mx-auto">
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-48 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center">
                                    <Navigation size={32} className="text-slate-200" />
                                </div>
                            ))}
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                                <h3 className="text-xl font-bold text-slate-800">Search Results ({results.length})</h3>
                                <button 
                                    onClick={() => handleAddAsLayer()}
                                    className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-md"
                                >
                                    Add All to New Layer
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((f, idx) => (
                                    <div key={idx} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="p-3 bg-coral-50 text-coral-600 rounded-2xl">
                                                <MapPin size={24} />
                                            </div>
                                            <button 
                                                onClick={() => handleAddAsLayer(f)}
                                                className="p-2 bg-slate-50 text-slate-400 hover:bg-coral-600 hover:text-white rounded-xl transition-all"
                                                title="Add to Map"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                        <h4 className="font-bold text-slate-800 text-lg mb-2 truncate">{f.properties?.name}</h4>
                                        <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">{f.properties?.address}</p>
                                        <div className="flex items-center gap-2 mt-auto">
                                            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-lg">
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