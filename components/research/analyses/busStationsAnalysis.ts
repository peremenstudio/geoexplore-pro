import { Layer } from '../../../types';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import { 
    separateIsochroneLayers, 
    clip, 
    difference 
} from '../../../utils/gisToolbox';
import { AnalysisResults } from '../types';

interface BusStationsAnalysisParams {
    samplePointLocation: { lat: number; lng: number } | null;
    storedIsochrones: any;
    onAddLayer?: (layer: Layer) => void;
    setAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResults>>;
    setRunningAnalysis: (analysis: string | null) => void;
}

export const runBusStationsAnalysis = async ({
    samplePointLocation,
    storedIsochrones,
    onAddLayer,
    setAnalysisResults,
    setRunningAnalysis
}: BusStationsAnalysisParams) => {
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
