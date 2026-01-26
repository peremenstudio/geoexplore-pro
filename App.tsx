import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { LayerManager } from './components/LayerManager';
import { MapArea } from './components/MapArea';
import { DataExplorer } from './components/DataExplorer';
import { ExploreView } from './components/ExploreView';
import { AnalyzeView } from './components/AnalyzeView';
import { processFile } from './utils/fileProcessor';
import { fetchNominatimPlaces } from './utils/nominatim';
import { fetchDetailedNadlanTransactions } from './utils/nadlanApi';
import { Layer, AppView } from './types';
import { Menu, Map as MapIcon, Database, Layers, Compass, BarChart3, Loader2 } from 'lucide-react';
import { Feature, GeoJsonProperties } from 'geojson';

export default function App() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeView, setActiveView] = useState<AppView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(true);
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
        const features = await fetchNominatimPlaces(config.query, fetchLocation, config.radius);
        if (features.length === 0) {
            alert(`No places found for "${config.query}".`);
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
                <button 
                    onClick={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
                    className={`p-2.5 rounded-lg transition-all ${isLayerPanelOpen ? 'bg-coral-50 text-coral-600 ring-1 ring-coral-200' : 'text-slate-500 hover:bg-slate-100'}`}
                    title="Layer Management"
                >
                    <Layers size={20} />
                </button>
              )}
           </div>
        </div>

        <div className="flex-1 relative overflow-hidden bg-slate-50">
          {/* Map - Always in background */}
          <div className="absolute inset-0">
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
          </div>
          
          {activeView === 'analyze' && (
             <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-slate-50 z-20">
                 <AnalyzeView 
                    layers={layers}
                    onFilterChange={(layerId, features) => {
                        setAnalyzedLayerId(layerId);
                        setFilteredFeatures(features);
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

          {activeView === 'map' && (
            <div className={`absolute top-4 right-4 bottom-4 w-80 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl border border-white/50 transform transition-transform duration-300 flex flex-col z-[1000] ${isLayerPanelOpen ? 'translate-x-0' : 'translate-x-[120%]'}`}>
               <LayerManager 
                  layers={layers}
                  onToggle={toggleLayerVisibility}
                  onDelete={deleteLayer}
                  onStyleChange={updateLayerStyle}
                  onZoom={setZoomToLayerId}
                  onEdit={handleStartEditLayer}
                  onPickFetchLocation={() => setIsPickingFetch(true)}
                  isPickingFetch={isPickingFetch}
                  fetchLocation={fetchLocation}
                  onExecuteFetch={handleFetchData}
                  onExecuteNadlanFetch={handleExecuteNadlanFetch}
                  isFetching={isLoading}
                  fetchRadius={fetchRadius}
                  onFetchRadiusChange={setFetchRadius}
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}