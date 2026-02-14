/**
 * GIS Toolbox - Comprehensive Spatial Analysis Functions
 * 
 * This module provides a collection of GIS operations for spatial data processing.
 * All functions work with GeoJSON Feature and FeatureCollection objects.
 */

import * as turf from '@turf/turf';
import { Feature, FeatureCollection, Polygon, MultiPolygon, LineString, MultiLineString, Point, Geometry } from 'geojson';

// ============================================================================
// GEOMETRIC OPERATIONS
// ============================================================================

/**
 * Create a buffer around features
 * @param features - Input features
 * @param radius - Buffer distance in meters
 * @param units - Distance units (default: 'meters')
 * @returns Buffered features
 */
export function buffer(
    features: Feature | Feature[],
    radius: number,
    units: turf.Units = 'meters'
): Feature[] {
    const inputFeatures = Array.isArray(features) ? features : [features];
    
    return inputFeatures.map(feature => {
        try {
            return turf.buffer(feature, radius, { units });
        } catch (error) {
            console.error('Buffer operation failed:', error);
            return feature;
        }
    });
}

/**
 * Union/Merge multiple polygons into one
 * @param features - Array of polygon features
 * @returns Single merged polygon feature or null if operation fails
 */
export function union(features: Feature<Polygon | MultiPolygon>[]): Feature<Polygon | MultiPolygon> | null {
    if (features.length === 0) return null;
    if (features.length === 1) return features[0];
    
    try {
        const featureCollection: FeatureCollection<Polygon | MultiPolygon> = {
            type: 'FeatureCollection',
            features
        };
        const unionResult = turf.union(featureCollection);
        return unionResult as Feature<Polygon | MultiPolygon> | null;
    } catch (error) {
        console.error('Union operation failed:', error);
        return null;
    }
}

/**
 * Find intersection between two features
 * @param feature1 - First feature
 * @param feature2 - Second feature
 * @returns Intersection feature or null
 */
