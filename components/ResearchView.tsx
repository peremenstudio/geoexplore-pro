import React, { useState, useMemo } from 'react';
import { Layer } from '../types';
import { Feature } from 'geojson';
import { MapPin, Loader2 } from 'lucide-react';
import Slider from '@mui/material/Slider';
import {
    ResearchViewProps,
    CategoryWeights,
    Indicator,
    DEFAULT_INDICATORS,
    DEFAULT_WEIGHTS,
    CITY_COORDINATES,
    useResearchAnalysis,
    AnalysisTable
} from './research';

export const ResearchView: React.FC<ResearchViewProps> = ({ 
    layers,
    onAddLayer,
    onRemoveLayer,
    isPickingPoint,
    onSetIsPickingPoint,
    samplePointLocation,
    onSetSamplePointLocation,
    analysisResults: externalAnalysisResults,
    onSetAnalysisResults,
    storedIsochrones: externalStoredIsochrones,
    onSetStoredIsochrones,
    runningAnalysis: externalRunningAnalysis,
    onSetRunningAnalysis
}) => {
    // Category weights (0-100)
    const [weights, setWeights] = useState<CategoryWeights>(DEFAULT_WEIGHTS);

    // Sample points configuration
    const [gridMode, setGridMode] = useState<'single' | 'grid'>('single');
    const [gridSpacing, setGridSpacing] = useState(500);
    const [selectedCity, setSelectedCity] = useState<string>('Tel Aviv');
    
    // Available indicators
    const [indicators, setIndicators] = useState<Indicator[]>(DEFAULT_INDICATORS);

    // Use the research analysis hook
    const {
        analysisResults,
        runningAnalysis,
        calculateTransitScore,
        handleIsochroneAreaAnalysis,
        handleGardensAnalysis,
        handleBusStationsAnalysis
    } = useResearchAnalysis({
        layers,
        onAddLayer,
        onRemoveLayer,
        analysisResults: externalAnalysisResults,
        setAnalysisResults: onSetAnalysisResults,
        storedIsochrones: externalStoredIsochrones,
        setStoredIsochrones: onSetStoredIsochrones,
        runningAnalysis: externalRunningAnalysis,
        setRunningAnalysis: onSetRunningAnalysis
    });

    // Handle weight change - ensure all weights sum to 100%
    const handleWeightChange = (category: keyof CategoryWeights, newValue: number) => {
        setWeights(prev => {
            const oldValue = prev[category];
            const difference = newValue - oldValue;
            
            if (difference === 0) return prev;
            
            const otherCategories = (Object.keys(prev) as Array<keyof CategoryWeights>)
                .filter(cat => cat !== category);
            
            const changePerCategory = -difference / 3;
            
            const newWeights = { ...prev, [category]: newValue };
            
            otherCategories.forEach((cat, index) => {
                if (index === otherCategories.length - 1) {
                    newWeights[cat] = Math.round((100 - newValue - newWeights[otherCategories[0]] - newWeights[otherCategories[1]]) * 10) / 10;
                } else {
                    newWeights[cat] = Math.max(0, Math.min(100, Math.round((prev[cat] + changePerCategory) * 10) / 10));
                }
            });
            
            return newWeights;
        });
    };

    // Toggle indicator
    const toggleIndicator = (id: string) => {
        setIndicators(prev => prev.map(ind => 
            ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
        ));
    };

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <MapPin size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Research Lab</h2>
                        <p className="text-sm text-slate-500">Multi-Criteria Urban Accessibility Model</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Sample Point Configuration */}
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <MapPin size={18} className="text-indigo-600" />
                        Sample Point Configuration
                    </h3>
                    
                    <div className="space-y-4">
                        {/* City Selection */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select City to Zoom</label>
                            <select
                                value={selectedCity}
                                onChange={(e) => setSelectedCity(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            >
                                {Object.keys(CITY_COORDINATES).map(city => (
                                    <option key={city} value={city}>{city}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">
                                Selected: {selectedCity} - Use map controls to navigate
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Analysis Mode</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setGridMode('single')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        gridMode === 'single'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    Single Point
                                </button>
                                <button
                                    onClick={() => setGridMode('grid')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        gridMode === 'grid'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    Grid Sampling
                                </button>
                            </div>
                        </div>

                        {gridMode === 'grid' && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Grid Spacing: {gridSpacing}m
                                </label>
                                <Slider
                                    value={gridSpacing}
                                    onChange={(_, value) => setGridSpacing(value as number)}
                                    min={100}
                                    max={1000}
                                    step={50}
                                    valueLabelDisplay="auto"
                                    sx={{
                                        color: '#4f46e5',
                                        '& .MuiSlider-thumb': {
                                            backgroundColor: '#4f46e5'
                                        }
                                    }}
                                />
                            </div>
                        )}

                        <button
                            onClick={() => {
                                onSetIsPickingPoint(!isPickingPoint);
                                if (!isPickingPoint) {
                                    console.log('🗺️ Click on the map to select a research point');
                                }
                            }}
                            className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                isPickingPoint
                                    ? 'bg-red-100 text-red-700 border-2 border-red-300 animate-pulse'
                                    : 'bg-indigo-100 text-indigo-700 border border-indigo-300 hover:bg-indigo-200'
                            }`}
                        >
                            {isPickingPoint ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Click on Map to Select Point
                                </>
                            ) : (
                                <>
                                    <MapPin size={16} />
                                    Pick Location on Map
                                </>
                            )}
                        </button>

                        {samplePointLocation && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                <strong>Selected:</strong> {samplePointLocation.lat.toFixed(6)}, {samplePointLocation.lng.toFixed(6)}
                            </div>
                        )}
                    </div>
                </section>

                {/* Analysis Table */}
                <AnalysisTable
                    analysisResults={analysisResults}
                    runningAnalysis={runningAnalysis}
                    samplePointLocation={samplePointLocation}
                    onIsochroneAreaAnalysis={() => handleIsochroneAreaAnalysis(samplePointLocation)}
                    onGardensAnalysis={() => handleGardensAnalysis(samplePointLocation, analysisResults)}
                    onBusStationsAnalysis={() => handleBusStationsAnalysis(samplePointLocation)}
                    calculateTransitScore={calculateTransitScore}
                />
            </div>
        </div>
    );
};
