import * as turf from '@turf/turf';
import { Feature, Point, Polygon } from 'geojson';

/**
 * Triple Isochrone Calculation for Multi-Criteria Urban Accessibility Model
 * 
 * Generates three walking-time isochrone polygons around a point:
 * - Zone A: 0-5 minutes (multiplier: 1.0)
 * - Zone B: 5-10 minutes (multiplier: 0.6)
 * - Zone C: 10-15 minutes (multiplier: 0.3)
 */

export interface IsochroneZone {
    type: 'A' | 'B' | 'C';
    minutes: { min: number; max: number };
    multiplier: number;
    polygon: Feature<Polygon>;
}

export interface IsochroneResult {
    point: { lat: number; lng: number };
    zones: IsochroneZone[];
}

/**
 * Average walking speed in meters per minute
 * Typical human walking speed: 5 km/h = ~83.3 meters/minute
 */
const WALKING_SPEED_M_PER_MIN = 83.3;

/**
 * Generate simple circular isochrones based on walking time
 * 
 * Note: This is a simplified implementation using circular buffers.
 * For production use, consider integrating with proper routing APIs like:
 * - OpenRouteService
 * - Mapbox Isochrone API
 * - OSRM
 */
export function generateSimpleIsochrones(
    lat: number,
    lng: number
): IsochroneResult {
    const point = turf.point([lng, lat]);
    
    // Calculate radius for each zone in kilometers
    const radiusA = (5 * WALKING_SPEED_M_PER_MIN) / 1000; // ~0.42 km
    const radiusB = (10 * WALKING_SPEED_M_PER_MIN) / 1000; // ~0.83 km
    const radiusC = (15 * WALKING_SPEED_M_PER_MIN) / 1000; // ~1.25 km
    
    // Create buffer zones
    const bufferA = turf.buffer(point, radiusA, { units: 'kilometers' });
    const bufferB = turf.buffer(point, radiusB, { units: 'kilometers' });
    const bufferC = turf.buffer(point, radiusC, { units: 'kilometers' });
    
    if (!bufferA || !bufferB || !bufferC) {
        throw new Error('Failed to generate isochrone buffers');
    }
    
    const zones: IsochroneZone[] = [
        {
            type: 'A',
            minutes: { min: 0, max: 5 },
            multiplier: 1.0,
            polygon: bufferA as Feature<Polygon>
        },
        {
            type: 'B',
            minutes: { min: 5, max: 10 },
            multiplier: 0.6,
            polygon: bufferB as Feature<Polygon>
        },
        {
            type: 'C',
            minutes: { min: 10, max: 15 },
            multiplier: 0.3,
            polygon: bufferC as Feature<Polygon>
        }
    ];
    
    return {
        point: { lat, lng },
        zones
    };
}

/**
 * Calculate which zone a feature falls into
 */
export function getFeatureZone(
    feature: Feature,
    isochrones: IsochroneResult
): IsochroneZone | null {
    // Get feature centroid for point/line, or use first coordinate for polygons
    let featurePoint: Feature<Point>;
    
    if (feature.geometry.type === 'Point') {
        featurePoint = feature as Feature<Point>;
    } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const centroid = turf.centroid(feature);
        featurePoint = centroid;
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        const centroid = turf.centroid(feature);
        featurePoint = centroid;
    } else {
        return null;
    }
    
    // Check which zone contains the feature (from smallest to largest)
    for (const zone of isochrones.zones) {
        if (turf.booleanPointInPolygon(featurePoint, zone.polygon)) {
            return zone;
        }
    }
    
    return null;
}

/**
 * Filter features by isochrone zones
 */
export function filterFeaturesByZone(
    features: Feature[],
    isochrones: IsochroneResult
): { [key: string]: Feature[] } {
    const result: { [key: string]: Feature[] } = {
        A: [],
        B: [],
        C: [],
        outside: []
    };
    
    for (const feature of features) {
        const zone = getFeatureZone(feature, isochrones);
        
        if (zone) {
            result[zone.type].push(feature);
        } else {
            result.outside.push(feature);
        }
    }
    
    return result;
}

/**
 * Calculate distance from point to feature in meters
 */
