import { FeatureCollection, Feature, Geometry, GeoJsonProperties } from 'geojson';

export interface GridConfig {
  show: boolean;
  showLabels: boolean;
  size: number; // in km
  opacity: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  data: FeatureCollection<Geometry, GeoJsonProperties>;
  color: string;
  opacity: number;
  type: 'point' | 'line' | 'polygon'; // simplified type hint
  grid: GridConfig;
  lastUpdated?: number;
  metadata?: {
    source?: string;
    fileId?: string;
    municipality?: string;
    year?: number;
    featureCount?: number;
    loadedAt?: string;
    fieldMetadata?: Array<{
      field: string;
      hebrewName: string;
      category: string;
    }>;
  };
}

export type AppView = 'map' | 'data' | 'explore' | 'analyze' | 'research';