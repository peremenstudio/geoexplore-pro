import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents, Circle, Pane } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layer } from '../types';
import { Edit2, Save, X, Plus, Check, Pencil, Scissors } from 'lucide-react';
import { Feature, GeoJsonProperties, FeatureCollection, Geometry } from 'geojson';

interface MapAreaProps {
  layers: Layer[];
  draftFeatures?: Feature[];
  zoomToLayerId?: string | null;
  onZoomComplete?: () => void;
  onUpdateFeature?: (layerId: string, featureIndex: number, newProperties: GeoJsonProperties) => void;
  onAddLayer?: (layer: Layer) => void;
  isPickingLocation?: boolean;
  isPickingGooglePlaces?: boolean;
  onMapClick?: (lat: number, lng: number) => void; 
  fetchLocation?: { lat: number, lng: number } | null;
  fetchRadius?: number;
  googlePlacesLocation?: { lat: number, lng: number } | null;
  googlePlacesRadius?: number;
  activeView?: string;
  onPolygonClick?: (layerId: string, featureIndex: number, feature: Feature) => void;
  selectedPolygon?: { layerId: string; featureIndex: number; feature: Feature } | null;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Invisible icon for anchoring labels exactly in the center of grid cells
const labelAnchorIcon = L.divIcon({
    className: '', 
    html: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
});

// --- Map Events Component ---
const MapEvents: React.FC<{ 
  isPickingLocation?: boolean;
  isPickingGooglePlaces?: boolean; 
  onMapClick?: (lat: number, lng: number) => void;
  onPolygonClick?: (layerId: string, featureIndex: number, feature: Feature) => void;
}> = ({ isPickingLocation, isPickingGooglePlaces, onMapClick, onPolygonClick }) => {
  const map = useMap();
  const isPickingAny = isPickingLocation || isPickingGooglePlaces;

  useEffect(() => {
    if (isPickingAny) {
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }
  }, [isPickingAny, map]);

  useMapEvents({
    click(e) {
      if (isPickingAny && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
      // Don't clear polygon selection here - let the polygon click handler manage it
      // and only clear if clicking truly on empty space (handled by checking if target is the map container)
    },
  });

  return null;
};

// Component to handle clearing polygon selection on background click
const ClearSelectionOnMapClick: React.FC<{
  onPolygonClick?: (layerId: string, featureIndex: number, feature: Feature) => void;
}> = ({ onPolygonClick }) => {
  const map = useMap();

  useEffect(() => {
    if (!onPolygonClick) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Only clear if clicking on the map container itself (not on a feature)
      const target = e.originalEvent?.target as HTMLElement;
      if (target?.classList?.contains('leaflet-container') || 
          target?.classList?.contains('leaflet-pane') ||
          target?.closest('.leaflet-tile-pane')) {
        onPolygonClick('', -1, {} as Feature);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, onPolygonClick]);

  return null;
};

// --- Feature Popup Component ---
const FeaturePopup: React.FC<{
    properties: GeoJsonProperties;
    schema: string[];
    onSave: (newProps: GeoJsonProperties) => void;
    onClose: () => void;
}> = ({ properties, schema, onSave, onClose }) => {
    // Automatically start in edit mode if _isNew is true OR if name is empty (legacy)
    const [isEditing, setIsEditing] = useState(!!properties?._isNew || properties?.name === '');
    const [editedProps, setEditedProps] = useState<GeoJsonProperties>(properties);
    
    // State for adding new property
    const [isAddingProp, setIsAddingProp] = useState(false);
    const [newPropName, setNewPropName] = useState('');

    useEffect(() => {
        const initialProps = { ...properties };
        schema.forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(initialProps, key)) {
                initialProps[key] = (key === 'Priority') ? "None" : "";
            }
        });
        setEditedProps(initialProps);

        if (properties?._isNew || (properties?.name === '' && Object.prototype.hasOwnProperty.call(properties, 'name'))) {
            setIsEditing(true);
        }
    }, [properties, schema]);

    const handleSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSave(editedProps);
        setIsEditing(false);
        setIsAddingProp(false);
        onClose(); 
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(false);
        setIsAddingProp(false);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleAddProperty = () => {
        if (!newPropName.trim()) return;
        const keyName = newPropName.trim();
        if (editedProps && Object.prototype.hasOwnProperty.call(editedProps, keyName)) {
            alert('Property name already exists');
            return;
        }
        setEditedProps(prev => ({ ...prev, [keyName]: (keyName === 'Priority') ? 'None' : '' }));
        setNewPropName('');
        setIsAddingProp(false);
    };

