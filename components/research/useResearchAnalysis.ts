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
    analysisResults: AnalysisResults;
    setAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResults>>;
    storedIsochrones: any;
    setStoredIsochrones: React.Dispatch<React.SetStateAction<any>>;
    runningAnalysis: string | null;
    setRunningAnalysis: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useResearchAnalysis = ({
    layers,
    onAddLayer,
    onRemoveLayer,
    analysisResults,
    setAnalysisResults,
    storedIsochrones,
    setStoredIsochrones,
    runningAnalysis,
    setRunningAnalysis
}: UseResearchAnalysisProps) => {

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
