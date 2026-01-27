import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { LayerManager } from './components/LayerManager';
import { MapArea } from './components/MapArea';
import { MapboxMap } from './components/MapboxMap';
import { DataExplorer } from './components/DataExplorer';
import { ExploreView } from './components/ExploreView';
import { AnalyzeView } from './components/AnalyzeView';
import { processFile } from './utils/fileProcessor';
import { fetchNominatimPlaces } from './utils/nominatim';
import { fetchOverpassData } from './utils/overpass';
import { fetchDetailedNadlanTransactions } from './utils/nadlanApi';
import { fetchTelAvivSportsFields } from './utils/telAvivGis';
import { fetchJerusalemLayer, JERUSALEM_CATEGORIES } from './utils/jerusalemGis';
import { Layer, AppView } from './types';
import { Menu, Map as MapIcon, Database, Layers, Compass, BarChart3, Loader2, Box, Download, Globe, Home, Crosshair, Search, Info, Building, Flag, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import { Feature, GeoJsonProperties } from 'geojson';

export default function App() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeView, setActiveView] = useState<AppView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [rightPanelMode, setRightPanelMode] = useState<'layer' | 'fetch' | null>('layer');
  const [is3DMode, setIs3DMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [zoomToLayerId, setZoomToLayerId] = useState<string | null>(null);
  
  // Pick Location / Edit State
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [pendingLayerName, setPendingLayerName] = useState('');
  const [draftFeatures, setDraftFeatures] = useState<Feature[]>([]);

  // Fetch Data State
  const [isPickingFetch, setIsPickingFetch] = useState(false);
  const [fetchLocation, setFetchLocation] = useState<{lat: number, lng: number} | null>(null);
  const [fetchRadius, setFetchRadius] = useState(500);
  const [fetchName, setFetchName] = useState('');
  const [fetchQuery, setFetchQuery] = useState('');
  
  // New Fetch UI State
  const [expandedCategory, setExpandedCategory] = useState<'urban' | 'national' | 'commercial' | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [expandedJerusalemCategory, setExpandedJerusalemCategory] = useState<string | null>(null);

  // Analyze State
  const [analyzedLayerId, setAnalyzedLayerId] = useState<string | null>(null);
  const [filteredFeatures, setFilteredFeatures] = useState<Feature[] | null>(null);

  // Computed Layers for Map
  const displayLayers = useMemo(() => {
    if (activeView !== 'analyze' || !analyzedLayerId || !filteredFeatures) {
      return layers;
    }
    return layers.map(l => {
      if (l.id === analyzedLayerId) {
        return {
          ...l,
          data: { ...l.data, features: filteredFeatures },
          lastUpdated: Date.now() 
        };
      }
      return l;
    });
  }, [layers, activeView, analyzedLayerId, filteredFeatures]);

  useEffect(() => {
      if (activeView !== 'analyze') {
          setAnalyzedLayerId(null);
          setFilteredFeatures(null);
      }
  }, [activeView]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, nameOverride: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const geojson = await processFile(file);
      const newLayer: Layer = {
        id: `layer-${Date.now()}`,
        name: nameOverride || file.name.split('.')[0],
        visible: true,
        data: geojson,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        opacity: 0.7,
        type: 'point',
        grid: {
            show: false,
            showLabels: false,
            size: 0.5,
            opacity: 0.5
        },
        lastUpdated: Date.now()
      };

      setLayers(prev => [...prev, newLayer]);
    } catch (error) {
      console.error(error);
      alert('Failed to process file.');
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleStartPickLocation = (name: string) => {
    setPendingLayerName(name);
    setEditingLayerId(null);
    setDraftFeatures([]); 
    setIsPickingLocation(true);
    setActiveView('map');
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleStartEditLayer = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;

    setEditingLayerId(id);
    setPendingLayerName(layer.name);
    setDraftFeatures([]);
    setIsPickingLocation(true);
    setActiveView('map');
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleCancelPickLocation = () => {
      setIsPickingLocation(false);
      setDraftFeatures([]);
      setPendingLayerName('');
      setEditingLayerId(null);
  };

  const handleFinishPickLocation = () => {
      if (draftFeatures.length === 0) {
          handleCancelPickLocation();
          return;
      }

      if (editingLayerId) {
        setLayers(prev => prev.map(l => {
          if (l.id === editingLayerId) {
             const sampleProps = l.data.features[0]?.properties || {};
             const schemaKeys = Object.keys(sampleProps).filter(k => !k.startsWith('_'));
             
             const normalizedDrafts = draftFeatures.map(df => {
                 const newProps = { ...df.properties };
                 schemaKeys.forEach(key => {
                     if (!Object.prototype.hasOwnProperty.call(newProps, key)) {
                         newProps[key] = (key === 'Priority') ? "None" : "";
                     }
                 });
                 const { _isNew, ...finalProps } = newProps;
                 return { ...df, properties: finalProps };
             });

             return {
                 ...l,
                 data: {
                     ...l.data,
                     features: [...l.data.features, ...normalizedDrafts]
                 },
                 lastUpdated: Date.now()
             };
          }
          return l;
        }));
      } else {
        const cleanFeatures = draftFeatures.map(f => {
            const { _isNew, ...props } = f.properties || {};
            return { ...f, properties: props };
        });

        const newLayer: Layer = {
            id: `layer-${Date.now()}`,
            name: pendingLayerName,
            visible: true,
            data: {
            type: 'FeatureCollection',
            features: cleanFeatures
            },
            color: '#6366f1',
            opacity: 1,
            type: 'point',
            grid: {
                show: false,
                showLabels: false,
                size: 0.5,
                opacity: 0.5
            },
            lastUpdated: Date.now()
        };
        setLayers(prev => [...prev, newLayer]);
      }
      
      setIsPickingLocation(false);
      setDraftFeatures([]);
      setPendingLayerName('');
      setEditingLayerId(null);
      setIsLayerPanelOpen(true); 
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (isPickingFetch) {
        setFetchLocation({ lat, lng });
        setIsPickingFetch(false);
        return;
    }

    if (!isPickingLocation) return;

    let initialProperties: GeoJsonProperties = {};

    if (editingLayerId) {
        const layer = layers.find(l => l.id === editingLayerId);
        if (layer && layer.data.features.length > 0) {
            const sampleProps = layer.data.features[0].properties || {};
            const keys = Object.keys(sampleProps).filter(k => !k.startsWith('_'));
            keys.forEach(key => {
                initialProperties[key] = (key === 'Priority') ? "None" : "";
            });
        }
        if (!Object.prototype.hasOwnProperty.call(initialProperties, 'Priority')) {
            initialProperties['Priority'] = "None";
        }
        initialProperties['_isNew'] = true;
    } else {
        const newId = `id-${Date.now().toString().slice(-6)}`;
        initialProperties = {
            id: newId,
            name: '', 
            Priority: 'None',
            _isNew: true, 
            created_at: new Date().toISOString()
        };
    }
    
    const newFeature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: initialProperties
    };

    setDraftFeatures(prev => [...prev, newFeature]);
  };

  const handleFetchData = async (config: { name: string, query: string, radius: number }) => {
    if (!fetchLocation) {
        alert("Please pick a center location on the map first.");
        return;
    }

    setIsLoading(true);
    try {
        // Use Overpass API for category/type searches (amenity, shop, etc.)
        // Overpass is better for searching by category than Nominatim
        const features = await fetchOverpassData(config.query, fetchLocation, config.radius);
        if (features.length === 0) {
            alert(`No places found for "${config.query}". Try: restaurant, cafe, bank, hospital, park, etc.`);
        } else {
            const newLayer: Layer = {
                id: `fetched-${Date.now()}`,
                name: config.name || `${config.query} (OSM)`,
                visible: true,
                data: { type: 'FeatureCollection', features },
                color: '#ec4899',
                opacity: 1,
                type: 'point',
                grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now()
            };
            setLayers(prev => [...prev, newLayer]);
            setFetchLocation(null);
            setIsPickingFetch(false);
            setFetchName('');
            setFetchQuery('');
            setZoomToLayerId(newLayer.id);
        }
    } catch (e: any) {
        alert(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleExecuteNadlanFetch = async (city: string) => {
    setIsLoading(true);
    try {
        // Updated to use the more detailed transaction fetcher
        const features = await fetchDetailedNadlanTransactions(city);
        if (features.length === 0) {
            alert(`לא נמצאו עסקאות עבור "${city}". נסה להזין שם עיר מדויק בעברית.`);
        } else {
            const newLayer: Layer = {
                id: `nadlan-${Date.now()}`,
                name: `עסקאות: ${city}`,
                visible: true,
                data: { type: 'FeatureCollection', features },
                color: '#d97706', // Amber-600
                opacity: 1,
                type: 'point',
                grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now()
            };
            setLayers(prev => [...prev, newLayer]);
            setZoomToLayerId(newLayer.id);
            setActiveView('map');
        }
    } catch (e: any) {
        alert(e.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleFetchTelAvivLayer = async (layerType: string) => {
    setIsLoading(true);
    try {
        let features: Feature[] = [];
        let layerName = '';
        let color = '';

        switch(layerType) {
            case 'sports':
                features = await fetchTelAvivSportsFields();
                layerName = 'Tel Aviv - Sports Fields';
                color = '#10b981'; // Green
                break;
            default:
                throw new Error('Unknown layer type');
        }

        if (features.length === 0) {
            alert(`No data found for ${layerName}`);
        } else {
            const newLayer: Layer = {
                id: `tlv-${layerType}-${Date.now()}`,
                name: layerName,
                visible: true,
                data: { type: 'FeatureCollection', features },
                color: color,
                opacity: 0.7,
                type: 'polygon',
                grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now()
            };
            setLayers(prev => [...prev, newLayer]);
            setZoomToLayerId(newLayer.id);
            setRightPanelMode('layer');
        }
    } catch (e: any) {
        alert(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const handleFetchJerusalemLayer = async (layerId: number, layerName: string, color: string) => {
    setIsLoading(true);
    try {
        const features = await fetchJerusalemLayer(layerId);
        
        if (features.length === 0) {
            alert(`No data found for ${layerName}`);
        } else {
            const newLayer: Layer = {
                id: `jlm-${layerId}-${Date.now()}`,
                name: `Jerusalem - ${layerName}`,
                visible: true,
                data: { type: 'FeatureCollection', features },
                color: color,
                opacity: 0.7,
                type: 'point',
                grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now()
            };
            setLayers(prev => [...prev, newLayer]);
            setZoomToLayerId(newLayer.id);
            setRightPanelMode('layer');
        }
    } catch (e: any) {
        alert(`Error: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  };

  const toggleLayerVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const updateLayerStyle = (id: string, style: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...style } : l));
  };

  const handleUpdateFeature = (layerId: string, featureIndex: number, newProperties: GeoJsonProperties) => {
      if (newProperties.Priority === 'Urgent') {
          newProperties._urgentTimestamp = Date.now();
      }
      if (layerId === 'draft-layer') {
          setDraftFeatures(prev => prev.map((f, idx) => idx === featureIndex ? { ...f, properties: newProperties } : f));
          return;
      }
      setLayers(prev => prev.map(l => l.id === layerId ? {
          ...l,
          data: { ...l.data, features: l.data.features.map((f, idx) => idx === featureIndex ? { ...f, properties: newProperties } : f) },
          lastUpdated: Date.now()
      } : l));
  };

  const handleAddExploreLayer = (newLayer: Layer) => {
      setLayers(prev => [...prev, newLayer]);
      setActiveView('map');
      setZoomToLayerId(newLayer.id);
  };

  const handleMergeLayers = (destinationId: string, sourceId: string): number => {
    const destLayer = layers.find(l => l.id === destinationId);
    const sourceLayer = layers.find(l => l.id === sourceId);
    if (!destLayer || !sourceLayer) return 0;

    const updatedDestLayer = {
        ...destLayer,
        data: {
            ...destLayer.data,
            features: [...destLayer.data.features, ...sourceLayer.data.features]
        },
        lastUpdated: Date.now()
    };
    setLayers(prev => prev.map(l => l.id === destinationId ? updatedDestLayer : l));
    return 0;
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-slate-900 font-sans antialiased">
      {/* Sidebar Nav */}
      <div className={`${isSidebarOpen && activeView !== 'analyze' ? 'w-80 translate-x-0' : 'w-0 -translate-x-full'} transition-all duration-300 ease-in-out bg-white border-r border-slate-200 flex flex-col shadow-2xl z-30 relative`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-gradient-to-br from-coral-600 to-coral-700 rounded-xl flex items-center justify-center text-white font-bold shadow-coral-200 shadow-md">
               GE
             </div>
             <h1 className="text-xl font-bold text-slate-800 tracking-tight">GeoExplore</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 rounded text-slate-500">
            <Menu size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white/50">
          <Sidebar 
            activeView={activeView}
            setActiveView={setActiveView}
            onFileUpload={handleFileUpload}
            isLoading={isLoading}
            onStartPickLocation={handleStartPickLocation}
            onFinishPickLocation={handleFinishPickLocation}
            onCancelPickLocation={handleCancelPickLocation}
            isPickingLocation={isPickingLocation}
            pickingLayerName={pendingLayerName}
            draftCount={draftFeatures.length}
          />
        </div>
        <div className="p-4 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium tracking-wide">
          v2.5.1 • Connected to Government Real Estate Data
        </div>
      </div>

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        {/* Main Header */}
        <div className="h-16 bg-white border-b border-slate-200 w-full relative z-20 shadow-sm flex items-center px-5">
           <div className="flex items-center gap-4 relative z-10">
             {!isSidebarOpen && activeView !== 'analyze' && (
               <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                 <Menu size={20} />
               </button>
             )}
           </div>
           
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 backdrop-blur-sm z-10">
                <button 
                  onClick={() => setActiveView('map')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeView === 'map' ? 'bg-white text-coral-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  <MapIcon size={16} /> Map
                </button>
                <button 
                  onClick={() => setActiveView('explore')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeView === 'explore' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  <Compass size={16} /> Explore
                </button>
                <button 
                  onClick={() => setActiveView('data')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeView === 'data' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  <Database size={16} /> Data
                </button>
                <button 
                  onClick={() => setActiveView('analyze')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeView === 'analyze' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  <BarChart3 size={16} /> Analyze
                </button>
           </div>

           <div className="ml-auto relative z-10 flex items-center gap-3">
              {isLoading && (
                  <div className="flex items-center gap-2 text-coral-600 font-bold text-xs animate-pulse bg-coral-50 px-3 py-1.5 rounded-full border border-coral-100">
                      <Loader2 size={14} className="animate-spin" /> Loading data...
                  </div>
              )}
              {activeView === 'map' && (
                <>
                  <button 
                      onClick={() => setRightPanelMode(rightPanelMode === 'layer' ? null : 'layer')}
                      className={`p-2.5 rounded-lg transition-all ${rightPanelMode === 'layer' ? 'bg-coral-50 text-coral-600 ring-1 ring-coral-200' : 'text-slate-500 hover:bg-slate-100'}`}
                      title="Layer Management"
                  >
                      <Layers size={20} />
                  </button>
                  <button 
                      onClick={() => setRightPanelMode(rightPanelMode === 'fetch' ? null : 'fetch')}
                      className={`p-2.5 rounded-lg transition-all ${rightPanelMode === 'fetch' ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-200' : 'text-slate-500 hover:bg-slate-100'}`}
                      title="Fetch Data"
                  >
                      <Download size={20} />
                  </button>
                  <button 
                      onClick={() => setIs3DMode(!is3DMode)}
                      className={`p-2.5 rounded-lg transition-all ${is3DMode ? 'bg-purple-50 text-purple-600 ring-1 ring-purple-200' : 'text-slate-500 hover:bg-slate-100'}`}
                      title={is3DMode ? 'Switch to 2D' : 'Switch to 3D'}
                  >
                      <Box size={20} />
                  </button>
                </>
              )}
           </div>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-50">
          {/* Map - Always in background */}
          <div className="absolute inset-0">
            {is3DMode ? (
              <MapboxMap 
                layers={displayLayers} 
                draftFeatures={draftFeatures}
                zoomToLayerId={zoomToLayerId}
                onZoomComplete={() => setZoomToLayerId(null)}
                onUpdateFeature={handleUpdateFeature}
                isPickingLocation={isPickingLocation || isPickingFetch}
                onMapClick={handleMapClick}
                fetchLocation={fetchLocation}
                fetchRadius={fetchRadius}
              />
            ) : (
              <MapArea 
                layers={displayLayers} 
                draftFeatures={draftFeatures}
                zoomToLayerId={zoomToLayerId}
                onZoomComplete={() => setZoomToLayerId(null)}
                onUpdateFeature={handleUpdateFeature}
                isPickingLocation={isPickingLocation || isPickingFetch}
                onMapClick={handleMapClick}
                fetchLocation={fetchLocation}
                fetchRadius={fetchRadius}
              />
            )}
          </div>
          
          {activeView === 'analyze' && (
             <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-slate-50 z-20">
                 <AnalyzeView 
                    layers={layers}
                    onFilterChange={(layerId, features) => {
                        setAnalyzedLayerId(layerId);
                        setFilteredFeatures(features);
                    }}
                    onAddLayer={(newLayer) => {
                        setLayers(prev => [...prev, newLayer]);
                        setZoomToLayerId(newLayer.id);
                    }}
                 />
             </div>
          )}
          
          {activeView === 'data' && (
             <div className="absolute inset-0 z-20 bg-slate-50">
               <DataExplorer 
                  layers={layers} 
                  onMergeLayers={handleMergeLayers}
                  onFileUpload={handleFileUpload}
                  isLoading={isLoading}
                  onAddLayer={(newLayer) => setLayers(prev => [...prev, newLayer])}
               />
             </div>
          )}

          {activeView === 'explore' && (
             <div className="absolute inset-0 z-20 bg-slate-50">
                <ExploreView 
                    onAddLayer={handleAddExploreLayer}
                    mapCenter={fetchLocation} 
                />
             </div>
          )}

          {activeView === 'map' && rightPanelMode && (
            <div className={`absolute top-4 right-4 bottom-4 w-80 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-white/50 transform transition-transform duration-300 flex flex-col z-[1000] ${rightPanelMode ? 'translate-x-0' : 'translate-x-[120%]'}`}>
              {rightPanelMode === 'layer' && (
                <LayerManager 
                  layers={layers}
                  onToggle={toggleLayerVisibility}
                  onDelete={deleteLayer}
                  onStyleChange={updateLayerStyle}
                  onZoom={setZoomToLayerId}
                  onEdit={handleStartEditLayer}
                />
              )}
              {rightPanelMode === 'fetch' && (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-slate-100 bg-white/50 backdrop-blur rounded-t-xl">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <Download size={18} className="text-sky-600" /> 
                        Fetch Data Sources
                    </h2>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Urban Category */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === 'urban' ? null : 'urban')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Building size={16} className="text-blue-600" />
                          </div>
                          <span className="font-semibold text-slate-800">Urban</span>
                        </div>
                        {expandedCategory === 'urban' ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      </button>
                      
                      {expandedCategory === 'urban' && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-2">Select City</label>
                            <select
                              value={selectedCity}
                              onChange={(e) => setSelectedCity(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            >
                              <option value="">Choose a city...</option>
                              <option value="tel-aviv">Tel Aviv</option>
                              <option value="jerusalem">Jerusalem</option>
                              <option value="haifa">Haifa</option>
                              <option value="beer-sheva">Beer Sheva</option>
                            </select>
                          </div>

                          {selectedCity && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                              <p className="text-xs font-semibold text-slate-600 mb-2">Available Layers</p>
                              
                              {selectedCity === 'tel-aviv' && (
                                <>
                                  <button 
                                    onClick={() => handleFetchTelAvivLayer('sports')}
                                    disabled={isLoading}
                                    className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                      <span className="text-sm font-medium text-slate-700 group-hover:text-green-700">Sports Fields</span>
                                    </div>
                                    {isLoading ? <Loader2 size={14} className="animate-spin text-green-600" /> : <Download size={14} className="text-slate-400 group-hover:text-green-600" />}
                                  </button>

                                  <button className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all group">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                      <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">Public Transportation</span>
                                    </div>
                                    <Download size={14} className="text-slate-400 group-hover:text-blue-600" />
                                  </button>

                                  <button className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all group">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                      <span className="text-sm font-medium text-slate-700 group-hover:text-amber-700">Parks & Gardens</span>
                                    </div>
                                    <Download size={14} className="text-slate-400 group-hover:text-amber-600" />
                                  </button>
                                </>
                              )}

                              {selectedCity === 'jerusalem' && (
                                <div className="space-y-2">
                                  {JERUSALEM_CATEGORIES.map((category) => (
                                    <div key={category.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                      <button
                                        onClick={() => setExpandedJerusalemCategory(expandedJerusalemCategory === category.id ? null : category.id)}
                                        className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors"
                                      >
                                        <span className="text-sm font-semibold text-slate-700">{category.name}</span>
                                        {expandedJerusalemCategory === category.id ? 
                                          <ChevronDown size={16} className="text-slate-400" /> : 
                                          <ChevronRight size={16} className="text-slate-400" />
                                        }
                                      </button>
                                      
                                      {expandedJerusalemCategory === category.id && (
                                        <div className="border-t border-slate-100 bg-slate-50 p-2 space-y-1.5">
                                          {category.layers.map((layer) => (
                                            <button
                                              key={layer.id}
                                              onClick={() => handleFetchJerusalemLayer(layer.id, layer.name, layer.color)}
                                              disabled={isLoading}
                                              className="w-full flex items-center justify-between p-2.5 bg-white rounded-md border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: layer.color }}></div>
                                                <span className="text-xs font-medium text-slate-700">{layer.name}</span>
                                              </div>
                                              {isLoading ? 
                                                <Loader2 size={12} className="animate-spin text-slate-600" /> : 
                                                <Download size={12} className="text-slate-400 group-hover:text-slate-600" />
                                              }
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {selectedCity !== 'tel-aviv' && selectedCity !== 'jerusalem' && (
                                <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
                                  <p className="text-sm text-slate-500 italic text-center">Layers for this city coming soon</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* National Category */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === 'national' ? null : 'national')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                            <Flag size={16} className="text-green-600" />
                          </div>
                          <span className="font-semibold text-slate-800">National</span>
                        </div>
                        {expandedCategory === 'national' ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      </button>
                      
                      {expandedCategory === 'national' && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                          <p className="text-sm text-slate-500 italic">National datasets will be available soon</p>
                        </div>
                      )}
                    </div>

                    {/* Commercial Category */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === 'commercial' ? null : 'commercial')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                            <ShoppingCart size={16} className="text-amber-600" />
                          </div>
                          <span className="font-semibold text-slate-800">Commercial</span>
                        </div>
                        {expandedCategory === 'commercial' ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      </button>
                      
                      {expandedCategory === 'commercial' && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                          <p className="text-sm text-slate-500 italic">Commercial datasets will be available soon</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}