    const stopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    if (isEditing) {
        const keysToRender = Array.from(new Set([...schema, ...Object.keys(editedProps || {})])).sort();

        return (
            <div className="w-full min-w-[260px]" onClick={stopPropagation}>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                    <h3 className="font-bold text-sm text-slate-800">Edit Feature</h3>
                    <div className="flex gap-1">
                         <button onClick={handleSave} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors" title="Save">
                            <Save size={16} />
                         </button>
                         <button onClick={handleCancel} className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors" title="Cancel">
                            <X size={16} />
                         </button>
                    </div>
                </div>
                
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {keysToRender.map((key) => {
                         if (key.startsWith('_')) return null;
                         const value = editedProps[key];
                         return (
                            <div key={key} className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{key}</label>
                                {key === 'id' ? (
                                    <input 
                                        type="text"
                                        value={String(value ?? '')}
                                        disabled
                                        className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded bg-slate-100 text-slate-500"
                                    />
                                ) : key === 'Priority' ? (
                                    <select 
                                        value={String(value ?? 'None')}
                                        onChange={(e) => setEditedProps(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-coral-500 outline-none transition-shadow bg-white cursor-pointer"
                                    >
                                        <option value="None">None</option>
                                        <option value="Urgent">Urgent</option>
                                        <option value="Normal">Normal</option>
                                        <option value="Low">Low</option>
                                    </select>
                                ) : (
                                    <input 
                                        type="text"
                                        value={String(value ?? '')}
                                        onChange={(e) => setEditedProps(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:ring-2 focus:ring-coral-500 outline-none transition-shadow bg-white"
                                        autoFocus={key === 'name'}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100">
                    {!isAddingProp ? (
                         <button 
                            onClick={(e) => { e.stopPropagation(); setIsAddingProp(true); }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-coral-600 hover:text-indigo-800 hover:bg-coral-50 px-2 py-1.5 rounded transition-colors w-full justify-center border border-dashed border-coral-200"
                        >
                            <Plus size={14} /> Add Property
                        </button>
                    ) : (
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 animate-in fade-in slide-in-from-top-1 duration-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">New Property Name</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={newPropName}
                                    onChange={(e) => setNewPropName(e.target.value)}
                                    placeholder="e.g. category"
                                    className="flex-1 text-sm px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-coral-500 outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if(e.key === 'Enter') handleAddProperty();
                                        if(e.key === 'Escape') setIsAddingProp(false);
                                    }}
                                />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleAddProperty(); }}
                                    disabled={!newPropName.trim()}
                                    className="p-1.5 bg-coral-600 text-white rounded hover:bg-coral-700 disabled:opacity-50 transition-colors"
                                >
                                    <Check size={16} />
                                </button>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); setIsAddingProp(false); }}
                                    className="p-1.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-100 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full min-w-[200px]" onClick={stopPropagation}>
             <div className="flex items-center justify-between mb-2 border-b border-gray-100 pb-1">
                 <h3 className="font-bold text-sm text-slate-700">Properties</h3>
                 <button 
                    onClick={handleEdit}
                    className="p-1.5 hover:bg-slate-100 rounded text-coral-600 transition-colors"
                    title="Edit"
                 >
                     <Edit2 size={14} />
                 </button>
             </div>
             <div className="space-y-1 max-h-52 overflow-y-auto text-sm custom-scrollbar pr-1">
                {schema.map((key) => {
                    if (key.startsWith('_')) return null;
                    const value = properties ? properties[key] : undefined;
                    return (
                        <div key={key} className="grid grid-cols-3 gap-2 border-b border-dotted border-slate-100 last:border-0 py-1.5">
                            <span className="font-medium text-slate-500 truncate col-span-1" title={key}>{key}:</span>
                            <span className="text-slate-800 col-span-2 break-words leading-tight min-h-[1.25em]">
                                {value !== undefined && value !== null && String(value) !== '' ? (
                                    String(value).startsWith('http') ? 
                                    <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-coral-600 underline hover:text-indigo-800">Link</a> 
                                    : String(value)
                                ) : <span className="text-slate-300 italic text-xs">empty</span>}
                            </span>
                        </div>
                    );
                })}
                {schema.length === 0 && (
                     <div className="text-xs text-slate-400 italic">No properties available.</div>
                )}
             </div>
        </div>
    );
};

// Component to handle bounds fitting when layers change
const BoundsHandler: React.FC<{ layers: Layer[] }> = ({ layers }) => {
    const map = useMap();
    useEffect(() => {
        if (layers.length === 0) return;
        const lastLayer = layers[layers.length - 1];
        if (!lastLayer.visible) return;
        try {
            const geoLayer = L.geoJSON(lastLayer.data);
            const bounds = geoLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            }
        } catch (e) {
            console.warn("Invalid bounds", e);
        }
    }, [layers.length]); 
    return null;
};

// Component to handle explicit zoom requests
const ZoomController: React.FC<{ 
    zoomToLayerId?: string | null; 
    layers: Layer[]; 
    onComplete?: () => void; 
}> = ({ zoomToLayerId, layers, onComplete }) => {
    const map = useMap();
    useEffect(() => {
        if (!zoomToLayerId) return;
        const layer = layers.find(l => l.id === zoomToLayerId);
        if (layer && layer.data) {
             try {
                const geoLayer = L.geoJSON(layer.data);
                const bounds = geoLayer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                }
            } catch (e) {
                console.warn("Could not zoom to layer", e);
            }
        }
        onComplete?.();
    }, [zoomToLayerId, layers, map, onComplete]);
    return null;
};

// Manual Leaflet Grid Layer for Performance
const GridLayerManual: React.FC<{ layer: Layer }> = ({ layer }) => {
    const map = useMap();
    const layerRef = useRef<L.LayerGroup | null>(null);

    // Calculate grid data (Memoized)
    const gridData = useMemo(() => {
        if (!layer.grid.show || !layer.visible) return null;
        
        let bounds: L.LatLngBounds;
        try {
            bounds = L.geoJSON(layer.data).getBounds();
        } catch (e) {
            return null;
        }

        if (!bounds.isValid()) return null;

        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const west = bounds.getWest();
        const startLat = south;
        const startLng = west;

        // Calculate steps
        const gridSizeKm = Math.max(layer.grid.size, 0.05); // Minimum grid size clamp
        const latStep = gridSizeKm / 111;
        const centerLat = (north + south) / 2;
        const cosLat = Math.max(Math.cos(centerLat * Math.PI / 180), 0.0001);
        const lngStep = (gridSizeKm / 111) / cosLat;
        
        const cellMap = new Map<string, number>();

        layer.data.features.forEach(f => {
            if (f.geometry.type === 'Point') {
                const [lng, lat] = f.geometry.coordinates;
                if (typeof lat !== 'number' || typeof lng !== 'number') return;
                
                const col = Math.floor((lng - startLng) / lngStep);
                const row = Math.floor((lat - startLat) / latStep);
                const key = `${row}:${col}`;
                cellMap.set(key, (cellMap.get(key) || 0) + 1);
            }
        });

        const features: Feature[] = [];
        const labels: { lat: number; lng: number; count: number }[] = [];
        let maxC = 1;
        
        // Strict limit for performance
        const maxCells = 5000; 
        let countProcessed = 0;

        for (const [key, count] of cellMap.entries()) {
             if (countProcessed >= maxCells) break;
             if (count > maxC) maxC = count;

             const [rStr, cStr] = key.split(':');
             const r = parseInt(rStr, 10);
             const c = parseInt(cStr, 10);

             const cellSouth = startLat + (r * latStep);
             const cellWest = startLng + (c * lngStep);
             const cellNorth = cellSouth + latStep;
             const cellEast = cellWest + lngStep;

             const polygon: Feature = {
                 type: 'Feature',
                 geometry: {
                     type: 'Polygon',
                     coordinates: [[
                         [cellWest, cellSouth],
                         [cellWest, cellNorth],
                         [cellEast, cellNorth],
                         [cellEast, cellSouth],
                         [cellWest, cellSouth]
                     ]]
                 },
                 properties: { count }
             };
             features.push(polygon);
             
             // Only add labels if total cells is manageable
             if (layer.grid.showLabels && cellMap.size < 1000) {
                 labels.push({
                     lat: (cellSouth + cellNorth) / 2,
                     lng: (cellWest + cellEast) / 2,
                     count
                 });
             }
             countProcessed++;
        }

        return {
            features: { type: 'FeatureCollection', features } as FeatureCollection,
            maxCount: maxC,
            labels
        };
    }, [layer.grid.show, layer.grid.size, layer.visible, layer.data, layer.grid.showLabels]);

    // Side Effect: Manage Leaflet Layer
    useEffect(() => {
        // Cleanup function for when deps change or unmount
        const cleanup = () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };

        if (!gridData) {
            cleanup();
            return;
        }

        // 1. Create Group
        const group = L.layerGroup();

        // 2. Create Vector Layer
        const geoJsonLayer = L.geoJSON(gridData.features, {
            style: (feature) => {
                const count = feature?.properties?.count || 0;
                const intensity = count / gridData.maxCount;
                const fillOpacity = count > 0 ? (0.2 + (intensity * 0.6)) * layer.grid.opacity : 0;
                return {
                    fillColor: '#ef4444',
                    fillOpacity: fillOpacity,
                    color: '#334155',
                    weight: 0.5,
                    opacity: 0.2, 
                    interactive: false 
                };
            },
            interactive: false
        });
        group.addLayer(geoJsonLayer);

        // 3. Create Labels (only if exists)
        if (gridData.labels.length > 0) {
            gridData.labels.forEach(l => {
                const marker = L.marker([l.lat, l.lng], {
                    icon: labelAnchorIcon,
                    interactive: false,
                    zIndexOffset: 1000
                });
                marker.bindTooltip(String(l.count), {
                     permanent: true,
                     direction: 'center',
                     className: 'grid-label-tooltip',
                     opacity: 1
                });
                group.addLayer(marker);
            });
        }

        // 4. Add to map
        group.addTo(map);
        layerRef.current = group;

        return cleanup;
    }, [gridData, map, layer.grid.opacity]); // Re-run when data or visual style changes

    return null; // This component renders nothing in React DOM, it manages Leaflet directly
};


// Isolated Layer Renderer to handle schema calculation
const LayerRenderer: React.FC<{
    layer: Layer;
    onUpdateFeature?: (layerId: string, featureIndex: number, newProperties: GeoJsonProperties) => void;
    onPolygonClick?: (layerId: string, featureIndex: number, feature: Feature) => void;
}> = ({ layer, onUpdateFeature, onPolygonClick }) => {
    
    // Calculate schema (union of all keys in this layer)
    const layerSchema = useMemo(() => {
        const keys = new Set<string>();
        layer.data.features.forEach(f => {
            if (f.properties) {
                Object.keys(f.properties).forEach(k => {
                    if (!k.startsWith('_')) keys.add(k);
                });
            }
        });
        return Array.from(keys).sort();
    }, [layer.data]);

    // Track overlapping coordinates during rendering
    // This map resets every time the component renders (which happens when layer key changes)
    const coordCounts = new Map<string, number>();

    if (!layer.visible) return null;

    return (
        <React.Fragment>
            <GeoJSON 
                key={`layer-geo-${layer.id}-${layer.lastUpdated}`} 
                data={layer.data}
                style={() => ({
                    color: layer.color,
                    weight: 1.5, 
                    opacity: layer.opacity,
                    fillOpacity: layer.opacity * 0.5,
                    radius: layer.id === 'draft-layer' ? 6 : 4
                })}
                pointToLayer={(feature, latlng) => {
                    // Logic to handle Overlapping Points (Concentric Rings)
                    const key = `${latlng.lat.toFixed(5)},${latlng.lng.toFixed(5)}`;
                    const count = coordCounts.get(key) || 0;
                    coordCounts.set(key, count + 1);

                    const isDraft = layer.id === 'draft-layer';
                    const baseRadius = isDraft ? 6 : 4;
                    
                    // If count > 0, it's an overlapping point.
                    // Increase radius for each subsequent point to create rings.
                    const isUrgent = feature.properties?.Priority === 'Urgent';
                    const urgentColor = '#ef4444'; // Red

                    const radiusStep = 3.5; 
                    const urgentRadiusBoost = isUrgent ? 4 : 0;
                    const finalRadius = baseRadius + (count * radiusStep) + urgentRadiusBoost;
                    const isOverlap = count > 0;

                    // Priority Pulse Logic:
                    // Check if priority is 'Urgent' and if the update happened within the last 10 seconds.
                    let className = '';
                    let urgentPane: string | undefined;
                    if (isUrgent) {
                        const timestamp = feature.properties?._urgentTimestamp;
                        const now = Date.now();
                        // If timestamp exists and it was less than 60 seconds ago
                        if (timestamp && (now - timestamp < 60000)) {
                            className = 'urgent-pulse-effect';
                            urgentPane = 'urgentPane';
                        }
                    }

                    return L.circleMarker(latlng, {
                        radius: finalRadius,
                        // First point (center) gets filled. Overlaps (rings) are transparent.
                        fillColor: isUrgent ? urgentColor : (isOverlap ? 'transparent' : layer.color),
                        // Ring border is layer color. Center point border is white for contrast.
                        color: isUrgent ? urgentColor : (isOverlap ? layer.color : '#fff'),
                        // Thicker lines for rings
                        weight: isUrgent ? 2.5 : (isOverlap ? 2 : 1.5),
                        opacity: 1,
                        // Transparent fill for rings
                        fillOpacity: isUrgent ? 1 : (isOverlap ? 0 : (isDraft ? 0.9 : layer.opacity * 0.8)),
                        className: className,
                        pane: urgentPane
                    });
                }}
                onEachFeature={(feature, l) => {
                    const featureIndex = layer.data.features.indexOf(feature);
                    const isPolygon = feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon';
                    
                    // Special handling for polygons - use click event instead of popup
                    if (isPolygon && onPolygonClick) {
                        l.on('click', (e) => {
                            L.DomEvent.stopPropagation(e);
                            onPolygonClick(layer.id, featureIndex, feature);
                        });
                        return;
                    }
                    
                    // Regular popup handling for points/lines
                    // Lazy-load Popup Content
                    // Instead of creating a React Root for every feature immediately (which crashes with 10k+ points),
                    // we bind an empty div and mount React only when the popup opens.
                    
                    const container = L.DomUtil.create('div');
                    let root: Root | null = null;

                    l.bindPopup(container, {
                        minWidth: 280,
                        maxWidth: 400,
                        autoPanPadding: [20, 20]
                    });

                    l.on('popupopen', () => {
                        // We need the index in the original layer.data
                        const featureIndex = layer.data.features.indexOf(feature);
                        if (featureIndex === -1) return;

                        if (!root) {
                            root = createRoot(container);
                        }
                        
                        root.render(
                            <FeaturePopup 
                                properties={feature.properties || {}}
                                schema={layerSchema}
                                onSave={(newProps) => {
                                    if (onUpdateFeature) {
                                        onUpdateFeature(layer.id, featureIndex, newProps);
                                    }
                                    l.closePopup();
                                }}
                                onClose={() => l.closePopup()}
                            />
                        );
                    });

                    l.on('popupclose', () => {
                        if (root) {
                            root.unmount();
                            root = null;
                        }
                    });

                    if (feature.properties?._isNew) {
                        setTimeout(() => { l.openPopup(); }, 100);
                    }
                }}
            />
            {layer.id !== 'draft-layer' && <GridLayerManual layer={layer} />}
        </React.Fragment>
    );
};

export const MapArea: React.FC<MapAreaProps> = ({ 
    layers, 
    draftFeatures,
    zoomToLayerId, 
    onZoomComplete, 
    onUpdateFeature,
    onAddLayer,
    isPickingLocation,
    isPickingGooglePlaces, 
    onMapClick,
    fetchLocation,
    fetchRadius,
    googlePlacesLocation,
    googlePlacesRadius,
    activeView,
    onPolygonClick,
    selectedPolygon
}) => {
  
  // Combine real layers with a temporary virtual layer for draft features
  const allLayers = useMemo(() => {
      if (!draftFeatures || draftFeatures.length === 0) return layers;

      const draftLayer: Layer = {
          id: 'draft-layer',
          name: 'Editing...',
          visible: true,
          data: {
              type: 'FeatureCollection',
              features: draftFeatures
          },
          color: '#f59e0b', // Amber for draft
          opacity: 1,
          type: 'point',
          grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
          lastUpdated: Date.now() // Always force refresh
      };

      return [...layers, draftLayer];
  }, [layers, draftFeatures]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}>
      <MapContainer 
        center={[31.0461, 34.8516]} 
        zoom={8} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        preferCanvas={false} // Disable canvas to ensure DOM classes/animations work on SVG paths
      >
        <MapEvents 
          isPickingLocation={isPickingLocation} 
          isPickingGooglePlaces={isPickingGooglePlaces} 
          onMapClick={onMapClick}
          onPolygonClick={onPolygonClick}
        />
        <ClearSelectionOnMapClick onPolygonClick={onPolygonClick} />
        
        <TileLayer
            attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
            url={`https://api.mapbox.com/styles/v1/aperemen/cmixbm8te001701s6c99l6o0z/tiles/{z}/{x}/{y}?access_token=${process.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiYXBlcmVtZW4iLCJhIjoiY2p2M2g3N2Y4MDk2bDRlcDJ2Y3R0dnNocCJ9.oMUpX3SDvmCFGW1o9qkzoQ'}`}
            tileSize={512}
            zoomOffset={-1}
        />

        <Pane name="urgentPane" style={{ zIndex: 700 }} />
        
        {/* Render Layers using separate component to handle schema calculation per layer */}
        {allLayers.map(layer => (
            <LayerRenderer 
                key={`${layer.id}-${layer.lastUpdated || 0}`} 
                layer={layer} 
                onUpdateFeature={onUpdateFeature}
                onPolygonClick={onPolygonClick}
            />
        ))}

        {/* Highlight Layer for Selected Polygon */}
        {selectedPolygon && (() => {
          const selectedLayer = layers.find(l => l.id === selectedPolygon.layerId);
          if (selectedLayer && selectedLayer.data.features[selectedPolygon.featureIndex]) {
            return (
              <GeoJSON
                key={`highlight-${selectedPolygon.layerId}-${selectedPolygon.featureIndex}`}
                data={{
                  type: 'FeatureCollection',
                  features: [selectedPolygon.feature]
                }}
                style={() => ({
                  color: '#ffff00',
                  weight: 5,
                  opacity: 1,
                  fillColor: '#ffff00',
                  fillOpacity: 0.3
                })}
              />
            );
          }
          return null;
        })()}

        {/* Visual Radius Circle for Fetch Mode */}
        {fetchLocation && fetchRadius && (
          <Circle 
            center={[fetchLocation.lat, fetchLocation.lng]}
            radius={fetchRadius}
            pathOptions={{ color: '#94a3b8', fillColor: '#94a3b8', fillOpacity: 0.2, weight: 1, dashArray: '4 4' }}
          />
        )}

        {/* Visual Radius Circle for Google Places Mode */}
        {googlePlacesLocation && googlePlacesRadius && (
          <Circle 
            center={[googlePlacesLocation.lat, googlePlacesLocation.lng]}
            radius={googlePlacesRadius}
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 2 }}
          />
        )}

        <BoundsHandler layers={layers} />
        <ZoomController 
            zoomToLayerId={zoomToLayerId} 
            layers={layers} 
            onComplete={onZoomComplete} 
        />
      </MapContainer>

      {/* Properties Popup for Selected Polygon - Using fixed positioning to appear above map */}
      {selectedPolygon && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '420px',
            backgroundColor: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            zIndex: 10000,
            minWidth: '280px',
            maxWidth: '380px',
            border: '2px solid #e2e8f0'
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155' }}>
              Properties
            </span>
            <button
              onClick={() => {
                // Clear selection
                if (onPolygonClick) {
                  onPolygonClick('', -1, {} as Feature);
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                color: '#64748b'
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
            {selectedPolygon.feature.properties ? (
              <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                {Object.entries(selectedPolygon.feature.properties).slice(0, 5).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '4px' }}>
                    <strong>{key}:</strong> {String(value)}
                  </div>
                ))}
                {Object.keys(selectedPolygon.feature.properties).length > 5 && (
                  <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                    +{Object.keys(selectedPolygon.feature.properties).length - 5} more...
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No properties</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              title="Edit properties"
            >
              <Pencil size={14} />
              Edit
            </button>
            <button
              onClick={() => {
                // Trigger the copy confirmation in App.tsx
                const event = new CustomEvent('copyPolygon');
                window.dispatchEvent(event);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              title="Copy to new layer"
            >
              <Scissors size={14} />
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
};