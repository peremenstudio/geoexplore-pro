import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { LayerManager } from './components/LayerManager';
import { MapArea } from './components/MapArea';
import { MapboxMap } from './components/MapboxMap';
import { DataExplorer } from './components/DataExplorer';
import { ExploreView } from './components/ExploreView';
import { AnalyzeView } from './components/AnalyzeView';
import { LamasFileLoader } from './components/LamasFileLoader';
import { SalesRecordsLoader } from './components/SalesRecordsLoader';
import { processFile } from './utils/fileProcessor';
import { fetchNominatimPlaces } from './utils/nominatim';
import { fetchOverpassData } from './utils/overpass';
import { fetchDetailedNadlanTransactions } from './utils/nadlanApi';
import { fetchTelAvivSportsFields, fetchTelAvivLayers, fetchTelAvivLayerData, findMatchingLayers, GISLayerInfo } from './utils/telAvivGis';
import { matchQueryToGISLayer } from './utils/aiAgent';
import { fetchJerusalemLayers, fetchJerusalemLayerData } from './utils/jerusalemGis';
import { fetchHaifaLayers, fetchHaifaLayerData } from './utils/haifaGis';
import { getNextLayerColor } from './utils/layerColors';
import { fetchNearbyPlaces, placesToGeoJSON, getDailyUsageStats, getCategoryDisplay, DailyUsageStats } from './utils/googlePlaces';
import { detectLayerType } from './utils/detectLayerType';
import { Layer, AppView } from './types';
import { Menu, Map as MapIcon, Database, Layers, Compass, BarChart3, Loader2, Box, Download, Globe, Home, Crosshair, Search, Info, Building, Flag, ShoppingCart, ChevronDown, ChevronRight } from 'lucide-react';
import { Feature, GeoJsonProperties } from 'geojson';

