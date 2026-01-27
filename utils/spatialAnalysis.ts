import { Feature, FeatureCollection, Point } from 'geojson';
import * as turf from '@turf/turf';

// Mapbox token from your existing config
const MAPBOX_TOKEN = import.meta.env.MAPBOX_TOKEN || 'pk.eyJ1IjoiYXBlcmVtZW4iLCJhIjoiY2p2M2g3N2Y4MDk2bDRlcDJ2Y3R0dnNocCJ9.oMUpX3SDvmCFGW1o9qkzoQ';

/**
 * Generates isochrone polygons based on actual walking network (roads)
 * Uses Mapbox Isochrone API for accurate network-based isochrones
 * Real isochrones follow streets and roads, NOT circular buffers
 */
export const generateWalkingIsochrones = async (
    point: [number, number],
    minutes: number[] = [5, 10, 15]
): Promise<FeatureCollection> => {
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
                
                // Mapbox Isochrone API - no CORS issues!
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
};

/**
 * Fallback: Simple circular buffers (NOT real isochrones)
 */
const generateBufferIsochrones = (
    point: [number, number],
    minutes: number[] = [5, 10, 15]
): FeatureCollection => {
    const walkingSpeedMsPerSecond = 1.4;
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
                color: colors[idx],
                source: 'Circular Buffer (Fallback)',
                type: 'isochrone'
            };
            features.push(polygon);
        } catch (error) {
            console.error(`Buffer error:`, error);
        }
    });
    
    return { type: 'FeatureCollection', features };
};

export const generateAccessibilityZones = (
    point: [number, number],
    radiusMeters: number = 1000
): FeatureCollection => {
    const radiusKm = radiusMeters / 1000;
    const zones = [];
    const intervals = [0.25, 0.5, 0.75, 1];
    
    intervals.forEach((factor, idx) => {
        const zone = turf.buffer(turf.point(point), radiusKm * factor, { units: 'kilometers' });
        zone.properties = {
            zone: Math.round(factor * 100),
            radiusMeters: radiusMeters * factor,
            opacity: 0.6 - (idx * 0.1)
        };
        zones.push(zone);
    });
    
    return { type: 'FeatureCollection', features: zones };
};

export const analyzeProximity = (sourcePoint: Point, targetFeatures: Feature[]): Feature[] => {
    const sourcePt = turf.point(sourcePoint.coordinates);
    
    return targetFeatures
        .filter(f => f.geometry && (f.geometry.type === 'Point' || f.geometry.type === 'Polygon' || f.geometry.type === 'LineString'))
        .map(f => {
            let distanceKm = 0;
            try {
                if (f.geometry?.type === 'Point') {
                    distanceKm = turf.distance(sourcePt, turf.point(f.geometry.coordinates as [number, number]), { units: 'kilometers' });
                } else {
                    const nearest = turf.nearestPointOnLine(sourcePt, f);
                    distanceKm = turf.distance(sourcePt, nearest, { units: 'kilometers' });
                }
            } catch (error) {
                distanceKm = Infinity;
            }
            return {
                ...f,
                properties: {
                    ...f.properties,
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceMeters: Math.round(distanceKm * 1000)
                }
            };
        })
        .sort((a, b) => ((a.properties?.distanceKm as number) || Infinity) - ((b.properties?.distanceKm as number) || Infinity));
};

export const findFeaturesWithinDistance = (
    sourcePoint: [number, number],
    targetFeatures: Feature[],
    radiusKm: number
): Feature[] => {
    const sourcePt = turf.point(sourcePoint);
    return targetFeatures.filter(f => {
        if (!f.geometry) return false;
        try {
            if (f.geometry.type === 'Point') {
                return turf.distance(sourcePt, turf.point(f.geometry.coordinates as [number, number]), { units: 'kilometers' }) <= radiusKm;
            } else if (f.geometry.type === 'Polygon') {
                return turf.booleanPointInPolygon(sourcePt, f as any);
            } else {
                const nearest = turf.nearestPointOnLine(sourcePt, f);
                return turf.distance(sourcePt, nearest, { units: 'kilometers' }) <= radiusKm;
            }
        } catch (error) {
            return false;
        }
    });
};