export function intersect(
    feature1: Feature<Polygon | MultiPolygon>,
    feature2: Feature<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> | null {
    try {
        const fc: FeatureCollection<Polygon | MultiPolygon> = {
            type: 'FeatureCollection',
            features: [feature1, feature2]
        };
        return turf.intersect(fc) as Feature<Polygon | MultiPolygon> | null;
    } catch (error) {
        console.error('Intersection operation failed:', error);
        return null;
    }
}

/**
 * Cut/Clip features by a boundary polygon
 * Includes all polygons that touch, intersect, or are within the boundary
 * For points, includes points inside the boundary
 * @param features - Features to clip
 * @param boundary - Boundary polygon to clip by
 * @returns Clipped features
 */
export function clip(
    features: Feature[],
    boundary: Feature<Polygon | MultiPolygon>
): Feature[] {
    const clipped: Feature[] = [];
    
    for (const feature of features) {
        try {
            if (!feature.geometry) {
                continue;
            }
            
            // Handle points - check if inside boundary
            if (feature.geometry.type === 'Point') {
                if (turf.booleanPointInPolygon(feature as Feature<Point>, boundary)) {
                    clipped.push(feature);
                }
                continue;
            }
            
            // Handle MultiPoint
            if (feature.geometry.type === 'MultiPoint') {
                // For MultiPoint, check if any point is inside
                if (turf.booleanIntersects(feature, boundary)) {
                    clipped.push(feature);
                }
                continue;
            }
            
            // Skip other non-polygon geometries
            if (feature.geometry.type !== 'Polygon' && 
                feature.geometry.type !== 'MultiPolygon') {
                continue;
            }
            
            // Check for any spatial relationship - intersects catches touching too
            const hasRelationship = turf.booleanIntersects(feature, boundary);
            
            // Skip if no spatial relationship
            if (!hasRelationship) {
                continue;
            }
            
            // Check if completely within boundary - include whole feature
            if (turf.booleanWithin(feature, boundary)) {
                clipped.push(feature);
                continue;
            }
            
            // Perform intersection/clip for partially overlapping features
            const featurePoly = feature as Feature<Polygon | MultiPolygon>;
            const fc: FeatureCollection<Polygon | MultiPolygon> = {
                type: 'FeatureCollection',
                features: [featurePoly, boundary]
            };
            
            const result = turf.intersect(fc);
            
            if (result) {
                // Preserve original properties
                clipped.push({
                    ...result,
                    properties: { ...feature.properties }
                });
            } else {
                // If intersect fails but feature intersects, include original
                console.warn('Intersect returned null but feature intersects - including original');
                clipped.push(feature);
            }
        } catch (error) {
            console.error('Clip operation failed for feature:', error);
            // Try to include the feature anyway if it intersects
            try {
                if (turf.booleanIntersects(feature, boundary)) {
                    console.warn('Including feature despite clip error');
                    clipped.push(feature);
                }
            } catch (e) {
                // Skip this feature entirely
            }
        }
    }
    
    return clipped;
}

/**
 * Remove features that are inside a boundary polygon (inverse of clip)
 * Keeps all features outside the boundary, removes features inside
 * For partially overlapping features, removes the part inside the boundary
 * For points, removes points inside the boundary
 * @param features - Features to process
 * @param boundary - Boundary polygon - features inside will be removed
 * @returns Features outside the boundary
 */
export function difference(
    features: Feature[],
    boundary: Feature<Polygon | MultiPolygon>
): Feature[] {
    const result: Feature[] = [];
    
    for (const feature of features) {
        try {
            if (!feature.geometry) {
                continue;
            }
            
            // Handle points - exclude if inside boundary
            if (feature.geometry.type === 'Point') {
                if (!turf.booleanPointInPolygon(feature as Feature<Point>, boundary)) {
                    result.push(feature);
                }
                continue;
            }
            
            // Handle MultiPoint
            if (feature.geometry.type === 'MultiPoint') {
                // For MultiPoint, exclude if it intersects with boundary
                if (!turf.booleanIntersects(feature, boundary)) {
                    result.push(feature);
                }
                continue;
            }
            
            // Skip other non-polygon geometries
            if (feature.geometry.type !== 'Polygon' && 
                feature.geometry.type !== 'MultiPolygon') {
                continue;
            }
            
            // Check if feature intersects with boundary
            const intersects = turf.booleanIntersects(feature, boundary);
            
            // If no intersection, feature is completely outside - keep it
            if (!intersects) {
                result.push(feature);
                continue;
            }
            
            // Check if completely within boundary - exclude it (delete it)
            if (turf.booleanWithin(feature, boundary)) {
                // Skip this feature - it's completely inside the boundary
                continue;
            }
            
            // Feature partially overlaps - subtract the boundary part
            const featurePoly = feature as Feature<Polygon | MultiPolygon>;
            const fc: FeatureCollection<Polygon | MultiPolygon> = {
                type: 'FeatureCollection',
                features: [featurePoly, boundary]
            };
            
            const diff = turf.difference(fc);
            
            if (diff) {
                // Keep the part outside the boundary
                result.push({
                    ...diff,
                    properties: { ...feature.properties }
                });
            }
        } catch (error) {
            console.error('Difference operation failed for feature:', error);
            // On error, check if feature is outside boundary and include it
            try {
                if (!turf.booleanIntersects(feature, boundary)) {
                    console.warn('Including non-intersecting feature despite error');
                    result.push(feature);
                }
            } catch (e) {
                // Skip this feature entirely
            }
        }
    }
    
    return result;
}

/**
 * Dissolve features by combining adjacent polygons with same attribute value
 * @param features - Array of polygon features
 * @param attributeKey - Property key to dissolve by (optional)
 * @returns Dissolved features
 */
export function dissolve(
    features: Feature<Polygon | MultiPolygon>[],
    attributeKey?: string
): Feature<Polygon | MultiPolygon>[] {
    if (features.length === 0) return [];
    
    // Group features by attribute value
    const groups: Map<string, Feature<Polygon | MultiPolygon>[]> = new Map();
    
    features.forEach(feature => {
        const key = attributeKey && feature.properties?.[attributeKey] 
            ? String(feature.properties[attributeKey])
            : 'all';
        
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(feature);
    });
    
    // Union features in each group
    const dissolved: Feature<Polygon | MultiPolygon>[] = [];
    
    groups.forEach((groupFeatures, key) => {
        const merged = union(groupFeatures);
        if (merged) {
            // Preserve properties from first feature
            merged.properties = {
                ...groupFeatures[0].properties,
                dissolvedCount: groupFeatures.length
            };
            dissolved.push(merged);
        }
    });
    
    return dissolved;
}

// ============================================================================
// NETWORK ANALYSIS & ISOCHRONES
// ============================================================================

// Mapbox token for isochrone API - MUST be set in environment variables
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || '';

/**
 * Generate walking isochrones using real road network data
 * Uses Mapbox Isochrone API for accurate network-based reachability analysis
 * 
 * @param point - Center point [lng, lat]
 * @param minutes - Array of time intervals in minutes (e.g., [5, 10, 15])
 * @returns FeatureCollection of isochrone polygons
 * 
 * @example
 * const isochrones = await generateWalkingIsochrones([34.7818, 32.0853], [5, 10, 15]);
 */
export async function generateWalkingIsochrones(
    point: [number, number],
    minutes: number[] = [5, 10, 15]
): Promise<FeatureCollection> {
    const features: Feature[] = [];
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    
    console.log('🗺️ Generating isochrones from actual road network...');
    console.log('📍 Location:', point);
    console.log('⏱️ Time intervals (minutes):', minutes);
    
    try {
        for (let i = 0; i < minutes.length; i++) {
            const min = minutes[i];
            const color = colors[i % colors.length];
            
            try {
                console.log(`🚶 Fetching ${min} min isochrone from Mapbox API...`);
                
                // Mapbox Isochrone API
                const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${point[0]},${point[1]}?contours_minutes=${min}&polygons=true&access_token=${MAPBOX_TOKEN}`;
                
                console.log('🔗 Mapbox URL:', url);
                
                const response = await fetch(url);
                console.log('📈 Response status:', response.status);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ API Error:', errorText);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('📆 API Data:', data);
                
                if (data.features && data.features.length > 0) {
                    const isochroneFeature = data.features[0];
                    console.log('✅ Geometry type:', isochroneFeature.geometry?.type);
                    isochroneFeature.properties = {
                        walkingMinutes: min,
                        contour: min,
                        color: color,
                        source: 'Real Road Network (Mapbox)',
                        type: 'isochrone'
                    };
                    features.push(isochroneFeature);
                    console.log(`✅ ${min}-minute isochrone from REAL ROADS`);
                } else {
                    console.warn('⚠️ No features in response');
                }
            } catch (error: any) {
                console.error(`❌ ${min}-minute error:`, error.message);
            }
        }
        
        if (features.length === 0) {
            console.warn('💥 No valid isochrones from API, falling back to circular buffers');
            return generateBufferIsochrones(point, minutes);
        }
        
        console.log(`✅ Successfully generated ${features.length} road-based isochrones`);
        return { type: 'FeatureCollection', features };
    } catch (error: any) {
        console.error('Isochrone error:', error);
        return generateBufferIsochrones(point, minutes);
    }
}

/**
 * Fallback: Generate simple circular buffer isochrones
 * Used when Mapbox API is unavailable or fails
 * 
 * @param point - Center point [lng, lat]
 * @param minutes - Array of time intervals in minutes
 * @returns FeatureCollection of circular buffer polygons
 */
function generateBufferIsochrones(
    point: [number, number],
    minutes: number[] = [5, 10, 15]
): FeatureCollection {
    const walkingSpeedMsPerSecond = 1.4; // Average walking speed
    const features: Feature[] = [];
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899'];
    
    console.log('⚠️ Using CIRCULAR BUFFERS (not real isochrones based on roads)');
    
    minutes.forEach((min, idx) => {
        const distanceInMeters = walkingSpeedMsPerSecond * 60 * min;
        const distanceInKm = distanceInMeters / 1000;
        
        try {
            const polygon = turf.buffer(turf.point(point), distanceInKm, { units: 'kilometers' });
            polygon.properties = {
                walkingMinutes: min,
                contour: min,
                color: colors[idx % colors.length],
                source: 'Circular Buffer (Fallback)',
                type: 'isochrone'
            };
            features.push(polygon);
        } catch (error) {
            console.error(`Buffer error:`, error);
        }
    });
    
    return { type: 'FeatureCollection', features };
}

/**
 * Separate isochrone polygons into individual feature collections
 * Takes walking isochrones (3 polygons: 5min, 10min, 15min) and creates separate layers
 * 
 * @param isochrones - FeatureCollection containing isochrone polygons
 * @returns Array of FeatureCollections, one for each time zone
 * @throws Error if isochrones contain more than 3 polygons
 * 
 * @example
 * const isochrones = await generateWalkingIsochrones([34.7818, 32.0853], [5, 10, 15]);
 * const [zone5min, zone10min, zone15min] = separateIsochroneLayers(isochrones);
 */
export function separateIsochroneLayers(
    isochrones: FeatureCollection
): FeatureCollection[] {
    // Validate input
    if (!isochrones || !isochrones.features || isochrones.features.length === 0) {
        console.warn('⚠️ No features found in isochrones collection');
        return [];
    }
    
    const featureCount = isochrones.features.length;
    
    // Check that we don't have more than 3 polygons
    if (featureCount > 3) {
        const errorMsg = `Invalid isochrones: expected 3 or fewer polygons, but got ${featureCount}`;
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
    }
    
    console.log(`📊 Separating ${featureCount} isochrone polygon(s) into individual layers`);
    
    // Sort features by walking minutes (ascending order: 5, 10, 15)
    const sortedFeatures = [...isochrones.features].sort((a, b) => {
        const timeA = a.properties?.walkingMinutes || a.properties?.contour || 0;
        const timeB = b.properties?.walkingMinutes || b.properties?.contour || 0;
        return timeA - timeB;
    });
    
    // Create separate FeatureCollection for each polygon
    const separateLayers: FeatureCollection[] = sortedFeatures.map((feature, index) => {
        const minutes = feature.properties?.walkingMinutes || feature.properties?.contour || (index + 1) * 5;
        
        console.log(`✅ Layer ${index + 1}: ${minutes} minute walking zone`);
        
        return {
            type: 'FeatureCollection',
            features: [feature]
        };
    });
    
    console.log(`🎯 Successfully created ${separateLayers.length} separate isochrone layers`);
    
    return separateLayers;
}

/**
 * Separate isochrones and validate exactly 3 zones
 * Strict version that requires exactly 3 polygons (5, 10, 15 minutes)
 * 
 * @param isochrones - FeatureCollection containing exactly 3 isochrone polygons
 * @returns Object with named zones: { zone5min, zone10min, zone15min }
 * @throws Error if not exactly 3 polygons
 * 
 * @example
 * const isochrones = await generateWalkingIsochrones([34.7818, 32.0853], [5, 10, 15]);
 * const { zone5min, zone10min, zone15min } = separateIsochroneLayersStrict(isochrones);
 */
export function separateIsochroneLayersStrict(
    isochrones: FeatureCollection
): {
    zone5min: FeatureCollection;
    zone10min: FeatureCollection;
    zone15min: FeatureCollection;
} {
    // Validate exactly 3 features
    if (!isochrones || !isochrones.features || isochrones.features.length !== 3) {
        const count = isochrones?.features?.length || 0;
        throw new Error(`Expected exactly 3 isochrone polygons, but got ${count}`);
    }
    
    const layers = separateIsochroneLayers(isochrones);
    
    return {
        zone5min: layers[0],
        zone10min: layers[1],
        zone15min: layers[2]
    };
}

// ============================================================================
// MEASUREMENT OPERATIONS
// ============================================================================

/**
 * Calculate area of a polygon feature
 * @param feature - Polygon feature
 * @returns Area in square meters
 */
export function calculateArea(feature: Feature<Polygon | MultiPolygon>): number {
    try {
        return turf.area(feature);
    } catch (error) {
        console.error('Area calculation failed:', error);
        return 0;
    }
}

/**
 * Calculate length of a line feature
 * @param feature - Line feature
 * @param units - Units for length (default: 'meters')
 * @returns Length in specified units
 */
export function calculateLength(
    feature: Feature<LineString | MultiLineString>,
    units: turf.Units = 'meters'
): number {
    try {
        return turf.length(feature, { units });
    } catch (error) {
        console.error('Length calculation failed:', error);
        return 0;
    }
}

/**
 * Calculate distance between two points
 * @param point1 - First point [lng, lat] or Point feature
 * @param point2 - Second point [lng, lat] or Point feature
 * @param units - Units for distance (default: 'meters')
 * @returns Distance in specified units
 */
export function calculateDistance(
    point1: [number, number] | Feature<Point>,
    point2: [number, number] | Feature<Point>,
    units: turf.Units = 'meters'
): number {
    try {
        const p1 = Array.isArray(point1) ? turf.point(point1) : point1;
        const p2 = Array.isArray(point2) ? turf.point(point2) : point2;
        return turf.distance(p1, p2, { units });
    } catch (error) {
        console.error('Distance calculation failed:', error);
        return 0;
    }
}

/**
 * Calculate perimeter of a polygon
 * @param feature - Polygon feature
 * @param units - Units for perimeter (default: 'meters')
 * @returns Perimeter in specified units
 */
export function calculatePerimeter(
    feature: Feature<Polygon | MultiPolygon>,
    units: turf.Units = 'meters'
): number {
    try {
        // Convert polygon to linestring and calculate length
        const lineString = turf.polygonToLine(feature);
        if (!lineString) return 0;
        
        const lines = lineString.type === 'FeatureCollection' 
            ? lineString.features 
            : [lineString];
        
        return lines.reduce((total, line) => {
            return total + turf.length(line, { units });
        }, 0);
    } catch (error) {
        console.error('Perimeter calculation failed:', error);
        return 0;
    }
}

// ============================================================================
// SPATIAL RELATIONSHIPS
// ============================================================================

/**
 * Check if a point is inside a polygon
 * @param point - Point coordinates [lng, lat] or Point feature
 * @param polygon - Polygon feature
 * @returns True if point is inside polygon
 */
export function pointInPolygon(
    point: [number, number] | Feature<Point>,
    polygon: Feature<Polygon | MultiPolygon>
): boolean {
    try {
        const pt = Array.isArray(point) ? turf.point(point) : point;
        return turf.booleanPointInPolygon(pt, polygon);
    } catch (error) {
        console.error('Point in polygon check failed:', error);
        return false;
    }
}

/**
 * Filter features that are within a boundary polygon
 * @param features - Features to filter
 * @param boundary - Boundary polygon
 * @returns Features within boundary
 */
export function selectByLocation(
    features: Feature[],
    boundary: Feature<Polygon | MultiPolygon>,
    relationship: 'within' | 'intersects' | 'contains' = 'intersects'
): Feature[] {
    return features.filter(feature => {
        try {
            switch (relationship) {
                case 'within':
                    return turf.booleanWithin(feature, boundary);
                case 'intersects':
                    return turf.booleanIntersects(feature, boundary);
                case 'contains':
                    return turf.booleanContains(boundary, feature);
                default:
                    return false;
            }
        } catch (error) {
            return false;
        }
    });
}

/**
 * Find nearest feature to a point
 * @param point - Reference point
 * @param features - Candidate features
 * @returns Nearest feature and distance
 */
export function findNearest(
    point: [number, number] | Feature<Point>,
    features: Feature[]
): { feature: Feature; distance: number } | null {
    if (features.length === 0) return null;
    
    const pt = Array.isArray(point) ? turf.point(point) : point;
    let nearest: Feature | null = null;
    let minDistance = Infinity;
    
    features.forEach(feature => {
        try {
            const dist = turf.distance(pt, turf.centroid(feature));
            if (dist < minDistance) {
                minDistance = dist;
                nearest = feature;
            }
        } catch (error) {
            // Skip invalid features
        }
    });
    
    return nearest ? { feature: nearest, distance: minDistance } : null;
}

/**
 * Spatial join - join attributes from nearby features
 * @param targetFeatures - Features to join to
 * @param joinFeatures - Features to join from
 * @param maxDistance - Maximum distance for join (meters)
 * @returns Target features with joined attributes
 */
export function spatialJoin(
    targetFeatures: Feature[],
    joinFeatures: Feature[],
    maxDistance: number = 0
): Feature[] {
    return targetFeatures.map(target => {
        const targetCentroid = turf.centroid(target);
        let nearestJoin: Feature | null = null;
        let minDist = Infinity;
        
        joinFeatures.forEach(join => {
            try {
                const joinCentroid = turf.centroid(join);
                const dist = turf.distance(targetCentroid, joinCentroid, { units: 'meters' });
                
                if (dist <= maxDistance && dist < minDist) {
                    minDist = dist;
                    nearestJoin = join;
                }
            } catch (error) {
                // Skip invalid features
            }
        });
        
        return {
            ...target,
            properties: {
                ...target.properties,
                ...(nearestJoin?.properties || {}),
                joinDistance: minDist === Infinity ? null : minDist
            }
        };
    });
}

// ============================================================================
// GEOMETRIC TRANSFORMATIONS
// ============================================================================

/**
 * Get centroid of a feature
 * @param feature - Input feature
 * @returns Centroid point feature
 */
export function getCentroid(feature: Feature): Feature<Point> {
    return turf.centroid(feature);
}

/**
 * Get centroids of multiple features
 * @param features - Input features
 * @returns Array of centroid point features
 */
export function getCentroids(features: Feature[]): Feature<Point>[] {
    return features.map(feature => turf.centroid(feature));
}

/**
 * Simplify geometry by removing vertices
 * @param feature - Feature to simplify
 * @param tolerance - Simplification tolerance
 * @param highQuality - Use high quality algorithm (slower)
 * @returns Simplified feature
 */
export function simplify(
    feature: Feature,
    tolerance: number = 0.01,
    highQuality: boolean = false
): Feature {
    try {
        return turf.simplify(feature, { tolerance, highQuality });
    } catch (error) {
        console.error('Simplify operation failed:', error);
        return feature;
    }
}

/**
 * Create convex hull around features
 * @param features - Input features
 * @returns Convex hull polygon
 */
export function convexHull(features: Feature[]): Feature<Polygon> | null {
    try {
        const featureCollection: FeatureCollection = {
            type: 'FeatureCollection',
            features
        };
        return turf.convex(featureCollection);
    } catch (error) {
        console.error('Convex hull operation failed:', error);
        return null;
    }
}

/**
 * Create bounding box around features
 * @param features - Input features
 * @returns Bounding box polygon
 */
export function boundingBox(features: Feature | Feature[]): Feature<Polygon> {
    const inputFeatures = Array.isArray(features) ? features : [features];
    const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: inputFeatures
    };
    
    const bbox = turf.bbox(featureCollection);
    return turf.bboxPolygon(bbox);
}

// ============================================================================
// GRID & TESSELLATION
// ============================================================================

/**
 * Create a grid of points
 * @param bbox - Bounding box [minX, minY, maxX, maxY]
 * @param cellSize - Size of grid cells in specified units
 * @param units - Distance units (default: 'meters')
 * @returns Point grid features
 */
export function createPointGrid(
    bbox: [number, number, number, number],
    cellSize: number,
    units: turf.Units = 'meters'
): FeatureCollection<Point> {
    return turf.pointGrid(bbox, cellSize, { units });
}

/**
 * Create a grid of polygons
 * @param bbox - Bounding box [minX, minY, maxX, maxY]
 * @param cellSize - Size of grid cells in specified units
 * @param units - Distance units (default: 'meters')
 * @returns Polygon grid features
 */
export function createPolygonGrid(
    bbox: [number, number, number, number],
    cellSize: number,
    units: turf.Units = 'meters'
): FeatureCollection<Polygon> {
    return turf.squareGrid(bbox, cellSize, { units });
}

/**
 * Create a hexagonal grid
 * @param bbox - Bounding box [minX, minY, maxX, maxY]
 * @param cellSize - Size of hexagon cells in specified units
 * @param units - Distance units (default: 'meters')
 * @returns Hexagonal grid features
 */
export function createHexGrid(
    bbox: [number, number, number, number],
    cellSize: number,
    units: turf.Units = 'meters'
): FeatureCollection<Polygon> {
    return turf.hexGrid(bbox, cellSize, { units });
}

// ============================================================================
// STATISTICAL OPERATIONS
// ============================================================================

/**
 * Calculate statistics for numeric attributes
 * @param features - Input features
 * @param attributeKey - Property key to calculate statistics for
 * @returns Statistics object
 */
export function calculateStatistics(
    features: Feature[],
    attributeKey: string
): {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
} {
    const values: number[] = features
        .map(f => f.properties?.[attributeKey])
        .filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) {
        return { count: 0, sum: 0, min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = values.length % 2 === 0
        ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
        : sorted[Math.floor(values.length / 2)];
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
        count: values.length,
        sum,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean,
        median,
        stdDev
    };
}

/**
 * Count points in polygons
 * @param points - Point features
 * @param polygons - Polygon features
 * @returns Polygons with point count property
 */
export function countPointsInPolygons(
    points: Feature<Point>[],
    polygons: Feature<Polygon | MultiPolygon>[]
): Feature<Polygon | MultiPolygon>[] {
    return polygons.map(polygon => {
        const count = points.filter(point => {
            try {
                return turf.booleanPointInPolygon(point, polygon);
            } catch {
                return false;
            }
        }).length;
        
        return {
            ...polygon,
            properties: {
                ...polygon.properties,
                pointCount: count
            }
        };
    });
}

// ============================================================================
// VALIDATION & REPAIR
// ============================================================================

/**
 * Check if a feature geometry is valid
 * @param feature - Feature to validate
 * @returns True if valid, false otherwise
 */
export function isValidGeometry(feature: Feature): boolean {
    try {
        // Try to calculate area/length - will throw if invalid
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            turf.area(feature);
        } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
            turf.length(feature);
        }
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Attempt to repair invalid geometries
 * @param feature - Feature to repair
 * @returns Repaired feature or original if repair fails
 */
export function repairGeometry(feature: Feature): Feature {
    try {
        // For polygons, try using buffer with 0 distance
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            const buffered = turf.buffer(feature, 0);
            if (buffered && isValidGeometry(buffered)) {
                return { ...buffered, properties: feature.properties };
            }
        }
        return feature;
    } catch (error) {
        console.error('Geometry repair failed:', error);
        return feature;
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert feature collection to array of features
 * @param featureCollection - FeatureCollection
 * @returns Array of features
 */
export function featureCollectionToArray(featureCollection: FeatureCollection): Feature[] {
    return featureCollection.features;
}

/**
 * Convert array of features to feature collection
 * @param features - Array of features
 * @returns FeatureCollection
 */
export function arrayToFeatureCollection(features: Feature[]): FeatureCollection {
    return {
        type: 'FeatureCollection',
        features
    };
}

/**
 * Get bounding box coordinates for features
 * @param features - Input features
 * @returns Bounding box [minX, minY, maxX, maxY]
 */
export function getBoundingBox(features: Feature | Feature[]): [number, number, number, number] {
    const inputFeatures = Array.isArray(features) ? features : [features];
    const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: inputFeatures
    };
    return turf.bbox(featureCollection) as [number, number, number, number];
}

/**
 * Remove duplicate features based on geometry
 * @param features - Input features
 * @returns Deduplicated features
 */
export function removeDuplicates(features: Feature[]): Feature[] {
    const seen = new Set<string>();
    return features.filter(feature => {
        const geomString = JSON.stringify(feature.geometry);
        if (seen.has(geomString)) {
            return false;
        }
        seen.add(geomString);
        return true;
    });
}

/**
 * Duplicate/clone a feature
 * Creates a deep copy of a feature so modifications don't affect the original
 * 
 * @param feature - Feature to duplicate
 * @param propertyOverrides - Optional properties to override in the duplicate
 * @returns Duplicated feature
 * 
 * @example
 * const original = turf.point([34.78, 32.08], { name: 'Point A' });
 * const duplicate = duplicateFeature(original, { name: 'Point A Copy' });
 */
export function duplicateFeature(
    feature: Feature,
    propertyOverrides?: Record<string, any>
): Feature {
    // Deep clone using JSON parse/stringify
    const duplicated: Feature = JSON.parse(JSON.stringify(feature));
    
    // Apply property overrides if provided
    if (propertyOverrides) {
        duplicated.properties = {
            ...duplicated.properties,
            ...propertyOverrides
        };
    }
    
    return duplicated;
}

/**
 * Duplicate/clone multiple features
 * Creates deep copies of features so modifications don't affect the originals
 * 
 * @param features - Features to duplicate
 * @param propertyOverrides - Optional properties to override in all duplicates
 * @returns Array of duplicated features
 * 
 * @example
 * const duplicates = duplicateFeatures(originalFeatures, { layer: 'copy' });
 */
export function duplicateFeatures(
    features: Feature[],
    propertyOverrides?: Record<string, any>
): Feature[] {
    return features.map(feature => duplicateFeature(feature, propertyOverrides));
}

/**
 * Duplicate/clone a feature collection
 * Creates a deep copy of a feature collection so modifications don't affect the original
 * 
 * @param featureCollection - FeatureCollection to duplicate
 * @param propertyOverrides - Optional properties to override in all features
 * @returns Duplicated FeatureCollection
 * 
 * @example
 * const original = { type: 'FeatureCollection', features: [...] };
 * const duplicate = duplicateFeatureCollection(original);
 */
export function duplicateFeatureCollection(
    featureCollection: FeatureCollection,
    propertyOverrides?: Record<string, any>
): FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: duplicateFeatures(featureCollection.features, propertyOverrides)
    };
}

/**
 * Duplicate/clone a layer (works with both single features and collections)
 * Creates a deep copy so modifications don't affect the original
 * 
 * @param layer - Feature or FeatureCollection to duplicate
 * @param propertyOverrides - Optional properties to override
 * @returns Duplicated layer
 * 
 * @example
 * const duplicate = duplicateLayer(originalLayer, { name: 'Layer Copy', color: '#ff0000' });
 */
export function duplicateLayer(
    layer: Feature | FeatureCollection,
    propertyOverrides?: Record<string, any>
): Feature | FeatureCollection {
    if (layer.type === 'FeatureCollection') {
        return duplicateFeatureCollection(layer as FeatureCollection, propertyOverrides);
    } else {
        return duplicateFeature(layer as Feature, propertyOverrides);
    }
}

/**
 * Format area value with appropriate units
 * @param areaInSquareMeters - Area in square meters
 * @returns Formatted string with units
 */
export function formatArea(areaInSquareMeters: number): string {
    if (areaInSquareMeters < 10000) {
        return `${areaInSquareMeters.toFixed(2)} m²`;
    } else if (areaInSquareMeters < 1000000) {
        return `${(areaInSquareMeters / 10000).toFixed(2)} hectares`;
    } else {
        return `${(areaInSquareMeters / 1000000).toFixed(2)} km²`;
    }
}

/**
 * Format distance value with appropriate units
 * @param distanceInMeters - Distance in meters
 * @returns Formatted string with units
 */
export function formatDistance(distanceInMeters: number): string {
    if (distanceInMeters < 1000) {
        return `${distanceInMeters.toFixed(2)} m`;
    } else {
        return `${(distanceInMeters / 1000).toFixed(2)} km`;
    }
}
