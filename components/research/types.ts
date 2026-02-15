import { Layer } from '../../types';
import { Feature } from 'geojson';

export interface ResearchViewProps {
    layers: Layer[];
    onAddLayer?: (layer: Layer) => void;
    onRemoveLayer?: (layerId: string) => void;
    isPickingPoint: boolean;
    onSetIsPickingPoint: (value: boolean) => void;
    samplePointLocation: { lat: number; lng: number } | null;
    onSetSamplePointLocation: (location: { lat: number; lng: number } | null) => void;
    analysisResults: AnalysisResults;
    onSetAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResults>>;
    storedIsochrones: any;
    onSetStoredIsochrones: React.Dispatch<React.SetStateAction<any>>;
    runningAnalysis: string | null;
    onSetRunningAnalysis: React.Dispatch<React.SetStateAction<string | null>>;
}

export interface CategoryWeights {
    urban: number;
    social: number;
    economic: number;
    historical: number;
}

export type IndicatorCategory = 'urban' | 'social' | 'economic' | 'historical';
export type ZoneSensitivity = 'high' | 'medium' | 'low';

export interface Indicator {
    id: string;
    name: string;
    category: IndicatorCategory;
    enabled: boolean;
    dataSource: string;
    layerId?: string;
    zoneSensitivity: ZoneSensitivity;
}

export interface AnalysisResults {
    isochroneArea: { zone5: number | null; zone10: number | null; zone15: number | null };
    gardens: { zone5: number | null; zone10: number | null; zone15: number | null };
    gardenScores: { zone5: number | null; zone10: number | null; zone15: number | null };
    busStations: { zone5: number | null; zone10: number | null; zone15: number | null };
    busStationScores: { zone5: number | null; zone10: number | null; zone15: number | null };
}

export interface StageData {
    isochrones?: any;
    greenSpaceLayer?: Layer;
    clippedFeatures?: Feature[];
    clippedLayer?: Layer;
    gardenArea?: number;
    isochroneArea?: number;
    percentage?: number;
    score?: number;
}

export interface CategorizedPoints {
    urban: Feature[];
    social: Feature[];
    economic: Feature[];
    historical: Feature[];
}

export interface ZoneMultiplier {
    min: number;
    max: number;
    multiplier: number;
    label: string;
}
