import { Layer } from '../../../types';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import { 
    duplicateLayer, 
    separateIsochroneLayers, 
    clip, 
    calculateArea
} from '../../../utils/gisToolbox';
import { AnalysisResults } from '../types';

interface GardensAnalysisParams {
    samplePointLocation: { lat: number; lng: number } | null;
    storedIsochrones: any;
    analysisResults: AnalysisResults;
    onAddLayer?: (layer: Layer) => void;
    setAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResults>>;
    setRunningAnalysis: (analysis: string | null) => void;
}

export const runGardensAnalysis = async ({
    samplePointLocation,
    storedIsochrones,
    analysisResults,
    onAddLayer,
    setAnalysisResults,
    setRunningAnalysis
}: GardensAnalysisParams) => {
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
            // Cap score at maximum of 5
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