export default function App() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeView, setActiveView] = useState<AppView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
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
  const [expandedCategory, setExpandedCategory] = useState<'urban' | 'national' | 'sales' | 'commercial' | null>(null);
  const [telAvivLayers, setTelAvivLayers] = useState<GISLayerInfo[]>([]);
  const [telAvivQuery, setTelAvivQuery] = useState('');
  const [telAvivSuggestions, setTelAvivSuggestions] = useState<GISLayerInfo[]>([]);
  const [showAllTelAvivLayers, setShowAllTelAvivLayers] = useState(false);
  const [jerusalemLayers, setJerusalemLayers] = useState<GISLayerInfo[]>([]);
  const [jerusalemQuery, setJerusalemQuery] = useState('');
  const [jerusalemSuggestions, setJerusalemSuggestions] = useState<GISLayerInfo[]>([]);
  const [showAllJerusalemLayers, setShowAllJerusalemLayers] = useState(false);
  const [haifaLayers, setHaifaLayers] = useState<GISLayerInfo[]>([]);
  const [haifaQuery, setHaifaQuery] = useState('');
  const [haifaSuggestions, setHaifaSuggestions] = useState<GISLayerInfo[]>([]);
  const [showAllHaifaLayers, setShowAllHaifaLayers] = useState(false);
  const [selectedCity, setSelectedCity] = useState<string>('');
  
  // Google Places State
  const [googlePlacesCategory, setGooglePlacesCategory] = useState('restaurant');
  const [googlePlacesLayerName, setGooglePlacesLayerName] = useState('Google Places Search');
  const [googlePlacesRadius, setGooglePlacesRadius] = useState(1000);
  const [googlePlacesUsage, setGooglePlacesUsage] = useState<DailyUsageStats | null>(null);
  const [isPickingGooglePlaces, setIsPickingGooglePlaces] = useState(false);
  const [googlePlacesLocation, setGooglePlacesLocation] = useState<{lat: number, lng: number} | null>(null);

  // Analyze State
  const [analyzedLayerId, setAnalyzedLayerId] = useState<string | null>(null);
  const [filteredFeatures, setFilteredFeatures] = useState<Feature[] | null>(null);
  // Persist filters and selected attributes per layer
  const [layerFilters, setLayerFilters] = useState<Record<string, Record<string, string[] | { min: number; max: number }>>>({});
  const [layerSelectedAttributes, setLayerSelectedAttributes] = useState<Record<string, string[]>>({});

  // Polygon Selection State
  const [selectedPolygon, setSelectedPolygon] = useState<{ layerId: string; featureIndex: number; feature: Feature } | null>(null);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState(false);

  // Computed Layers for Map - apply filters to all views
  const displayLayers = useMemo(() => {
    if (!analyzedLayerId || !filteredFeatures) {
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
  }, [layers, analyzedLayerId, filteredFeatures]);

  useEffect(() => {
    // Load Tel Aviv layers on mount
    const loadTelAvivLayers = async () => {
      try {
        const layers = await fetchTelAvivLayers();
        setTelAvivLayers(layers);
      } catch (err) {
        console.error('Failed to load Tel Aviv layers:', err);
      }
    };
    loadTelAvivLayers();
  }, []);

  useEffect(() => {
    // Load Jerusalem layers on mount
    const loadJerusalemLayers = async () => {
      try {
        const layers = await fetchJerusalemLayers();
        setJerusalemLayers(layers);
      } catch (err) {
        console.error('Failed to load Jerusalem layers:', err);
      }
    };
    loadJerusalemLayers();
  }, []);

  useEffect(() => {
    // Load Haifa layers on mount
    const loadHaifaLayers = async () => {
      try {
        const layers = await fetchHaifaLayers();
        setHaifaLayers(layers);
      } catch (err) {
        console.error('Failed to load Haifa layers:', err);
      }
    };
    loadHaifaLayers();
  }, []);

  useEffect(() => {
    // Load Google Places usage stats
    const stats = getDailyUsageStats();
    setGooglePlacesUsage(stats);
  }, []);

  useEffect(() => {
    // Listen for copy polygon event from MapboxMap
    const handleCopyPolygonEvent = () => {
      if (selectedPolygon) {
        setShowCopyConfirmation(true);
      }
    };
    
    window.addEventListener('copyPolygon', handleCopyPolygonEvent);
    return () => {
      window.removeEventListener('copyPolygon', handleCopyPolygonEvent);
    };
  }, [selectedPolygon]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, nameOverride: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const geojson = await processFile(file);
      const layerType = detectLayerType(geojson);
      const newLayer: Layer = {
        id: `layer-${Date.now()}`,
        name: nameOverride || file.name.split('.')[0],
        visible: true,
        data: geojson,
        color: getNextLayerColor(),
        opacity: 0.7,
        type: layerType,
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

  const handleConvertToPoints = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer || layer.type !== 'polygon') return;

    // Calculate centroids for each polygon
    const centroidFeatures: Feature[] = layer.data.features.map(feature => {
      let centroid: [number, number];
      
      if (feature.geometry.type === 'Polygon') {
        // Calculate centroid of polygon
        const coords = feature.geometry.coordinates[0]; // outer ring
        let cx = 0, cy = 0;
        for (const coord of coords) {
          cx += coord[0];
          cy += coord[1];
        }
        centroid = [cx / coords.length, cy / coords.length];
      } else if (feature.geometry.type === 'MultiPolygon') {
        // For MultiPolygon, take centroid of first polygon
        const coords = feature.geometry.coordinates[0][0]; // first polygon, outer ring
        let cx = 0, cy = 0;
        for (const coord of coords) {
          cx += coord[0];
          cy += coord[1];
        }
        centroid = [cx / coords.length, cy / coords.length];
      } else {
        return null;
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: centroid
        },
        properties: { ...feature.properties } // Copy all properties
      } as Feature;
    }).filter(f => f !== null) as Feature[];

    // Create new layer with centroids
    const newLayer: Layer = {
      id: `centroids-${Date.now()}`,
      name: `${layer.name} - Centroids`,
      visible: true,
      data: {
        type: 'FeatureCollection',
        features: centroidFeatures
      },
      color: layer.color,
      opacity: 0.8,
      type: 'point',
      grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
      lastUpdated: Date.now()
    };

    setLayers(prev => [...prev, newLayer]);
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

        const geojson = { type: 'FeatureCollection' as const, features: cleanFeatures };
        const layerType = detectLayerType(geojson);
        const newLayer: Layer = {
            id: `layer-${Date.now()}`,
            name: pendingLayerName,
            visible: true,
            data: geojson,
            color: getNextLayerColor(),
            opacity: 1,
            type: layerType,
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

    if (isPickingGooglePlaces) {
        setGooglePlacesLocation({ lat, lng });
        setIsPickingGooglePlaces(false);
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
            const geojson = { type: 'FeatureCollection' as const, features };
            const layerType = detectLayerType(geojson);
            const newLayer: Layer = {
                id: `fetched-${Date.now()}`,
                name: config.name || `${config.query} (OSM)`,
                visible: true,
                data: geojson,
                color: getNextLayerColor(),
                opacity: 1,
                type: layerType,
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
            const geojson = { type: 'FeatureCollection' as const, features };
            const layerType = detectLayerType(geojson);
            const newLayer: Layer = {
                id: `nadlan-${Date.now()}`,
                name: `עסקאות: ${city}`,
                visible: true,
                data: geojson,
                color: getNextLayerColor(),
                opacity: 1,
                type: layerType,
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

  const handleTelAvivQueryChange = (value: string) => {
    setTelAvivQuery(value);
    
    // Show suggestions in real-time
    if (value.trim() && telAvivLayers.length > 0) {
      const matches = findMatchingLayers(value, telAvivLayers);
      setTelAvivSuggestions(matches);
    } else {
      setTelAvivSuggestions([]);
    }
  };

  const handleSelectTelAvivLayer = async (layerId: number, layerName: string) => {
    setIsLoading(true);
    try {
      console.log(`🎯 Selected layer: ${layerName} (ID: ${layerId})`);
      
      // Fetch data from selected layer
      const features = await fetchTelAvivLayerData(layerId);
      
      if (features.length === 0) {
        alert(`Layer "${layerName}" returned no data`);
        return;
      }

      const geojson = { type: 'FeatureCollection' as const, features };
      const layerType = detectLayerType(geojson);
      const newLayer: Layer = {
        id: `tel-aviv-${Date.now()}`,
        name: layerName,
        visible: true,
        data: geojson,
        color: getNextLayerColor(),
        opacity: 0.7,
        type: layerType,
        grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
        lastUpdated: Date.now()
      };
      setLayers(prev => [...prev, newLayer]);
      setZoomToLayerId(newLayer.id);
      setTelAvivQuery('');
      setTelAvivSuggestions([]);
    } catch (e: any) {
      alert(`Error fetching Tel Aviv data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJerusalemQueryChange = (value: string) => {
    setJerusalemQuery(value);

    if (value.trim() && jerusalemLayers.length > 0) {
      const matches = findMatchingLayers(value, jerusalemLayers);
      setJerusalemSuggestions(matches);
    } else {
      setJerusalemSuggestions([]);
    }
  };

  const handleSelectJerusalemLayer = async (layerId: number, layerName: string) => {
    setIsLoading(true);
    try {
      console.log(`🎯 Selected Jerusalem layer: ${layerName} (ID: ${layerId})`);

      const features = await fetchJerusalemLayerData(layerId);

      if (features.length === 0) {
        alert(`Layer "${layerName}" returned no data`);
        return;
      }

      const geojson = { type: 'FeatureCollection' as const, features };
      const layerType = detectLayerType(geojson);
      const newLayer: Layer = {
        id: `jerusalem-${Date.now()}`,
        name: layerName,
        visible: true,
        data: geojson,
        color: getNextLayerColor(),
        opacity: 0.7,
        type: layerType,
        grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
        lastUpdated: Date.now()
      };
      setLayers(prev => [...prev, newLayer]);
      setZoomToLayerId(newLayer.id);
      setJerusalemQuery('');
      setJerusalemSuggestions([]);
    } catch (e: any) {
      alert(`Error fetching Jerusalem data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHaifaQueryChange = (value: string) => {
    setHaifaQuery(value);

    if (value.trim() && haifaLayers.length > 0) {
      const matches = findMatchingLayers(value, haifaLayers);
      setHaifaSuggestions(matches);
    } else {
      setHaifaSuggestions([]);
    }
  };

  const handleSelectHaifaLayer = async (layer: GISLayerInfo) => {
    if (!layer.url) {
      alert('This Haifa layer does not have a data URL.');
      return;
    }

    setIsLoading(true);
    try {
      console.log(`🎯 Selected Haifa layer: ${layer.name} (${layer.serviceName || 'Service'})`);

      const features = await fetchHaifaLayerData(layer.url);

      if (features.length === 0) {
        alert(`Layer "${layer.name}" returned no data`);
        return;
      }

      const geojson = { type: 'FeatureCollection' as const, features };
      const layerType = detectLayerType(geojson);
      const newLayer: Layer = {
        id: `haifa-${Date.now()}`,
        name: layer.name,
        visible: true,
        data: geojson,
        color: getNextLayerColor(),
        opacity: 0.7,
        type: layerType,
        grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
        lastUpdated: Date.now()
      };
      setLayers(prev => [...prev, newLayer]);
      setZoomToLayerId(newLayer.id);
      setHaifaQuery('');
      setHaifaSuggestions([]);
    } catch (e: any) {
      alert(`Error fetching Haifa data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGooglePlacesSearch = () => {
    setIsPickingGooglePlaces(true);
    setActiveView('map');
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleGooglePlacesSearch = async () => {
    if (!googlePlacesLocation) return;
    
    setIsLoading(true);
    
    try {
      const places = await fetchNearbyPlaces({
        lat: googlePlacesLocation.lat,
        lng: googlePlacesLocation.lng,
        radius: googlePlacesRadius,
        type: googlePlacesCategory
      });

      if (places.length === 0) {
        alert(`No ${googlePlacesCategory} found within ${googlePlacesRadius}m`);
        return;
      }

      const features = placesToGeoJSON(places);
      const geojson = { type: 'FeatureCollection' as const, features };
      const layerType = detectLayerType(geojson);
      const newLayer: Layer = {
        id: `places-${Date.now()}`,
        name: googlePlacesLayerName || `${getCategoryDisplay(googlePlacesCategory)} (${places.length})`,
        visible: true,
        data: geojson,
        color: getNextLayerColor(),
        opacity: 0.7,
        type: layerType,
        grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
        lastUpdated: Date.now()
      };
      setLayers(prev => [...prev, newLayer]);
      setZoomToLayerId(newLayer.id);
      setGooglePlacesUsage(getDailyUsageStats());
      setGooglePlacesLocation(null);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchTelAvivLayer = async (layerType: string) => {
    setIsLoading(true);
    try {
        let features: Feature[] = [];
        let layerName = '';

        switch(layerType) {
            case 'sports':
                features = await fetchTelAvivSportsFields();
                layerName = 'Tel Aviv - Sports Fields';
                break;
            default:
                throw new Error('Unknown layer type');
        }

        if (features.length === 0) {
            alert(`No data found for ${layerName}`);
        } else {
            const geojson = { type: 'FeatureCollection' as const, features };
            const layerType = detectLayerType(geojson);
            const newLayer: Layer = {
                id: `tlv-${layerType}-${Date.now()}`,
                name: layerName,
                visible: true,
                data: geojson,
              color: getNextLayerColor(),
                opacity: 0.7,
                type: layerType,
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
      console.log('handleUpdateFeature called:', { layerId, featureIndex, newProperties });
      
      if (newProperties.Priority === 'Urgent') {
          newProperties._urgentTimestamp = Date.now();
      }
      if (layerId === 'draft-layer') {
          setDraftFeatures(prev => prev.map((f, idx) => idx === featureIndex ? { ...f, properties: { ...f.properties, ...newProperties } } : f));
        if (newProperties.Priority === 'Urgent') {
          setTimeout(() => {
            setDraftFeatures(current => current.map((f, idx) => idx === featureIndex ? { ...f } : f));
          }, 60000);
        }
          return;
      }
      setLayers(prev => {
        const updated = prev.map(l => l.id === layerId ? {
          ...l,
          data: { ...l.data, features: l.data.features.map((f, idx) => idx === featureIndex ? { ...f, properties: { ...f.properties, ...newProperties } } : f) },
          lastUpdated: Date.now()
        } : l);
        console.log('Updated layers:', updated);
        return updated;
      });
      if (newProperties.Priority === 'Urgent') {
        setTimeout(() => {
          setLayers(current => current.map(l => l.id === layerId ? { ...l, lastUpdated: Date.now() } : l));
        }, 60000);
      }
  };

  const handleAddLayer = (newLayer: Layer) => {
      setLayers(prev => [...prev, newLayer]);
  };

  const handleAddExploreLayer = (newLayer: Layer) => {
      setLayers(prev => [...prev, newLayer]);
      setActiveView('map');
      setZoomToLayerId(newLayer.id);
  };

  const handlePolygonClick = (layerId: string, featureIndex: number, feature: Feature) => {
    // If invalid indices, clear selection
    if (layerId === '' || featureIndex === -1) {
      setSelectedPolygon(null);
      return;
    }
    setSelectedPolygon({ layerId, featureIndex, feature });
  };

  const handleCopyPolygon = () => {
    if (!selectedPolygon) return;
    
    // Find the next boundary number
    const boundaryLayers = layers.filter(l => l.name.startsWith('boundary'));
    let maxNum = 0;
    boundaryLayers.forEach(l => {
      const match = l.name.match(/boundary\s*(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextNum = (maxNum + 1).toString().padStart(2, '0');
    
    const newLayer: Layer = {
      id: `boundary-${Date.now()}`,
      name: `boundary ${nextNum}`,
      visible: true,
      data: {
        type: 'FeatureCollection',
        features: [selectedPolygon.feature]
      },
      color: getNextLayerColor(),
      opacity: 0.7,
      type: 'polygon',
      grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
      lastUpdated: Date.now()
    };
    
    setLayers(prev => [...prev, newLayer]);
    setShowCopyConfirmation(false);
    setSelectedPolygon(null);
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
            onAddLayer={handleAddLayer}
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
          {/* Map - Resize based on active view */}
          <div className={`absolute inset-0 ${activeView === 'analyze' ? 'w-1/2' : 'w-full'}`}>
            {is3DMode ? (
              <MapboxMap 
                layers={displayLayers} 
                draftFeatures={draftFeatures}
                zoomToLayerId={zoomToLayerId}
                onZoomComplete={() => setZoomToLayerId(null)}
                onUpdateFeature={handleUpdateFeature}
                onAddLayer={handleAddLayer}
                isPickingLocation={isPickingLocation || isPickingFetch}
                isPickingGooglePlaces={isPickingGooglePlaces}
                onMapClick={handleMapClick}
                fetchLocation={fetchLocation}
                fetchRadius={fetchRadius}
                googlePlacesLocation={googlePlacesLocation}
                googlePlacesRadius={googlePlacesRadius}
                activeView={activeView}
              />
            ) : (
              <MapArea 
                layers={displayLayers} 
                draftFeatures={draftFeatures}
                zoomToLayerId={zoomToLayerId}
                onZoomComplete={() => setZoomToLayerId(null)}
                onUpdateFeature={handleUpdateFeature}
                onAddLayer={handleAddLayer}
                isPickingLocation={isPickingLocation || isPickingFetch}
                isPickingGooglePlaces={isPickingGooglePlaces}
                onMapClick={handleMapClick}
                fetchLocation={fetchLocation}
                fetchRadius={fetchRadius}
                googlePlacesLocation={googlePlacesLocation}
                googlePlacesRadius={googlePlacesRadius}
                activeView={activeView}
                onPolygonClick={handlePolygonClick}
                selectedPolygon={selectedPolygon}
              />
            )}
          </div>
          
          {activeView === 'analyze' && (
             <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-slate-50 z-20">
                 <AnalyzeView 
                    layers={layers}
                    layerFilters={layerFilters}
                    layerSelectedAttributes={layerSelectedAttributes}
                    onFilterChange={(layerId, features) => {
                        setAnalyzedLayerId(layerId);
                        setFilteredFeatures(features);
                    }}
                    onFiltersUpdate={(layerId, filters) => {
                        setLayerFilters(prev => ({
                            ...prev,
                            [layerId]: filters
                        }));
                    }}
                    onSelectedAttributesUpdate={(layerId, attributes) => {
                        setLayerSelectedAttributes(prev => ({
                            ...prev,
                            [layerId]: attributes
                        }));
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
                  onUpdateFeature={handleUpdateFeature}
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
                  onConvertToPoints={handleConvertToPoints}
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

                  <div className="flex-1 overflow-y-scroll p-4 pr-2 space-y-3">
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
                                <div className="space-y-3 relative">
                                  <label className="block text-xs font-semibold text-slate-600">Query Layer (e.g., "parks", "trees", "parking")</label>
                                  <div className="text-xs text-slate-500 mb-2">
                                    {telAvivLayers.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setShowAllTelAvivLayers(prev => !prev)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                                      >
                                        <span className="font-semibold text-slate-700">
                                          {showAllTelAvivLayers ? 'Hide all layers' : 'Show all layers'} ({telAvivLayers.length})
                                        </span>
                                        {showAllTelAvivLayers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>
                                    ) : (
                                      <div className="p-2 bg-slate-50 border border-slate-200 rounded">⏳ Loading layers...</div>
                                    )}
                                  </div>
                                  {showAllTelAvivLayers && telAvivLayers.length > 0 && (
                                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                                      <div className="p-2 space-y-1">
                                        {telAvivLayers.map(l => (
                                          <div key={l.id} className="text-xs text-slate-600">• {l.name}</div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <form onSubmit={(e) => { 
                                    e.preventDefault(); 
                                    if (telAvivSuggestions.length > 0) {
                                      handleSelectTelAvivLayer(telAvivSuggestions[0].id, telAvivSuggestions[0].name);
                                    } else if (telAvivQuery.trim() && telAvivLayers.length > 0) {
                                      // Fallback: try to find any partial match
                                      const any = telAvivLayers.find(l => l.name.toLowerCase().includes(telAvivQuery.toLowerCase()));
                                      if (any) handleSelectTelAvivLayer(any.id, any.name);
                                      else alert(`No layer found matching "${telAvivQuery}". Please refine your search.`);
                                    }
                                  }} className="relative">
                                    <input
                                      type="text"
                                      value={telAvivQuery}
                                      onChange={(e) => handleTelAvivQueryChange(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && telAvivSuggestions.length > 0) {
                                          e.preventDefault();
                                          handleSelectTelAvivLayer(telAvivSuggestions[0].id, telAvivSuggestions[0].name);
                                        }
                                      }}
                                      placeholder="Type to search layers..."
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                      autoComplete="off"
                                    />
                                    <button
                                      type="submit"
                                      disabled={isLoading || !telAvivQuery.trim()}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                      title="Fetch data"
                                    >
                                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    </button>
                                  </form>
                                  
                                  {/* Real-time suggestions */}
                                  {telAvivSuggestions.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
                                      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                        <p className="text-xs font-semibold text-slate-600 px-2 py-1 sticky top-0 bg-white">Did you mean?</p>
                                        {telAvivSuggestions.map((layer) => (
                                          <button
                                            key={layer.id}
                                            type="button"
                                            onClick={() => handleSelectTelAvivLayer(layer.id, layer.name)}
                                            disabled={isLoading}
                                            className="w-full text-left px-3 py-2 rounded hover:bg-purple-50 transition-all text-sm text-slate-700 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            <div className="font-medium truncate">{layer.name}</div>
                                            {layer.description && <div className="text-xs text-slate-500 truncate">{layer.description}</div>}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <p className="text-xs text-slate-500">Type a layer name and press Enter or click a suggestion</p>
                                </div>
                              )}

                              {selectedCity === 'jerusalem' && (
                                <div className="space-y-3 relative">
                                  <label className="block text-xs font-semibold text-slate-600">Query Layer (e.g., "roads", "schools", "parks")</label>
                                  <div className="text-xs text-slate-500 mb-2">
                                    {jerusalemLayers.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setShowAllJerusalemLayers(prev => !prev)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                                      >
                                        <span className="font-semibold text-slate-700">
                                          {showAllJerusalemLayers ? 'Hide all layers' : 'Show all layers'} ({jerusalemLayers.length})
                                        </span>
                                        {showAllJerusalemLayers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>
                                    ) : (
                                      <div className="p-2 bg-slate-50 border border-slate-200 rounded">⏳ Loading layers...</div>
                                    )}
                                  </div>
                                  {showAllJerusalemLayers && jerusalemLayers.length > 0 && (
                                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                                      <div className="p-2 space-y-1">
                                        {jerusalemLayers.map(l => (
                                          <div key={l.id} className="text-xs text-slate-600">• {l.name}</div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <form onSubmit={(e) => { 
                                    e.preventDefault(); 
                                    if (jerusalemSuggestions.length > 0) {
                                      handleSelectJerusalemLayer(jerusalemSuggestions[0].id, jerusalemSuggestions[0].name);
                                    } else if (jerusalemQuery.trim() && jerusalemLayers.length > 0) {
                                      const any = jerusalemLayers.find(l => l.name.toLowerCase().includes(jerusalemQuery.toLowerCase()));
                                      if (any) handleSelectJerusalemLayer(any.id, any.name);
                                      else alert(`No layer found matching "${jerusalemQuery}". Please refine your search.`);
                                    }
                                  }} className="relative">
                                    <input
                                      type="text"
                                      value={jerusalemQuery}
                                      onChange={(e) => handleJerusalemQueryChange(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && jerusalemSuggestions.length > 0) {
                                          e.preventDefault();
                                          handleSelectJerusalemLayer(jerusalemSuggestions[0].id, jerusalemSuggestions[0].name);
                                        }
                                      }}
                                      placeholder="Type to search layers..."
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                                      autoComplete="off"
                                    />
                                    <button
                                      type="submit"
                                      disabled={isLoading || !jerusalemQuery.trim()}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                      title="Fetch data"
                                    >
                                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    </button>
                                  </form>

                                  {jerusalemSuggestions.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
                                      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                        <p className="text-xs font-semibold text-slate-600 px-2 py-1 sticky top-0 bg-white">Did you mean?</p>
                                        {jerusalemSuggestions.map((layer) => (
                                          <button
                                            key={layer.id}
                                            type="button"
                                            onClick={() => handleSelectJerusalemLayer(layer.id, layer.name)}
                                            disabled={isLoading}
                                            className="w-full text-left px-3 py-2 rounded hover:bg-sky-50 transition-all text-sm text-slate-700 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            <div className="font-medium truncate">{layer.name}</div>
                                            {layer.description && <div className="text-xs text-slate-500 truncate">{layer.description}</div>}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <p className="text-xs text-slate-500">Type a layer name and press Enter or click a suggestion</p>
                                </div>
                              )}

                              {selectedCity === 'haifa' && (
                                <div className="space-y-3 relative">
                                  <label className="block text-xs font-semibold text-slate-600">Query Layer (e.g., "roads", "parks", "utilities")</label>
                                  <div className="text-xs text-slate-500 mb-2">
                                    {haifaLayers.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setShowAllHaifaLayers(prev => !prev)}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                                      >
                                        <span className="font-semibold text-slate-700">
                                          {showAllHaifaLayers ? 'Hide all layers' : 'Show all layers'} ({haifaLayers.length})
                                        </span>
                                        {showAllHaifaLayers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      </button>
                                    ) : (
                                      <div className="p-2 bg-slate-50 border border-slate-200 rounded">⏳ Loading layers...</div>
                                    )}
                                  </div>
                                  {showAllHaifaLayers && haifaLayers.length > 0 && (
                                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                                      <div className="p-2 space-y-1">
                                        {haifaLayers.map(l => (
                                          <div key={`${l.serviceName || 'service'}-${l.id}`} className="text-xs text-slate-600">
                                            • {l.name}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <form onSubmit={(e) => { 
                                    e.preventDefault(); 
                                    if (haifaSuggestions.length > 0) {
                                      handleSelectHaifaLayer(haifaSuggestions[0]);
                                    } else if (haifaQuery.trim() && haifaLayers.length > 0) {
                                      const any = haifaLayers.find(l => l.name.toLowerCase().includes(haifaQuery.toLowerCase()));
                                      if (any) handleSelectHaifaLayer(any);
                                      else alert(`No layer found matching "${haifaQuery}". Please refine your search.`);
                                    }
                                  }} className="relative">
                                    <input
                                      type="text"
                                      value={haifaQuery}
                                      onChange={(e) => handleHaifaQueryChange(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && haifaSuggestions.length > 0) {
                                          e.preventDefault();
                                          handleSelectHaifaLayer(haifaSuggestions[0]);
                                        }
                                      }}
                                      placeholder="Type to search layers..."
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                                      autoComplete="off"
                                    />
                                    <button
                                      type="submit"
                                      disabled={isLoading || !haifaQuery.trim()}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                      title="Fetch data"
                                    >
                                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                    </button>
                                  </form>

                                  {haifaSuggestions.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden">
                                      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                        <p className="text-xs font-semibold text-slate-600 px-2 py-1 sticky top-0 bg-white">Did you mean?</p>
                                        {haifaSuggestions.map((layer) => (
                                          <button
                                            key={`${layer.serviceName || 'service'}-${layer.id}`}
                                            type="button"
                                            onClick={() => handleSelectHaifaLayer(layer)}
                                            disabled={isLoading}
                                            className="w-full text-left px-3 py-2 rounded hover:bg-green-50 transition-all text-sm text-slate-700 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            <div className="font-medium truncate">{layer.name}</div>
                                            {layer.description && <div className="text-xs text-slate-500 truncate">{layer.description}</div>}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <p className="text-xs text-slate-500">Type a layer name and press Enter or click a suggestion</p>
                                </div>
                              )}

                              {selectedCity !== 'tel-aviv' && selectedCity !== 'jerusalem' && selectedCity !== 'haifa' && (
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
                          <LamasFileLoader onAddLayer={handleAddLayer} />
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
                        <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4">
                          <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3">Google Maps Places</h3>
                            
                            {/* Google Places Usage Bar */}
                            {googlePlacesUsage && (
                              <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-slate-600">Daily Usage</span>
                                  <span className="text-xs text-slate-500">{googlePlacesUsage.requestsToday} / {googlePlacesUsage.requestsLimit.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-amber-500 h-2 rounded-full transition-all"
                                    style={{ width: `${googlePlacesUsage.percentageUsed}%` }}
                                  />
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Remaining: {googlePlacesUsage.estimatedRemaining.toLocaleString()} requests</p>
                              </div>
                            )}

                            {/* Settings */}
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Layer Name</label>
                                <input
                                  type="text"
                                  value={googlePlacesLayerName}
                                  onChange={(e) => setGooglePlacesLayerName(e.target.value)}
                                  placeholder="e.g., Restaurants in Tel Aviv"
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                                <select
                                  value={googlePlacesCategory}
                                  onChange={(e) => setGooglePlacesCategory(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white"
                                >
                                  <option value="restaurant">🍽️ Restaurant</option>
                                  <option value="cafe">☕ Café</option>
                                  <option value="bar">🍺 Bar</option>
                                  <option value="hotel">🏨 Hotel</option>
                                  <option value="shop">🛍️ Shop</option>
                                  <option value="supermarket">🛒 Supermarket</option>
                                  <option value="pharmacy">💊 Pharmacy</option>
                                  <option value="hospital">🏥 Hospital</option>
                                  <option value="park">🌳 Park</option>
                                  <option value="museum">🏛️ Museum</option>
                                  <option value="library">📚 Library</option>
                                  <option value="school">🎓 School</option>
                                  <option value="bank">🏦 Bank</option>
                                  <option value="atm">💰 ATM</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-2">Search Radius</label>
                                <div className="space-y-2">
                                  {[500, 1000, 2000, 5000, 10000].map(radius => (
                                    <label key={radius} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="radius"
                                        value={radius}
                                        checked={googlePlacesRadius === radius}
                                        onChange={(e) => setGooglePlacesRadius(parseInt(e.target.value))}
                                        className="w-4 h-4 accent-amber-600"
                                      />
                                      <span className="text-sm text-slate-700">{(radius / 1000).toFixed(1)} km ({radius}m)</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={handleStartGooglePlacesSearch}
                                disabled={isLoading || isPickingGooglePlaces || !!googlePlacesLocation}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {isPickingGooglePlaces ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Click on map
                                  </>
                                ) : googlePlacesLocation ? (
                                  <>
                                    ✓ Location picked
                                  </>
                                ) : (
                                  <>
                                    <Crosshair size={16} />
                                    Pick a Place
                                  </>
                                )}
                              </button>

                              {googlePlacesLocation && (
                                <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 text-xs">
                                  <p className="text-slate-600">📍 <span className="font-semibold">{googlePlacesLocation.lat.toFixed(4)}, {googlePlacesLocation.lng.toFixed(4)}</span></p>
                                </div>
                              )}

                              {googlePlacesLocation && (
                                <button
                                  onClick={handleGooglePlacesSearch}
                                  disabled={isLoading}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  {isLoading ? (
                                    <>
                                      <Loader2 size={16} className="animate-spin" />
                                      Fetching...
                                    </>
                                  ) : (
                                    <>
                                      <Download size={16} />
                                      Fetch
                                    </>
                                  )}
                                </button>
                              )}

                              {googlePlacesLocation && (
                                <button
                                  onClick={() => setGooglePlacesLocation(null)}
                                  disabled={isLoading}
                                  className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 disabled:opacity-50 transition-all text-sm"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sales record Category */}
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === 'sales' ? null : 'sales')}
                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <BarChart3 size={16} className="text-blue-600" />
                          </div>
                          <span className="font-semibold text-slate-800">Sales record</span>
                        </div>
                        {expandedCategory === 'sales' ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      </button>

                      {expandedCategory === 'sales' && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50">
                          <SalesRecordsLoader onAddLayer={handleAddLayer} />
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

      {/* Copy Polygon Confirmation Modal */}
      {showCopyConfirmation && selectedPolygon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Create a Copy?</h2>
            <p className="text-sm text-slate-600 mb-6">
              Are you want to create a copy of the element?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCopyPolygon}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors text-sm"
              >
                Yes, Copy
              </button>
              <button
                onClick={() => {
                  setShowCopyConfirmation(false);
                  setSelectedPolygon(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
