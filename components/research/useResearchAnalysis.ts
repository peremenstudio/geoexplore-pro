import { useState } from 'react';
import { Layer } from '../../types';
import { AnalysisResults } from './types';
import { 
    runIsochroneAreaAnalysis, 
    runGardensAnalysis, 
    runBusStationsAnalysis 
} from './analyses';

interface UseResearchAnalysisProps {
    layers: Layer[];
    onAddLayer?: (layer: Layer) => void;
    onRemoveLayer?: (layerId: string) => void;
}

export const useResearchAnalysis = ({
    layers,
    onAddLayer,
    onRemoveLayer
}: UseResearchAnalysisProps) => {
    const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({
        isochroneArea: { zone5: null, zone10: null, zone15: null },
        gardens: { zone5: null, zone10: null, zone15: null },
        gardenScores: { zone5: null, zone10: null, zone15: null },
        busStations: { zone5: null, zone10: null, zone15: null },
        busStationScores: { zone5: null, zone10: null, zone15: null }
    });
    const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null);
    const [storedIsochrones, setStoredIsochrones] = useState<any>(null);

    // Calculate transit score from bus station counts
    const calculateTransitScore = (
        zone5: number, 
        zone10: number, 
        zone15: number, 
        maxRawBenchmark: number = 10
    ): number => {
        const rawScore = Math.sqrt(zone5) * 1.0 + Math.sqrt(zone10) * 0.4 + Math.sqrt(zone15) * 0.1;
        const normalizedScore = 1 + (4 * (rawScore / maxRawBenchmark));
        const finalScore = Math.max(1, Math.min(5, normalizedScore));
        return finalScore;
    };

    // Individual analysis handlers for the table
    const handleIsochroneAreaAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
        await runIsochroneAreaAnalysis({
            samplePointLocation,
            onAddLayer,
            setAnalysisResults,
            setRunningAnalysis,
            setStoredIsochrones
        });
    };

    const handleGardensAnalysis = async (samplePointLocation: { lat: number; lng: number } | null, analysisResults: AnalysisResults) => {
        await runGardensAnalysis({
            samplePointLocation,
            storedIsochrones,
            analysisResults,
            onAddLayer,
            setAnalysisResults,
            setRunningAnalysis
        });
    };

    const handleBusStationsAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
        await runBusStationsAnalysis({
            samplePointLocation,
            storedIsochrones,
            onAddLayer,
            setAnalysisResults,
            setRunningAnalysis
        });
    };

    return {
        analysisResults,
        runningAnalysis,
        calculateTransitScore,
        handleIsochroneAreaAnalysis,
        handleGardensAnalysis,
        handleBusStationsAnalysis
    };
};
