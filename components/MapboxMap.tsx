import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl, { GeoJSONSource } from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import type { Layer as LayerType } from '../types';
import { Feature } from 'geojson';
import { getNextLayerColor } from '../utils/layerColors';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface MapboxMapProps {
  layers: LayerType[];
  draftFeatures?: Feature[];
  zoomToLayerId?: string | null;
  onZoomComplete?: () => void;
  onUpdateFeature?: (layerId: string, featureIndex: number, newProperties: any) => void;
  onAddLayer?: (layer: LayerType) => void;
  isPickingLocation?: boolean;
  isPickingGooglePlaces?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  fetchLocation?: { lat: number, lng: number } | null;
  fetchRadius?: number;
  googlePlacesLocation?: { lat: number, lng: number } | null;
  googlePlacesRadius?: number;
  activeView?: string;
}

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiYXBlcmVtZW4iLCJhIjoiY2p2M2g3N2Y4MDk2bDRlcDJ2Y3R0dnNocCJ9.oMUpX3SDvmCFGW1o9qkzoQ';
const MAPBOX_STYLE = process.env.MAPBOX_STYLE || 'mapbox://styles/aperemen/cmixbm8te001701s6c99l6o0z';

mapboxgl.accessToken = MAPBOX_TOKEN;

export const MapboxMap: React.FC<MapboxMapProps> = ({ 
  layers, 
  draftFeatures = [],
  zoomToLayerId,
  onZoomComplete,
  onAddLayer,
  isPickingLocation,
  isPickingGooglePlaces,
  onMapClick,
  fetchLocation,
  fetchRadius = 500,
  googlePlacesLocation,
  googlePlacesRadius = 1000,
  activeView = 'map'
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_STYLE,
      center: [34.7818, 32.0853],
      zoom: 8,
      pitch: 60,
      bearing: 0
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    // Initialize MapboxDraw
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
        combine_features: false,
        uncombine_features: false
      }
    });
    map.current.addControl(draw.current, 'top-left');

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add terrain
      if (map.current) {
        map.current.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
        
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }
    });

    // Handle map clicks
    map.current.on('click', (e) => {
      if ((isPickingLocation || isPickingGooglePlaces) && onMapClick) {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      }
    });

    return () => {
      if (map.current) {
        if (draw.current) {
          map.current.removeControl(draw.current);
        }
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update cursor
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = (isPickingLocation || isPickingGooglePlaces) ? 'crosshair' : '';
  }, [isPickingLocation, isPickingGooglePlaces]);

  // Handle draw events
  useEffect(() => {
    if (!map.current || !mapLoaded || !draw.current) return;

    const handleDrawUpdate = () => {
      const data = draw.current!.getAll();
      
      if (data.features.length > 0) {
        data.features.forEach((feature: Feature, index: number) => {
          if (feature.geometry.type === 'Polygon') {
            const area = turf.area(feature);
            const roundedArea = Math.round(area * 100) / 100;
            
            const newLayer: LayerType = {
              id: `drawn-shape-${Date.now()}-${index}`,
              name: `Drawn Shape - ${roundedArea.toLocaleString()} m²`,
              visible: true,
              data: {
                type: 'FeatureCollection',
                features: [feature]
              },
              color: getNextLayerColor(),
              opacity: 0.7,
              type: 'polygon',
              grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
              lastUpdated: Date.now()
            };
            
            onAddLayer?.(newLayer);
          }
        });
        
        // Clear the draw canvas after a short delay
        setTimeout(() => {
          if (draw.current) {
            draw.current.deleteAll();
          }
        }, 100);
      }
    };

    map.current.on('draw.create', handleDrawUpdate);
    map.current.on('draw.update', handleDrawUpdate);

    return () => {
      if (map.current) {
        map.current.off('draw.create', handleDrawUpdate);
        map.current.off('draw.update', handleDrawUpdate);
      }
    };
  }, [mapLoaded, onAddLayer]);

  // Handle zoom to layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !zoomToLayerId) return;

    const layer = layers.find(l => l.id === zoomToLayerId);
    if (layer && layer.data.features.length > 0) {
      const coordinates: [number, number][] = [];
      
      layer.data.features.forEach((feature: Feature) => {
        if (feature.geometry.type === 'Point') {
          coordinates.push(feature.geometry.coordinates as [number, number]);
        }
      });

      if (coordinates.length > 0) {
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
        
        map.current?.fitBounds(bounds, { padding: 50, duration: 1000 });
        setTimeout(() => onZoomComplete?.(), 1000);
      }
    }
  }, [zoomToLayerId, layers, mapLoaded, onZoomComplete]);

  // Render layers
  useEffect(() => {
    const mapInstance = map.current;
    if (!mapInstance || !mapLoaded) return;

    layers.forEach(layer => {
      const source = mapInstance.getSource(layer.id) as GeoJSONSource | undefined;

      if (source) {
        source.setData(layer.data as any);
      } else {
        mapInstance.addSource(layer.id, {
          type: 'geojson',
          data: layer.data
        });
      }

      const visibility = layer.visible ? 'visible' : 'none';

      // Polygons fill
      if (!mapInstance.getLayer(`${layer.id}-polygons`)) {
        mapInstance.addLayer({
          id: `${layer.id}-polygons`,
          type: 'fill',
          source: layer.id,
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'fill-color': layer.color,
            'fill-opacity': (layer.opacity || 0.7) * 0.5
          }
        });
      }
      mapInstance.setLayoutProperty(`${layer.id}-polygons`, 'visibility', visibility);

      // Polygon outline
      if (!mapInstance.getLayer(`${layer.id}-polygon-outline`)) {
        mapInstance.addLayer({
          id: `${layer.id}-polygon-outline`,
          type: 'line',
          source: layer.id,
          filter: ['==', '$type', 'Polygon'],
          paint: {
            'line-color': layer.color,
            'line-width': 2,
            'line-opacity': layer.opacity || 0.7
          }
        });
      }
      mapInstance.setLayoutProperty(`${layer.id}-polygon-outline`, 'visibility', visibility);

      // Lines
      if (!mapInstance.getLayer(`${layer.id}-lines`)) {
        mapInstance.addLayer({
          id: `${layer.id}-lines`,
          type: 'line',
          source: layer.id,
          filter: ['==', '$type', 'LineString'],
          paint: {
            'line-color': layer.color,
            'line-width': 3,
            'line-opacity': layer.opacity || 0.7,
            'line-blur': 0.5
          }
        });
      }
      mapInstance.setLayoutProperty(`${layer.id}-lines`, 'visibility', visibility);

      // Points (tuned for 3D/terrain)
      if (!mapInstance.getLayer(`${layer.id}-points`)) {
        mapInstance.addLayer({
          id: `${layer.id}-points`,
          type: 'circle',
          source: layer.id,
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 8,
            'circle-color': layer.color,
            'circle-opacity': layer.opacity || 0.7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            // Keep markers glued to terrain when pitched/3D
            'circle-pitch-alignment': 'map',
            'circle-pitch-scale': 'map'
          }
        });
      }
      mapInstance.setLayoutProperty(`${layer.id}-points`, 'visibility', visibility);
    });
  }, [layers, mapLoaded]);

  // Render draft features
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (map.current.getLayer('draft-points')) {
      map.current.removeLayer('draft-points');
    }
    if (map.current.getSource('draft-features')) {
      map.current.removeSource('draft-features');
    }

    if (draftFeatures.length > 0) {
      map.current.addSource('draft-features', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: draftFeatures
        }
      });

      map.current.addLayer({
        id: 'draft-points',
        type: 'circle',
        source: 'draft-features',
        paint: {
          'circle-radius': 8,
          'circle-color': '#ff6b6b',
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }, [draftFeatures, mapLoaded]);

  // Render fetch location
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    ['fetch-circle', 'fetch-center'].forEach(id => {
      if (map.current?.getLayer(id)) {
        map.current.removeLayer(id);
      }
    });
    if (map.current.getSource('fetch-location')) {
      map.current.removeSource('fetch-location');
    }

    if (fetchLocation) {
      map.current.addSource('fetch-location', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [fetchLocation.lng, fetchLocation.lat]
          },
          properties: {}
        }
      });

      map.current.addLayer({
        id: 'fetch-circle',
        type: 'circle',
        source: 'fetch-location',
        paint: {
          'circle-radius': fetchRadius / 10,
          'circle-color': '#3b82f6',
          'circle-opacity': 0.2,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3b82f6'
        }
      });

      map.current.addLayer({
        id: 'fetch-center',
        type: 'circle',
        source: 'fetch-location',
        paint: {
          'circle-radius': 6,
          'circle-color': '#3b82f6',
          'circle-opacity': 1
        }
      });
    }

    // Google Places location circle
    if (map.current.getSource('google-places-location')) {
      map.current.removeSource('google-places-location');
    }

    if (googlePlacesLocation) {
      map.current.addSource('google-places-location', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [googlePlacesLocation.lng, googlePlacesLocation.lat]
          },
          properties: {}
        }
      });

      map.current.addLayer({
        id: 'google-places-circle',
        type: 'circle',
        source: 'google-places-location',
        paint: {
          'circle-radius': googlePlacesRadius / 10,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.2,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#f59e0b'
        }
      });

      map.current.addLayer({
        id: 'google-places-center',
        type: 'circle',
        source: 'google-places-location',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f59e0b',
          'circle-opacity': 1
        }
      });
    }
  }, [fetchLocation, fetchRadius, googlePlacesLocation, googlePlacesRadius, mapLoaded]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      {mapLoaded && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '13px',
          fontFamily: "'Open Sans', sans-serif",
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          zIndex: 100
        }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Draw Shapes</p>
          <p style={{ margin: '0', color: '#666' }}>Polygon tool active</p>
        </div>
      )}
    </div>
  );
};
