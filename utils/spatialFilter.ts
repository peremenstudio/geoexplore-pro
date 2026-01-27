import * as turf from '@turf/turf';
import { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';

/**
 * Filter points that fall within a polygon boundary
 */
export const filterPointsByPolygon = (
  points: Feature<Point>[],
  polygon: Feature<Polygon | MultiPolygon>
): Feature<Point>[] => {
  return points.filter(point => {
    try {
      return turf.booleanPointInPolygon(point, polygon);
    } catch (e) {
      console.warn('Error checking point in polygon:', e);
      return false;
    }
  });
};

/**
 * Filter all features by polygon boundary (works with points, polygons, etc)
 */
export const filterFeaturesByPolygon = (
  features: Feature[],
  polygon: Feature<Polygon | MultiPolygon>
): Feature[] => {
  return features.filter(feature => {
    try {
      if (feature.geometry.type === 'Point') {
        return turf.booleanPointInPolygon(feature as Feature<Point>, polygon);
      } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        // For polygons, check if centroid is inside
        const centroid = turf.centroid(feature);
        return turf.booleanPointInPolygon(centroid, polygon);
      } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        // For lines, check if start point is inside
        const coords = feature.geometry.type === 'LineString' 
          ? feature.geometry.coordinates 
          : feature.geometry.coordinates[0];
        const point = turf.point(coords[0] as [number, number]);
        return turf.booleanPointInPolygon(point, polygon);
      }
      return false;
    } catch (e) {
      console.warn('Error checking feature in polygon:', e);
      return false;
    }
  });
};

/**
 * Get the intersection of two geometries
 */
export const intersectGeometries = (
  features: Feature[],
  boundary: Feature<Polygon | MultiPolygon>
): Feature[] => {
  return filterFeaturesByPolygon(features, boundary);
};
