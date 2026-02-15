import React from 'react';
import { Info } from 'lucide-react';
import { StageData } from './types';

interface StageProgressProps {
    currentStage: number;
    stageData: StageData;
}

export const StageProgress: React.FC<StageProgressProps> = ({
    currentStage,
    stageData
}) => {
    if (currentStage === 0) {
        return (
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-start gap-2">
                    <Info size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-indigo-800">
                        This model calculates a weighted quality score (1-5) based on green space coverage within 15-minute walking distance.
                        Pick a point and run analysis to proceed step-by-step.
                    </p>
                </div>
            </div>
        );
    }

    const getStageTitle = (stage: number) => {
        switch (stage) {
            case 1: return '📍 15-min Isochrone Generated';
            case 2: return '🌳 Garden Layer Loaded';
            case 3: return '✂️ Cut Gardens by 15-min Boundary';
            case 4: return '🔴 Clipped Layer Displayed (Red)';
            case 5: return '📊 All Calculations Complete';
            case 6: return '⭐ Final Score (1-5)';
            default: return '';
        }
    };

    const getStageDescription = (stage: number) => {
        switch (stage) {
            case 1: return '15-minute walking distance isochrone shown on map';
            case 2: return 'Full garden layer "שטחים ירוקים" added to map';
            case 3: return 'Using "cut by boundary" function to clip gardens';
            case 4: return 'Clipped gardens displayed in red - original layer removed';
            case 5: return 'Garden area, isochrone area, and coverage percentage calculated';
            case 6: return 'Final score calculated (10% coverage = perfect 5.0)';
            default: return '';
        }
    };

    return (
        <div className="mt-4 space-y-3">
            <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold">
                                Stage {currentStage}/6
                            </div>
                            <h4 className="font-bold text-slate-800">
                                {getStageTitle(currentStage)}
                            </h4>
                        </div>
                        <p className="text-sm text-slate-700">
                            {getStageDescription(currentStage)}
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Calculation Numbers Display */}
            {currentStage >= 5 && (
                <div className="grid grid-cols-2 gap-2">
                    {stageData.clippedLayer && (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">Clipped Features</div>
                            <div className="text-xl font-bold text-red-700">
                                {stageData.clippedLayer.data.features.length}
                            </div>
                            <div className="text-xs text-slate-600">segments</div>
                        </div>
                    )}
                    {stageData.gardenArea !== undefined && (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">🌳 Garden Area</div>
                            <div className="text-xl font-bold text-green-700">
                                {stageData.gardenArea.toLocaleString('en-US', {maximumFractionDigits: 0})}
                            </div>
                            <div className="text-xs text-slate-600">m²</div>
                        </div>
                    )}
                    {stageData.isochroneArea !== undefined && (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">📐 Isochrone Area</div>
                            <div className="text-xl font-bold text-blue-700">
                                {stageData.isochroneArea.toLocaleString('en-US', {maximumFractionDigits: 0})}
                            </div>
                            <div className="text-xs text-slate-600">m²</div>
                        </div>
                    )}
                    {stageData.percentage !== undefined && (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1">💚 Coverage</div>
                            <div className="text-xl font-bold text-green-700">
                                {stageData.percentage.toFixed(2)}%
                            </div>
                            <div className="text-xs text-slate-600">garden/isochrone</div>
                        </div>
                    )}
                    {currentStage >= 6 && stageData.score !== undefined && (
                        <div className="col-span-2 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-300 rounded-lg">
                            <div className="text-center">
                                <div className="text-sm text-purple-600 mb-1 font-medium">🎯 Final Quality Score</div>
                                <div className="text-4xl font-bold text-purple-700">
                                    {stageData.score.toFixed(2)}
                                </div>
                                <div className="text-sm text-purple-600">/5.00</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
