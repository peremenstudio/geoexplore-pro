import * as turf from '@turf/turf';
import { Feature } from 'geojson';
import { Layer } from '../types';
import { fetchTelAvivLayers, fetchTelAvivLayerData, findMatchingLayers } from './telAvivGis';

/**
 * Tel Aviv Research Configuration
 * Uses actual Tel Aviv municipal GIS layers for accurate analysis
 */

export interface TelAvivIndicator {
    id: string;
    name: string;
    category: 'urban' | 'social' | 'economic' | 'historical';
    enabled: boolean;
    layerName: string; // Name of the layer to use from layers array
    calculationType: 'area' | 'count' | 'density';
    zoneSensitivity: 'high' | 'medium' | 'low';
}

export const telAvivIndicators: TelAvivIndicator[] = [
    // Urban indicators
    { 
        id: 'green_spaces', 
        name: 'Green Spaces', 
        category: 'urban', 
        enabled: true, 
        layerName: 'שטחים ירוקים',
        calculationType: 'area',
        zoneSensitivity: 'medium' 
    },
    // More indicators will be added here
];

/**
 * Fetch Tel Aviv green spaces layer from GIS server
 * Layer ID 503: שטחים ירוקים (Green Spaces)
 * Returns a Layer object ready to be added to the map
 */
export const fetchTelAvivGreenSpaces = async (): Promise<Layer | null> => {
    try {
        console.log('🌳 Fetching Tel Aviv green spaces layer (ID: 503)...');
        
        // Direct fetch from known layer ID
        const GREEN_SPACES_LAYER_ID = 503;
        const features = await fetchTelAvivLayerData(GREEN_SPACES_LAYER_ID);
        
        console.log(`✅ Loaded ${features.length} green space features from layer 503`);
        
        // Return as Layer object
        return {
            id: `tel-aviv-green-spaces-${Date.now()}`,
            name: 'שטחים ירוקים (Tel Aviv)',
            visible: true,
            data: {
                type: 'FeatureCollection',
                features
            },
            color: '#22c55e',
            opacity: 0.5,
            type: 'polygon',
            grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
            lastUpdated: Date.now()
        };
    } catch (error) {
        console.error('❌ Failed to fetch Tel Aviv green spaces from layer 503:', error);
        return null;
    }
};

/**
 * Calculate the area of green spaces within the 15-minute walking isochrone
 * Uses turf.intersect to clip - same as "cut by boundary" in Analyze tab
 */
export const calculateAreaInIsochrones = (
    greenSpaceLayer: Layer | undefined,
    isochroneFeatures: Feature[]
): { 
    gardenArea: number; // Total area of clipped gardens in hectares
    isochroneArea: number; // Total area of 15-min isochrone in hectares
    percentage: number; // Garden coverage percentage
    clippedFeatures: Feature[]; // Clipped features for visualization
} => {
    if (!greenSpaceLayer || !isochroneFeatures || isochroneFeatures.length === 0) {
        return { gardenArea: 0, isochroneArea: 0, percentage: 0, clippedFeatures: [] };
    }

    // Find the 15-minute isochrone (largest one)
    const iso15min = isochroneFeatures.reduce((largest, current) => {
        const currentMin = current.properties?.contour || current.properties?.minutes || 0;
        const largestMin = largest.properties?.contour || largest.properties?.minutes || 0;
        return currentMin > largestMin ? current : largest;
    }, isochroneFeatures[0]);

    console.log('🌳 Clipping gardens by 15-minute isochrone boundary');
    console.log('Garden features:', greenSpaceLayer.data.features.length);

    const clippedFeatures: Feature[] = [];
    let totalGardenArea = 0;

    // Clip each garden polygon by the 15-min isochrone boundary
    greenSpaceLayer.data.features.forEach(garden => {
        if (!garden.geometry || (garden.geometry.type !== 'Polygon' && garden.geometry.type !== 'MultiPolygon')) {
            return;
        }

        try {
            // Use turf.intersect to clip - same as "cut by boundary"
            const clipped = turf.intersect(garden as any, iso15min as any);
            
            if (clipped) {
                const area = turf.area(clipped);
                totalGardenArea += area;
                
                clippedFeatures.push({
                    ...clipped,
                    properties: {
                        ...clipped.properties,
                        areaHectares: (area / 10000).toFixed(3),
                        originalName: garden.properties?.name || garden.properties?.Name || 'Green Space'
                    }
                } as Feature);
            }
        } catch (err) {
            // Skip invalid geometries
        }
    });

    // Calculate isochrone area
    const isochroneAreaM2 = turf.area(iso15min as any);
    const gardenAreaHectares = totalGardenArea / 10000;
    const isochroneAreaHectares = isochroneAreaM2 / 10000;
    const percentage = isochroneAreaHectares > 0 ? (totalGardenArea / isochroneAreaM2) * 100 : 0;

    console.log(`✅ Clipped ${clippedFeatures.length} garden segments`);
    console.log(`Garden area: ${gardenAreaHectares.toFixed(2)} hectares`);
    console.log(`Isochrone area: ${isochroneAreaHectares.toFixed(2)} hectares`);
    console.log(`Coverage: ${percentage.toFixed(2)}%`);

    return {
        gardenArea: gardenAreaHectares,
        isochroneArea: isochroneAreaHectares,
        percentage,
        clippedFeatures
    };
};

/**
 * Calculate green space accessibility score
 * Score = (garden area / isochrone area) × 100
 * Returns a value between 0-100
 */
export const calculateGreenSpaceScore = (
    gardenArea: number,
    isochroneArea: number,
    percentage: number
): number => {
    // The percentage is already calculated, just return it capped at 100
    return Math.min(100, percentage);
};