export function calculateDistance(
    centerLat: number,
    centerLng: number,
    feature: Feature
): number {
    const centerPoint = turf.point([centerLng, centerLat]);
    
    let targetPoint: Feature<Point>;
    
    if (feature.geometry.type === 'Point') {
        targetPoint = feature as Feature<Point>;
    } else {
        targetPoint = turf.centroid(feature);
    }
    
    return turf.distance(centerPoint, targetPoint, { units: 'meters' });
}

/**
 * Calculate indicator score based on features within isochrone zones
 * 
 * Formula: S_indicator = Σ(Score × ZoneMultiplier) / Σ(ZoneMultipliers)
 */
export interface IndicatorScoreInput {
    featuresInZones: { [key: string]: Feature[] };
    normalizeFunction: (count: number, zone: 'A' | 'B' | 'C') => number; // Returns 1-5 score
}

export function calculateIndicatorScore(input: IndicatorScoreInput): number {
    const { featuresInZones, normalizeFunction } = input;
    
    let weightedSum = 0;
    let multiplierSum = 0;
    
    const zones: Array<{ key: 'A' | 'B' | 'C'; multiplier: number }> = [
        { key: 'A', multiplier: 1.0 },
        { key: 'B', multiplier: 0.6 },
        { key: 'C', multiplier: 0.3 }
    ];
    
    for (const zone of zones) {
        const featuresInZone = featuresInZones[zone.key] || [];
        const count = featuresInZone.length;
        
        // Normalize count to 1-5 score
        const score = normalizeFunction(count, zone.key);
        
        // Apply zone multiplier
        weightedSum += score * zone.multiplier;
        multiplierSum += zone.multiplier;
    }
    
    // Avoid division by zero
    if (multiplierSum === 0) return 1;
    
    return weightedSum / multiplierSum;
}

/**
 * Common normalization functions for different indicator types
 */
export const NormalizationFunctions = {
    /**
     * Linear normalization: more is better
     * Good for: parks, transit stops, schools, etc.
     */
    linearMoreIsBetter: (count: number, zone: 'A' | 'B' | 'C'): number => {
        const thresholds = {
            A: { excellent: 5, good: 3, fair: 2, poor: 1 },
            B: { excellent: 8, good: 5, fair: 3, poor: 1 },
            C: { excellent: 10, good: 6, fair: 4, poor: 2 }
        };
        
        const t = thresholds[zone];
        
        if (count >= t.excellent) return 5;
        if (count >= t.good) return 4;
        if (count >= t.fair) return 3;
        if (count >= t.poor) return 2;
        return 1;
    },
    
    /**
     * Optimal range: not too few, not too many
     * Good for: commercial density, traffic
     */
    optimalRange: (count: number, zone: 'A' | 'B' | 'C'): number => {
        const optimalRanges = {
            A: { min: 3, max: 8 },
            B: { min: 5, max: 12 },
            C: { min: 7, max: 15 }
        };
        
        const range = optimalRanges[zone];
        
        if (count >= range.min && count <= range.max) return 5;
        if (count < range.min) {
            // Below optimal
            const ratio = count / range.min;
            return Math.max(1, 1 + ratio * 4);
        } else {
            // Above optimal
            const excess = count - range.max;
            return Math.max(1, 5 - excess * 0.3);
        }
    },
    
    /**
     * Presence/absence: just need at least one
     * Good for: healthcare, heritage sites
     */
    presenceBonus: (count: number, zone: 'A' | 'B' | 'C'): number => {
        if (count === 0) return 1;
        if (count === 1) return 4;
        return 5;
    }
};

/**
 * Create a grid of sample points over a bounding box
 */
export function createSampleGrid(
    bounds: { north: number; south: number; east: number; west: number },
    spacingMeters: number
): Array<{ lat: number; lng: number }> {
    const points: Array<{ lat: number; lng: number }> = [];
    
    // Convert spacing to approximate degrees
    const spacingLat = spacingMeters / 111000; // ~111km per degree latitude
    const avgLat = (bounds.north + bounds.south) / 2;
    const spacingLng = spacingMeters / (111000 * Math.cos(avgLat * Math.PI / 180));
    
    let lat = bounds.south;
    while (lat <= bounds.north) {
        let lng = bounds.west;
        while (lng <= bounds.east) {
            points.push({ lat, lng });
            lng += spacingLng;
        }
        lat += spacingLat;
    }
    
    return points;
}
