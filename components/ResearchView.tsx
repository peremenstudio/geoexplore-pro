import React, { useState, useEffect, useMemo } from 'react';
import { Layer } from '../types';
import { Feature } from 'geojson';
import { FlaskConical, Sliders, Eye, EyeOff, Play, MapPin, Info, TrendingUp, Users, Building2, Landmark, Loader2, Trash2 } from 'lucide-react';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import { 
    generateSimpleIsochrones, 
    filterFeaturesByZone, 
    calculateIndicatorScore,
    NormalizationFunctions,
    createSampleGrid
} from '../utils/researchScoring';
import { getNextLayerColor } from '../utils/layerColors';
import { generateWalkingIsochrones } from '../utils/spatialAnalysis';
import * as turf from '@turf/turf';

interface ResearchViewProps {
    layers: Layer[];
    onAddLayer?: (layer: Layer) => void;
    isPickingPoint: boolean;
    onSetIsPickingPoint: (value: boolean) => void;
    samplePointLocation: { lat: number; lng: number } | null;
    onSetSamplePointLocation: (location: { lat: number; lng: number } | null) => void;
    onSetResearchIsochrones?: (features: Feature[] | null) => void;
}

interface CategoryWeights {
    urban: number;
    social: number;
    economic: number;
    historical: number;
}

interface Indicator {
    id: string;
    name: string;
    category: 'urban' | 'social' | 'economic' | 'historical';
    enabled: boolean;
    dataSource: string;
    layerId?: string;
    zoneSensitivity: 'high' | 'medium' | 'low';
}

// Isochrone zone multipliers
const ZONE_MULTIPLIERS = {
    zoneA: { min: 0, max: 5, multiplier: 1.0, label: 'Zone A (0-5 min)' },
    zoneB: { min: 5, max: 10, multiplier: 0.6, label: 'Zone B (5-10 min)' },
    zoneC: { min: 10, max: 15, multiplier: 0.3, label: 'Zone C (10-15 min)' }
};

