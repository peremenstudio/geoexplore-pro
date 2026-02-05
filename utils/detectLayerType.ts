import { FeatureCollection } from 'geojson';

/**
 * Detects the primary layer type from GeoJSON features
 * Returns 'polygon', 'line', or 'point'
 */
export function detectLayerType(geojson: FeatureCollection): 'polygon' | 'line' | 'point' {
  if (!geojson.features || geojson.features.length === 0) {
    return 'point';
  }

  // Count geometry types
  const typeCounts: Record<string, number> = {};
  
  for (const feature of geojson.features) {
    const geomType = feature.geometry?.type;
    if (geomType) {
      typeCounts[geomType] = (typeCounts[geomType] || 0) + 1;
    }
  }

  // Determine primary type based on most common geometry
  const hasPolygon = (typeCounts['Polygon'] || 0) + (typeCounts['MultiPolygon'] || 0);
  const hasLine = (typeCounts['LineString'] || 0) + (typeCounts['MultiLineString'] || 0);
  const hasPoint = (typeCounts['Point'] || 0) + (typeCounts['MultiPoint'] || 0);

  // Priority: polygon > line > point
  if (hasPolygon > 0) {
    return 'polygon';
  } else if (hasLine > 0) {
    return 'line';
  } else {
    return 'point';
  }
}
