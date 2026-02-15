import { Layer } from '../../../types';
import * as turf from '@turf/turf';
import { generateWalkingIsochrones } from '../../../utils/gisToolbox';
import { AnalysisResults } from '../types';

interface IsochroneAreaAnalysisParams {
    samplePointLocation: { lat: number; lng: number } | null;
    onAddLayer?: (layer: Layer) => void;
    setAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResults>>;
    setRunningAnalysis: (analysis: string | null) => void;
    setStoredIsochrones: (isochrones: any) => void;
}

export const runIsochroneAreaAnalysis = async ({
    samplePointLocation,
    onAddLayer,
    setAnalysisResults,
    setRunningAnalysis,
    setStoredIsochrones
}: IsochroneAreaAnalysisParams) => {
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
