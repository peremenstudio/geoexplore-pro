import { useState } from 'react';
import { Layer } from '../../types';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';
import { 
    generateWalkingIsochrones, 
    duplicateLayer, 
    separateIsochroneLayers, 
    clip, 
    calculateArea, 
    difference 
} from '../../utils/gisToolbox';
import { AnalysisResults } from './types';

interface UseResearchAnalysisProps {
    layers: Layer[];
    onAddLayer?: (layer: Layer) => void;
    onRemoveLayer?: (layerId: string) => void;
    onSetResearchIsochrones?: (features: Feature[] | null) => void;
}

export const useResearchAnalysis = ({
    layers,
    onAddLayer,
    onRemoveLayer,
    onSetResearchIsochrones
}: UseResearchAnalysisProps) => {
    const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({
        isochroneArea: { zone5: null, zone10: null, zone15: null },
        gardens: { zone5: null, zone10: null, zone15: null },
        gardenScores: { zone5: null, zone10: null, zone15: null },
        busStations: { zone5: null, zone10: null, zone15: null },
        busStationScores: { zone5: null, zone10: null, zone15: null }
    });
    const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null);
    const [storedIsochrones, setStoredIsochrones] = useState<any>(null);

    // Calculate transit score from bus station counts
    const calculateTransitScore = (
        zone5: number, 
        zone10: number, 
        zone15: number, 
        maxRawBenchmark: number = 10
    ): number => {
        const rawScore = Math.sqrt(zone5) * 1.0 + Math.sqrt(zone10) * 0.4 + Math.sqrt(zone15) * 0.1;
        const normalizedScore = 1 + (4 * (rawScore / maxRawBenchmark));
        const finalScore = Math.max(1, Math.min(5, normalizedScore));
        return finalScore;
    };

    // Individual analysis handlers for the table
    const handleIsochroneAreaAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        setRunningAnalysis('isochroneArea');
        
        try {
            console.log('📊 Running Isochrone Area Analysis...');
            
            const isochronesGeoJSON = await generateWalkingIsochrones(
                [samplePointLocation.lng, samplePointLocation.lat],
                [5, 10, 15]
            );

            if (!isochronesGeoJSON.features || isochronesGeoJSON.features.length === 0) {
                alert('Failed to generate isochrones');
                return;
            }

            const areas = {
                zone5: 0,
                zone10: 0,
                zone15: 0
            };

            isochronesGeoJSON.features.forEach(feature => {
                const minutes = feature.properties?.walkingMinutes || feature.properties?.contour || 0;
                const area = turf.area(feature);

                if (minutes <= 5) {
                    areas.zone5 = area;
                } else if (minutes <= 10) {
                    areas.zone10 = area;
                } else if (minutes <= 15) {
                    areas.zone15 = area;
                }
            });

            console.log('✅ Isochrone areas calculated:', areas);

            setStoredIsochrones(isochronesGeoJSON);

            if (onAddLayer) {
                const isochroneLayer: Layer = {
                    id: `isochrone-analysis-${Date.now()}`,
                    name: `🚶 Walking Isochrones (5, 10, 15 min)`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: isochronesGeoJSON.features
                    },
                    color: '#3b82f6',
                    opacity: 0.3,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(isochroneLayer);
            }

            setAnalysisResults(prev => ({
                ...prev,
                isochroneArea: areas
            }));

        } catch (error) {
            console.error('❌ Error in isochrone area analysis:', error);
            alert('Failed to calculate isochrone areas');
        } finally {
            setRunningAnalysis(null);
        }
    };

    const handleGardensAnalysis = async (samplePointLocation: { lat: number; lng: number } | null, analysisResults: AnalysisResults) => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        if (!storedIsochrones) {
            alert('Please run Isochrone Area analysis first');
            return;
        }

        setRunningAnalysis('gardens');
        
        try {
            console.log('🌳 Running Gardens Analysis...');
            
            const isochronesGeoJSON = storedIsochrones;
            const duplicatedIsochrones = duplicateLayer(isochronesGeoJSON) as any;
            const separatedZones = separateIsochroneLayers(duplicatedIsochrones);
            const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
            
            console.log('🌳 Fetching garden layer from Tel Aviv GIS...');
            const gardenUrl = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/503/query?where=1%3D1&outFields=*&f=geojson';
            
            const response = await fetch(gardenUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch gardens: ${response.statusText}`);
            }
            
            const gardenData = await response.json();
            console.log('✅ Fetched garden layer:', gardenData.features.length, 'features');
            
            if (onAddLayer) {
                const gardenLayer: Layer = {
                    id: `gardens-original-${Date.now()}`,
                    name: `🌳 Tel Aviv Gardens (Original)`,
                    visible: true,
                    data: gardenData,
                    color: '#22c55e',
                    opacity: 0.4,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(gardenLayer);
            }
            
            const gardenCopy1 = duplicateLayer(gardenData) as any;
            const gardenCopy2 = duplicateLayer(gardenData) as any;
            const gardenCopy3 = duplicateLayer(gardenData) as any;
            
            const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden5 = clip(gardenCopy1.features, zone5Polygon);
            
            const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden10 = clip(gardenCopy2.features, zone10Polygon);
            
            const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden15 = clip(gardenCopy3.features, zone15Polygon);
            
            const area5 = clippedGarden5.reduce((sum, feature) => {
                return sum + calculateArea(feature as Feature<Polygon | MultiPolygon>);
            }, 0);
            
            const area10 = clippedGarden10.reduce((sum, feature) => {
                return sum + calculateArea(feature as Feature<Polygon | MultiPolygon>);
            }, 0);
            
            const area15 = clippedGarden15.reduce((sum, feature) => {
                return sum + calculateArea(feature as Feature<Polygon | MultiPolygon>);
            }, 0);
            
            const gardenAreas = {
                zone5: area5,
                zone10: area10,
                zone15: area15
            };
            
            const calculateScore = (gardenArea: number, isochroneArea: number, multiplier: number): number => {
                if (!isochroneArea || isochroneArea === 0) return 0;
                const score = (gardenArea / isochroneArea) * 100 * multiplier;
                return Math.min(score, 5);
            };
            
            const gardenScores = {
                zone5: calculateScore(area5, analysisResults.isochroneArea.zone5 || 0, 1.0),
                zone10: calculateScore(area10, analysisResults.isochroneArea.zone10 || 0, 0.7),
                zone15: calculateScore(area15, analysisResults.isochroneArea.zone15 || 0, 0.3)
            };
            
            if (onAddLayer) {
                const clippedLayer5: Layer = {
                    id: `gardens-zone5-${Date.now()}`,
                    name: `🌳 Gardens in Zone 5 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: clippedGarden5 },
                    color: '#22c55e',
                    opacity: 0.6,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(clippedLayer5);
                
                const clippedLayer10: Layer = {
                    id: `gardens-zone10-${Date.now()}`,
                    name: `🌳 Gardens in Zone 10 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: clippedGarden10 },
                    color: '#eab308',
                    opacity: 0.6,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(clippedLayer10);
                
                const clippedLayer15: Layer = {
                    id: `gardens-zone15-${Date.now()}`,
                    name: `🌳 Gardens in Zone 15 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: clippedGarden15 },
                    color: '#f97316',
                    opacity: 0.6,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(clippedLayer15);
            }
            
            setAnalysisResults(prev => ({
                ...prev,
                gardens: gardenAreas,
                gardenScores: gardenScores
            }));

        } catch (error) {
            console.error('❌ Error in gardens analysis:', error);
            alert(`Failed to calculate garden areas: ${error}`);
        } finally {
            setRunningAnalysis(null);
        }
    };

    const handleBusStationsAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        if (!storedIsochrones) {
            alert('Please run Isochrone Area analysis first');
            return;
        }

        setRunningAnalysis('busStations');
        
        try {
            console.log('🚍 Running Bus Stations Analysis...');
            
            const busUrl = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/956/query?where=1%3D1&outFields=*&f=geojson';
            
            const response = await fetch(busUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch bus stations: ${response.statusText}`);
            }
            
            const busData = await response.json();
            console.log('✅ Fetched bus station layer:', busData.features.length, 'features');
            
            if (onAddLayer) {
                const busLayer: Layer = {
                    id: `bus-stations-original-${Date.now()}`,
                    name: `🚍 Tel Aviv Bus Stations (Original)`,
                    visible: true,
                    data: busData,
                    color: '#3b82f6',
                    opacity: 0.8,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer);
            }
            
            const isochronesGeoJSON = storedIsochrones;
            const separatedZones = separateIsochroneLayers(isochronesGeoJSON);
            const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
            
            const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
            
            const busInZone5 = clip(busData.features, zone5Polygon);
            const busInZone10Full = clip(busData.features, zone10Polygon);
            const busInZone10 = difference(busInZone10Full, zone5Polygon);
            const busInZone15Full = clip(busData.features, zone15Polygon);
            const busInZone15 = difference(busInZone15Full, zone10Polygon);
            
            if (onAddLayer) {
                const busLayer5: Layer = {
                    id: `bus-zone5-${Date.now()}`,
                    name: `🚍 Bus Stations in Zone 5 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: busInZone5 },
                    color: '#22c55e',
                    opacity: 0.9,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer5);
                
                const busLayer10: Layer = {
                    id: `bus-zone10-${Date.now()}`,
                    name: `🚍 Bus Stations in Zone 10 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: busInZone10 },
                    color: '#eab308',
                    opacity: 0.9,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer10);
                
                const busLayer15: Layer = {
                    id: `bus-zone15-${Date.now()}`,
                    name: `🚍 Bus Stations in Zone 15 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: busInZone15 },
                    color: '#f97316',
                    opacity: 0.9,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer15);
            }
            
            const busStationCounts = {
                zone5: busInZone5.length,
                zone10: busInZone10.length,
                zone15: busInZone15.length
            };
            
            const zone5Score = Math.sqrt(busStationCounts.zone5) * 1.0;
            const zone10Score = Math.sqrt(busStationCounts.zone10) * 0.4;
            const zone15Score = Math.sqrt(busStationCounts.zone15) * 0.1;
            
            const busStationScores = {
                zone5: zone5Score,
                zone10: zone10Score,
                zone15: zone15Score
            };
            
            setAnalysisResults(prev => ({
                ...prev,
                busStations: busStationCounts,
                busStationScores: busStationScores
            }));

        } catch (error) {
            console.error('❌ Error in bus stations analysis:', error);
            alert(`Failed to analyze bus stations: ${error}`);
        } finally {
            setRunningAnalysis(null);
        }
    };

    return {
        analysisResults,
        runningAnalysis,
        calculateTransitScore,
        handleIsochroneAreaAnalysis,
        handleGardensAnalysis,
        handleBusStationsAnalysis
    };
};