export const ResearchView: React.FC<ResearchViewProps> = ({ 
    layers,
    onAddLayer,
    isPickingPoint,
    onSetIsPickingPoint,
    samplePointLocation,
    onSetSamplePointLocation,
    onSetResearchIsochrones
}) => {
    // Category weights (0-100)
    const [weights, setWeights] = useState<CategoryWeights>({
        urban: 25,
        social: 25,
        economic: 25,
        historical: 25
    });

    // Sample points configuration - removed internal state, using props
    const [gridMode, setGridMode] = useState<'single' | 'grid'>('single');
    const [gridSpacing, setGridSpacing] = useState(500); // meters

    // Available indicators
    const [indicators, setIndicators] = useState<Indicator[]>([
        // Urban indicators
        { id: 'parks', name: 'Green Spaces & Parks', category: 'urban', enabled: true, dataSource: 'OSM', zoneSensitivity: 'medium' },
        { id: 'transit', name: 'Public Transport Stops', category: 'urban', enabled: true, dataSource: 'OSM', zoneSensitivity: 'high' },
        { id: 'bike', name: 'Bike Infrastructure', category: 'urban', enabled: false, dataSource: 'OSM', zoneSensitivity: 'medium' },
        { id: 'parking', name: 'Parking Availability', category: 'urban', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'low' },
        
        // Social indicators
        { id: 'schools', name: 'Educational Institutions', category: 'social', enabled: true, dataSource: 'OSM', zoneSensitivity: 'medium' },
        { id: 'healthcare', name: 'Healthcare Facilities', category: 'social', enabled: true, dataSource: 'OSM', zoneSensitivity: 'high' },
        { id: 'community', name: 'Community Centers', category: 'social', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'medium' },
        { id: 'sports', name: 'Sports & Recreation', category: 'social', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'low' },
        
        // Economic indicators
        { id: 'commercial', name: 'Commercial Density', category: 'economic', enabled: true, dataSource: 'OSM', zoneSensitivity: 'medium' },
        { id: 'retail', name: 'Retail & Shopping', category: 'economic', enabled: true, dataSource: 'OSM', zoneSensitivity: 'high' },
        { id: 'employment', name: 'Employment Centers', category: 'economic', enabled: false, dataSource: 'Census', zoneSensitivity: 'low' },
        { id: 'prices', name: 'Real Estate Prices', category: 'economic', enabled: false, dataSource: 'Nadlan', zoneSensitivity: 'low' },
        
        // Historical indicators
        { id: 'heritage', name: 'Heritage Sites', category: 'historical', enabled: true, dataSource: 'Municipal', zoneSensitivity: 'low' },
        { id: 'monuments', name: 'Monuments & Landmarks', category: 'historical', enabled: true, dataSource: 'OSM', zoneSensitivity: 'low' },
        { id: 'conservation', name: 'Conservation Areas', category: 'historical', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'medium' }
    ]);

    // Results
    const [calculationResults, setCalculationResults] = useState<any>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [categorizedPoints, setCategorizedPoints] = useState<{
        urban: Feature[];
        social: Feature[];
        economic: Feature[];
        historical: Feature[];
    } | null>(null);

    // Get available layers that can be used as indicators
    const availableLayers = useMemo(() => {
        return layers.filter(l => l.visible && l.data.features.length > 0);
    }, [layers]);

    // Handle weight change
    const handleWeightChange = (category: keyof CategoryWeights, value: number) => {
        setWeights(prev => ({
            ...prev,
            [category]: value
        }));
    };

    // Toggle indicator
    const toggleIndicator = (id: string) => {
        setIndicators(prev => prev.map(ind => 
            ind.id === id ? { ...ind, enabled: !ind.enabled } : ind
        ));
    };

    // Calculate quality score for a point
    const calculatePointScore = async (point: { lat: number; lng: number }) => {
        setIsCalculating(true);
        
        try {
            console.log('🔬 Starting Research Analysis for point:', point);
            
            // 1. Generate REAL walking isochrones using Mapbox API (road network based)
            const isochronesGeoJSON = await generateWalkingIsochrones([point.lng, point.lat], [5, 10, 15]);
            
            if (!isochronesGeoJSON.features || isochronesGeoJSON.features.length === 0) {
                alert('Failed to generate walking isochrones. Please try a different location.');
                return;
            }
            
            console.log('📍 Generated', isochronesGeoJSON.features.length, 'real walking-based isochrones');
            
            // 2. Get all features from visible layers
            const allFeatures: Feature[] = [];
            layers.forEach(layer => {
                if (layer.visible && layer.data.features.length > 0) {
                    allFeatures.push(...layer.data.features);
                }
            });
            
            console.log(`📊 Total features to analyze: ${allFeatures.length}`);

            // 3. Filter features by isochrone zones
            const featuresByZone = {
                A: [] as Feature[],
                B: [] as Feature[],
                C: [] as Feature[],
                outside: [] as Feature[]
            };
            
            // Check each feature against isochrones
            for (const feature of allFeatures) {
                let featurePoint: [number, number];
                
                if (feature.geometry.type === 'Point') {
                    featurePoint = feature.geometry.coordinates as [number, number];
                } else {
                    const centroid = turf.centroid(feature);
                    featurePoint = centroid.geometry.coordinates as [number, number];
                }
                
                const pt = turf.point(featurePoint);
                
                // Check in order: 5 min -> 10 min -> 15 min
                let assigned = false;
                for (let i = 0; i < isochronesGeoJSON.features.length; i++) {
                    const isoFeature = isochronesGeoJSON.features[i];
                    const minutes = isoFeature.properties?.walkingMinutes || (i === 0 ? 5 : i === 1 ? 10 : 15);
                    
                    try {
                        if (turf.booleanPointInPolygon(pt, isoFeature as any)) {
                            if (minutes <= 5) {
                                featuresByZone.A.push(feature);
                            } else if (minutes <= 10) {
                                featuresByZone.B.push(feature);
                            } else {
                                featuresByZone.C.push(feature);
                            }
                            assigned = true;
                            break;
                        }
                    } catch (e) {
                        // Skip invalid geometries
                    }
                }
                
                if (!assigned) {
                    featuresByZone.outside.push(feature);
                }
            }
            
            console.log('🎯 Features by zone:', {
                A: featuresByZone.A.length,
                B: featuresByZone.B.length,
                C: featuresByZone.C.length,
                outside: featuresByZone.outside.length
            });

            // 4. For each enabled indicator, calculate scores
            const categoryScores: Record<string, number[]> = {
                urban: [],
                social: [],
                economic: [],
                historical: []
            };

            const enabledIndicators = indicators.filter(ind => ind.enabled);
            
            enabledIndicators.forEach(indicator => {
                // Use appropriate normalization function based on indicator type
                let normalizeFunc = NormalizationFunctions.linearMoreIsBetter;
                
                // Customize based on indicator characteristics
                if (indicator.id === 'commercial' || indicator.id === 'retail') {
                    normalizeFunc = NormalizationFunctions.optimalRange;
                } else if (indicator.id === 'healthcare' || indicator.id === 'heritage') {
                    normalizeFunc = NormalizationFunctions.presenceBonus;
                }
                
                const score = calculateIndicatorScore({
                    featuresInZones: featuresByZone,
                    normalizeFunction: normalizeFunc
                });
                
                categoryScores[indicator.category].push(score);
                
                console.log(`  ✓ ${indicator.name}: ${score.toFixed(2)}/5.00`);
            });

            // 5. Calculate average score per category
            const avgCategoryScores = {
                urban: categoryScores.urban.length > 0 
                    ? categoryScores.urban.reduce((a, b) => a + b, 0) / categoryScores.urban.length 
                    : 0,
                social: categoryScores.social.length > 0 
                    ? categoryScores.social.reduce((a, b) => a + b, 0) / categoryScores.social.length 
                    : 0,
                economic: categoryScores.economic.length > 0 
                    ? categoryScores.economic.reduce((a, b) => a + b, 0) / categoryScores.economic.length 
                    : 0,
                historical: categoryScores.historical.length > 0 
                    ? categoryScores.historical.reduce((a, b) => a + b, 0) / categoryScores.historical.length 
                    : 0
            };

            console.log('📈 Category averages:', avgCategoryScores);

            // 6. Calculate weighted total score
            const totalScore = (
                (weights.urban / 100) * avgCategoryScores.urban +
                (weights.social / 100) * avgCategoryScores.social +
                (weights.economic / 100) * avgCategoryScores.economic +
                (weights.historical / 100) * avgCategoryScores.historical
            );

            console.log(`🎯 Final weighted score: ${totalScore.toFixed(2)}/5.00`);

            // 7. Prepare isochrone features for map display (STROKE ONLY, no fill)
            const isochroneFeatures = isochronesGeoJSON.features.map((feature, idx) => {
                const minutes = feature.properties?.contour || [5, 10, 15][idx];
                return {
                    type: 'Feature' as const,
                    properties: {
                        ...feature.properties,
                        minutes: `${minutes} min`,
                        strokeColor: minutes <= 5 ? '#22c55e' : minutes <= 10 ? '#eab308' : '#f97316',
                        fillOpacity: 0, // No fill, stroke only
                        strokeWidth: 3,
                        strokeOpacity: 1
                    },
                    geometry: feature.geometry
                };
            });
            
            // Set isochrones to be displayed on map (not as a layer)
            if (onSetResearchIsochrones) {
                onSetResearchIsochrones(isochroneFeatures);
            }
            
            // 8. Categorize points for display
            const categoryColors = {
                urban: '#3b82f6',
                social: '#22c55e',
                economic: '#f97316',
                historical: '#a855f7'
            };
            
            const categorizedFeatures = {
                urban: [] as Feature[],
                social: [] as Feature[],
                economic: [] as Feature[],
                historical: [] as Feature[]
            };
            
            // Categorize features based on properties or layer names
            [...featuresByZone.A, ...featuresByZone.B, ...featuresByZone.C].forEach(feature => {
                const props = feature.properties || {};
                const propsStr = JSON.stringify(props).toLowerCase();
                
                // Simple categorization based on keywords
                if (propsStr.includes('park') || propsStr.includes('green') || propsStr.includes('transit') || propsStr.includes('transport')) {
                    categorizedFeatures.urban.push(feature);
                } else if (propsStr.includes('school') || propsStr.includes('hospital') || propsStr.includes('clinic') || propsStr.includes('health')) {
                    categorizedFeatures.social.push(feature);
                } else if (propsStr.includes('shop') || propsStr.includes('store') || propsStr.includes('commercial') || propsStr.includes('retail')) {
                    categorizedFeatures.economic.push(feature);
                } else if (propsStr.includes('heritage') || propsStr.includes('historic') || propsStr.includes('monument') || propsStr.includes('landmark')) {
                    categorizedFeatures.historical.push(feature);
                } else {
                    // Default: distribute evenly or put in urban
                    categorizedFeatures.urban.push(feature);
                }
            });
            
            setCategorizedPoints(categorizedFeatures);

            setCalculationResults({
                point,
                categoryScores: avgCategoryScores,
                totalScore,
                timestamp: Date.now(),
                featureCounts: {
                    zoneA: featuresByZone.A.length,
                    zoneB: featuresByZone.B.length,
                    zoneC: featuresByZone.C.length
                }
            });

        } catch (error) {
            console.error('❌ Error calculating score:', error);
            alert(`Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsCalculating(false);
        }
    };

    // Execute research calculation
    const handleRunResearch = () => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        calculatePointScore(samplePointLocation);
    };

    // Get category icon
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'urban': return <Building2 size={16} />;
            case 'social': return <Users size={16} />;
            case 'economic': return <TrendingUp size={16} />;
            case 'historical': return <Landmark size={16} />;
            default: return <Info size={16} />;
        }
    };

    // Get category color
    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'urban': return 'blue';
            case 'social': return 'green';
            case 'economic': return 'orange';
            case 'historical': return 'purple';
            default: return 'gray';
        }
    };

    const enabledByCategory = useMemo(() => {
        return {
            urban: indicators.filter(i => i.category === 'urban' && i.enabled).length,
            social: indicators.filter(i => i.category === 'social' && i.enabled).length,
            economic: indicators.filter(i => i.category === 'economic' && i.enabled).length,
            historical: indicators.filter(i => i.category === 'historical' && i.enabled).length
        };
    }, [indicators]);

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
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
                    <button
                        onClick={handleRunResearch}
                        disabled={isCalculating || !samplePointLocation}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        <Play size={16} />
                        {isCalculating ? 'Calculating...' : 'Run Analysis'}
                    </button>
                    {calculationResults && (
                        <button
                            onClick={() => {
                                setCalculationResults(null);
                                setCategorizedPoints(null);
                                if (onSetResearchIsochrones) {
                                    onSetResearchIsochrones(null);
                                }
                            }}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-all flex items-center gap-2"
                        >
                            <Trash2 size={16} />
                            Clear Analysis
                        </button>
                    )}
                </div>

                {/* Info Banner */}
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <Info size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-indigo-800">
                            This model calculates a weighted quality score (1-5) for any point based on its 15-minute walking environment using three isochrone zones: 
                            Zone A (0-5 min, ×1.0), Zone B (5-10 min, ×0.6), and Zone C (10-15 min, ×0.3).
                        </p>
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
                                    // Notify user to click on map
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

                {/* Results Section - Moved here between Sample Point and Category Weights */}
                {calculationResults && (
                    <section className="bg-white rounded-xl border border-slate-200 p-5">
                        <h3 className="font-bold text-slate-800 mb-4">Analysis Results</h3>
                        
                        <div className="space-y-4">
                            {/* Total Score */}
                            <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
                                <div className="text-sm font-medium mb-1">Overall Quality Score</div>
                                <div className="text-4xl font-bold">
                                    {calculationResults.totalScore.toFixed(2)} / 5.00
                                </div>
                                <div className="text-xs mt-2 opacity-90">
                                    Based on weighted multi-criteria analysis
                                </div>
                            </div>

                            {/* Feature Counts by Zone */}
                            {calculationResults.featureCounts && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="text-xs font-semibold text-slate-700 mb-2">Features by Walking Zone</div>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="p-2 bg-green-100 rounded">
                                            <div className="font-bold text-green-700">{calculationResults.featureCounts.zoneA}</div>
                                            <div className="text-green-600">0-5 min</div>
                                        </div>
                                        <div className="p-2 bg-yellow-100 rounded">
                                            <div className="font-bold text-yellow-700">{calculationResults.featureCounts.zoneB}</div>
                                            <div className="text-yellow-600">5-10 min</div>
                                        </div>
                                        <div className="p-2 bg-orange-100 rounded">
                                            <div className="font-bold text-orange-700">{calculationResults.featureCounts.zoneC}</div>
                                            <div className="text-orange-600">10-15 min</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Category Breakdown */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="text-xs text-blue-600 font-medium mb-1">Urban</div>
                                    <div className="text-2xl font-bold text-blue-700">
                                        {calculationResults.categoryScores.urban.toFixed(2)}
                                    </div>
                                </div>
                                
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="text-xs text-green-600 font-medium mb-1">Social</div>
                                    <div className="text-2xl font-bold text-green-700">
                                        {calculationResults.categoryScores.social.toFixed(2)}
                                    </div>
                                </div>
                                
                                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="text-xs text-orange-600 font-medium mb-1">Economic</div>
                                    <div className="text-2xl font-bold text-orange-700">
                                        {calculationResults.categoryScores.economic.toFixed(2)}
                                    </div>
                                </div>
                                
                                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                    <div className="text-xs text-purple-600 font-medium mb-1">Historical</div>
                                    <div className="text-2xl font-bold text-purple-700">
                                        {calculationResults.categoryScores.historical.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Category Point Counts */}
                            {categorizedPoints && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div className="text-xs font-semibold text-slate-700 mb-2">Points by Category</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                            <span>Urban: {categorizedPoints.urban.length}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                            <span>Social: {categorizedPoints.social.length}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                            <span>Economic: {categorizedPoints.economic.length}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                            <span>Historical: {categorizedPoints.historical.length}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Category Weights */}
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Sliders size={18} className="text-indigo-600" />
                        Category Weights
                    </h3>

                    <div className="space-y-5">
                        {/* Urban */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                        {getCategoryIcon('urban')}
                                    </div>
                                    <span className="font-medium text-slate-700">Urban Infrastructure</span>
                                    <span className="text-xs text-slate-500">({enabledByCategory.urban} active)</span>
                                </div>
                                <span className="font-bold text-blue-600">{weights.urban}%</span>
                            </div>
                            <Slider
                                value={weights.urban}
                                onChange={(_, value) => handleWeightChange('urban', value as number)}
                                min={0}
                                max={100}
                                valueLabelDisplay="auto"
                                sx={{
                                    color: '#3b82f6',
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: '#3b82f6'
                                    }
                                }}
                            />
                        </div>

                        {/* Social */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                        {getCategoryIcon('social')}
                                    </div>
                                    <span className="font-medium text-slate-700">Social Services</span>
                                    <span className="text-xs text-slate-500">({enabledByCategory.social} active)</span>
                                </div>
                                <span className="font-bold text-green-600">{weights.social}%</span>
                            </div>
                            <Slider
                                value={weights.social}
                                onChange={(_, value) => handleWeightChange('social', value as number)}
                                min={0}
                                max={100}
                                valueLabelDisplay="auto"
                                sx={{
                                    color: '#22c55e',
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: '#22c55e'
                                    }
                                }}
                            />
                        </div>

                        {/* Economic */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                        {getCategoryIcon('economic')}
                                    </div>
                                    <span className="font-medium text-slate-700">Economic Vitality</span>
                                    <span className="text-xs text-slate-500">({enabledByCategory.economic} active)</span>
                                </div>
                                <span className="font-bold text-orange-600">{weights.economic}%</span>
                            </div>
                            <Slider
                                value={weights.economic}
                                onChange={(_, value) => handleWeightChange('economic', value as number)}
                                min={0}
                                max={100}
                                valueLabelDisplay="auto"
                                sx={{
                                    color: '#f97316',
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: '#f97316'
                                    }
                                }}
                            />
                        </div>

                        {/* Historical */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                        {getCategoryIcon('historical')}
                                    </div>
                                    <span className="font-medium text-slate-700">Historical & Cultural</span>
                                    <span className="text-xs text-slate-500">({enabledByCategory.historical} active)</span>
                                </div>
                                <span className="font-bold text-purple-600">{weights.historical}%</span>
                            </div>
                            <Slider
                                value={weights.historical}
                                onChange={(_, value) => handleWeightChange('historical', value as number)}
                                min={0}
                                max={100}
                                valueLabelDisplay="auto"
                                sx={{
                                    color: '#a855f7',
                                    '& .MuiSlider-thumb': {
                                        backgroundColor: '#a855f7'
                                    }
                                }}
                            />
                        </div>

                        {/* Total Weight Display */}
                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-600">Total Weight</span>
                                <span className={`font-bold ${
                                    weights.urban + weights.social + weights.economic + weights.historical === 100
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                }`}>
                                    {weights.urban + weights.social + weights.economic + weights.historical}%
                                </span>
                            </div>
                            {weights.urban + weights.social + weights.economic + weights.historical !== 100 && (
                                <p className="text-xs text-red-600 mt-1">
                                    ⚠ Warning: Weights should sum to 100%
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {/* Indicator Selection */}
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Eye size={18} className="text-indigo-600" />
                        Active Indicators ({indicators.filter(i => i.enabled).length}/{indicators.length})
                    </h3>

                    <div className="space-y-4">
                        {['urban', 'social', 'economic', 'historical'].map((category) => {
                            const categoryIndicators = indicators.filter(i => i.category === category);
                            const colorClass = getCategoryColor(category);
                            
                            return (
                                <div key={category} className="border border-slate-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-8 h-8 bg-${colorClass}-100 rounded-lg flex items-center justify-center`}>
                                            {getCategoryIcon(category)}
                                        </div>
                                        <h4 className="font-semibold text-slate-700 capitalize">{category}</h4>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {categoryIndicators.map((indicator) => (
                                            <div
                                                key={indicator.id}
                                                className="flex items-center justify-between p-2 hover:bg-slate-50 rounded transition-colors"
                                            >
                                                <div className="flex items-center gap-2 flex-1">
                                                    <button
                                                        onClick={() => toggleIndicator(indicator.id)}
                                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                            indicator.enabled
                                                                ? `bg-${colorClass}-600 border-${colorClass}-600`
                                                                : 'border-slate-300 bg-white'
                                                        }`}
                                                    >
                                                        {indicator.enabled && (
                                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                    <span className={`text-sm ${indicator.enabled ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                                                        {indicator.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-400">{indicator.dataSource}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                        indicator.zoneSensitivity === 'high'
                                                            ? 'bg-red-100 text-red-700'
                                                            : indicator.zoneSensitivity === 'medium'
                                                            ? 'bg-yellow-100 text-yellow-700'
                                                            : 'bg-green-100 text-green-700'
                                                    }`}>
                                                        {indicator.zoneSensitivity}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Methodology Reference */}
                <section className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-3">Walking Network Isochrones (Real Road Data)</h3>
                    <div className="space-y-2 text-sm text-slate-600">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                            <div className="text-xs font-semibold text-blue-800 mb-1">🗺️ Using Mapbox Isochrone API</div>
                            <div className="text-xs text-blue-700">
                                Analysis is based on actual walking paths along real streets and roads, not simple circular buffers.
                            </div>
                        </div>
                        
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                            <div>
                                <strong>5-min Walk:</strong> Immediate proximity. High impact on daily life. 
                                <span className="text-green-700 font-mono ml-2">Multiplier: ×1.0</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5"></div>
                            <div>
                                <strong>10-min Walk:</strong> Short walk. Moderate impact. 
                                <span className="text-yellow-700 font-mono ml-2">Multiplier: ×0.6</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5"></div>
                            <div>
                                <strong>15-min Walk:</strong> Edge of accessibility. Lower impact. 
                                <span className="text-orange-700 font-mono ml-2">Multiplier: ×0.3</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-white rounded border border-slate-200">
                        <div className="text-xs font-mono text-slate-600">
                            S<sub>indicator</sub> = Σ(Score × ZoneMultiplier) / Σ(ZoneMultipliers)
                        </div>
                        <div className="text-xs font-mono text-slate-600 mt-1">
                            S<sub>total</sub> = (W<sub>urban</sub> · S̄<sub>urban</sub>) + (W<sub>social</sub> · S̄<sub>social</sub>) + (W<sub>econ</sub> · S̄<sub>econ</sub>) + (W<sub>hist</sub> · S̄<sub>hist</sub>)
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
