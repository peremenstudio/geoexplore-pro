import React from 'react';
import { FlaskConical, Play, Loader2, Trash2 } from 'lucide-react';

interface ResearchHeaderProps {
    isCalculating: boolean;
    samplePointLocation: { lat: number; lng: number } | null;
    currentStage: number;
    onRunAnalysis: () => void;
    onClearAnalysis: () => void;
}

export const ResearchHeader: React.FC<ResearchHeaderProps> = ({
    isCalculating,
    samplePointLocation,
    currentStage,
    onRunAnalysis,
    onClearAnalysis
}) => {
    return (
        <div className="p-6 bg-white border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <FlaskConical size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Research Lab</h2>
                        <p className="text-sm text-slate-500">Multi-Criteria Urban Accessibility Model</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onRunAnalysis}
                        disabled={isCalculating || !samplePointLocation || currentStage > 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isCalculating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                Run Analysis
                            </>
                        )}
                    </button>
                </div>
                {currentStage > 0 && (
                    <button
                        onClick={onClearAnalysis}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-all flex items-center gap-2"
                    >
                        <Trash2 size={16} />
                        Clear Analysis
                    </button>
                )}
            </div>
        </div>
    );
};
