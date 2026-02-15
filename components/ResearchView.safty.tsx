import React, { useState, useEffect, useMemo } from 'react';
import { Layer } from '../types';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import { FlaskConical, Sliders, Eye, EyeOff, Play, MapPin, Info, TrendingUp, Users, Building2, Landmark, Loader2, Trash2, Bus } from 'lucide-react';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { 
    generateSimpleIsochrones, 
    filterFeaturesByZone, 
    calculateIndicatorScore,
    NormalizationFunctions,
    createSampleGrid
} from '../utils/researchScoring';
import { getNextLayerColor } from '../utils/layerColors';
import { generateWalkingIsochrones, duplicateLayer, separateIsochroneLayers, clip, calculateArea, difference } from '../utils/gisToolbox';
import { calculateAreaInIsochrones, calculateGreenSpaceScore, telAvivIndicators, fetchTelAvivGreenSpaces } from '../utils/researchTelAviv';
import { filterFeaturesByPolygon } from '../utils/spatialFilter';
import * as turf from '@turf/turf';

interface ResearchViewProps {
    layers: Layer[];
    onAddLayer?: (layer: Layer) => void;
    onRemoveLayer?: (layerId: string) => void;
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
    onRemoveLayer,
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
    const [selectedCity, setSelectedCity] = useState<string>('Tel Aviv');
    
    // City center coordinates
    const cityCoordinates: Record<string, { lat: number; lng: number }> = {
        'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
        'Jerusalem': { lat: 31.7683, lng: 35.2137 },
        'Haifa': { lat: 32.7940, lng: 34.9896 },
        'Beer Sheva': { lat: 31.2518, lng: 34.7913 }
    };

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

    // Stage-by-stage analysis
    const [currentStage, setCurrentStage] = useState<number>(0); // 0 = not started, 1-6 = stages
    const [stageData, setStageData] = useState<{
        isochrones?: any;
        greenSpaceLayer?: Layer;
        clippedFeatures?: Feature[];
        clippedLayer?: Layer;
        gardenArea?: number;
        isochroneArea?: number;
        percentage?: number;
        score?: number;
    }>({});

    // Analysis table data
    const [analysisResults, setAnalysisResults] = useState<{
        isochroneArea: { zone5: number | null; zone10: number | null; zone15: number | null };
        gardens: { zone5: number | null; zone10: number | null; zone15: number | null };
        gardenScores: { zone5: number | null; zone10: number | null; zone15: number | null };
        busStations: { zone5: number | null; zone10: number | null; zone15: number | null };
        busStationScores: { zone5: number | null; zone10: number | null; zone15: number | null };
    }>({
        isochroneArea: { zone5: null, zone10: null, zone15: null },
        gardens: { zone5: null, zone10: null, zone15: null },
        gardenScores: { zone5: null, zone10: null, zone15: null },
        busStations: { zone5: null, zone10: null, zone15: null },
        busStationScores: { zone5: null, zone10: null, zone15: null }
    });

    const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null); // Track which row is running
    
    // Store isochrones from isochrone area analysis for reuse in gardens analysis
    const [storedIsochrones, setStoredIsochrones] = useState<any>(null);

    // Calculate transit score from bus station counts
    // Uses square root to account for diminishing returns (multiple stops at same intersection)
    const calculateTransitScore = (zone5: number, zone10: number, zone15: number, maxRawBenchmark: number = 10): number => {
        // Calculate raw score using square roots (diminishing returns)
        const rawScore = Math.sqrt(zone5) * 1.0 + Math.sqrt(zone10) * 0.4 + Math.sqrt(zone15) * 0.1;
        
        // Normalize to 1-5 scale
        const normalizedScore = 1 + (4 * (rawScore / maxRawBenchmark));
        
        // Constrain to 1-5 range
        const finalScore = Math.max(1, Math.min(5, normalizedScore));
        
        return finalScore;
    };

    // Get available layers that can be used as indicators
    const availableLayers = useMemo(() => {
        return layers.filter(l => l.visible && l.data.features.length > 0);
    }, [layers]);

    // Handle weight change - ensure all weights sum to 100%
    const handleWeightChange = (category: keyof CategoryWeights, newValue: number) => {
        setWeights(prev => {
            const oldValue = prev[category];
            const difference = newValue - oldValue;
            
            // If no change, return previous state
            if (difference === 0) return prev;
            
            // Get the other three categories
            const otherCategories = (Object.keys(prev) as Array<keyof CategoryWeights>)
                .filter(cat => cat !== category);
            
            // Distribute the change equally among the other 3 categories
            const changePerCategory = -difference / 3;
            
            const newWeights = { ...prev, [category]: newValue };
            
            // Apply equal change to each of the other 3 categories
            otherCategories.forEach((cat, index) => {
                if (index === otherCategories.length - 1) {
                    // Last category gets the remainder to ensure exact 100%
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

            // Zone multipliers for weighted scoring
            const zoneMultipliers = {
                zoneA: 1.0,  // 0-5 min
                zoneB: 0.6,  // 5-10 min
                zoneC: 0.3   // 10-15 min
            };

            // Use city-specific indicators if Tel Aviv is selected
            if (selectedCity === 'Tel Aviv') {
                console.log('🏙️ Using Tel Aviv municipal layers for analysis');
                
                // Green Spaces - area-based calculation (like "cut by boundary")
                const greenSpaceLayer = layers.find(l => l.name === 'שטחים ירוקים' || l.name.includes('ירוק'));
                if (greenSpaceLayer) {
                    console.log('🌳 Found green space layer:', greenSpaceLayer.name);
                    const greenAreas = calculateAreaInIsochrones(greenSpaceLayer, isochronesGeoJSON.features);
                    const greenScore = calculateGreenSpaceScore(greenAreas.gardenArea, greenAreas.isochroneArea, greenAreas.percentage);
                    categoryScores.urban.push(greenScore / 20); // Convert 0-100 to 0-5 scale for consistency
                    console.log(`  ✓ Green Spaces (שטחים ירוקים): ${greenScore.toFixed(2)}%`);
                    console.log(`    - Garden area: ${greenAreas.gardenArea.toFixed(2)} m²`);
                    console.log(`    - Isochrone area: ${greenAreas.isochroneArea.toFixed(2)} m²`);
                    console.log(`    - Coverage: ${greenAreas.percentage.toFixed(2)}%`);
                    console.log(`    - Score (0-5 scale): ${(greenScore / 20).toFixed(2)}/5.00`);
                    
                    // Create visualization layer for clipped green spaces
                    console.log(`🔍 Checking clipped features: ${greenAreas.clippedFeatures.length} features, onAddLayer: ${onAddLayer ? 'available' : 'missing'}`);
                    
                    if (greenAreas.clippedFeatures.length > 0) {
                        if (onAddLayer) {
                            const clippedLayer: Layer = {
                                id: `clipped-green-spaces-${Date.now()}`,
                                name: `🌳 Green Spaces within 15-min Walk`,
                                visible: true,
                                data: {
                                    type: 'FeatureCollection',
                                    features: greenAreas.clippedFeatures
                                },
                                color: '#22c55e',
                                opacity: 0.6,
                                type: 'polygon',
                                grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                                lastUpdated: Date.now()
                            };
                            onAddLayer(clippedLayer);
                            console.log(`✅ Created visualization layer with ${greenAreas.clippedFeatures.length} clipped segments`);
                            console.log(`📋 Layer added to map: "${clippedLayer.name}"`);
                        } else {
                            console.error('❌ onAddLayer callback is missing!');
                        }
                    } else {
                        console.warn('⚠️ No clipped features found - no overlap between isochrones and green spaces');
                    }
                } else {
                    console.warn('⚠️ Green space layer "שטחים ירוקים" not found in loaded layers');
                    console.log('Available layers:', layers.map(l => l.name));
                }
            }

            // Add OSM-based indicators (fallback or supplement)
            const enabledIndicators = indicators.filter(ind => ind.enabled);
            
            enabledIndicators.forEach(indicator => {
                // Skip OSM green spaces if using Tel Aviv data
                if (selectedCity === 'Tel Aviv' && indicator.id === 'parks') {
                    return;
                }
                
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

    // Execute research calculation - ALL STAGES AUTOMATICALLY
    const handleRunResearch = async () => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        setIsCalculating(true);
        
        try {
            // Stage 1: Generate 15-minute isochrone
            console.log('🔬 Stage 1: Generating 15-minute walking isochrone...');
            setCurrentStage(1);
            
            const isochronesGeoJSON = await generateWalkingIsochrones(
                [samplePointLocation.lng, samplePointLocation.lat], 
                [15]
            );
            
            if (!isochronesGeoJSON.features || isochronesGeoJSON.features.length === 0) {
                alert('Failed to generate walking isochrones. Please try a different location.');
                setIsCalculating(false);
                return;
            }
            
            console.log('📍 Generated', isochronesGeoJSON.features.length, 'real walking-based isochrones');
            
            // Display isochrones on map
            if (onSetResearchIsochrones) {
                onSetResearchIsochrones(isochronesGeoJSON.features);
            }
            
            // Add as a layer
            if (onAddLayer) {
                const isochroneLayer: Layer = {
                    id: `test-isochrone-15min-${Date.now()}`,
                    name: `🔵 15-min Walking Isochrone`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: isochronesGeoJSON.features
                    },
                    color: '#3b82f6',
                    opacity: 0.3,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(isochroneLayer);
            }
            
            // Stage 2: Fetch garden layer
            console.log('🌳 Stage 2: Fetching Tel Aviv garden layer...');
            setCurrentStage(2);
            
            let greenSpaceLayer = layers.find(l => l.name === 'שטחים ירוקים' || l.name.includes('ירוק'));
            
            if (!greenSpaceLayer) {
                const fetchedLayer = await fetchTelAvivGreenSpaces();
                
                if (!fetchedLayer) {
                    alert('Failed to fetch Tel Aviv green spaces layer from GIS server');
                    setIsCalculating(false);
                    return;
                }
                
                console.log(`✅ Fetched ${fetchedLayer.data.features.length} green space features`);
                
                if (onAddLayer) {
                    onAddLayer(fetchedLayer);
                }
                
                greenSpaceLayer = fetchedLayer;
            } else {
                console.log('🌳 Garden layer already loaded:', greenSpaceLayer.name);
            }
            
            // Stage 3: Cut garden by boundary
            console.log('✂️ Stage 3: Cutting gardens by 15-min boundary...');
            setCurrentStage(3);
            
            const boundaryPolygon = isochronesGeoJSON.features.find(f => 
                f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
            );
            
            if (!boundaryPolygon) {
                alert('15-min isochrone has no polygon features');
                setIsCalculating(false);
                return;
            }
            
            const filteredFeatures = filterFeaturesByPolygon(greenSpaceLayer.data.features, boundaryPolygon as Feature<Polygon | MultiPolygon>);
            
            if (filteredFeatures.length === 0) {
                alert('No gardens found within the 15-minute walking area. Try a different location with nearby parks.');
                setIsCalculating(false);
                return;
            }
            
            const gardenArea = filteredFeatures.reduce((total, feature) => {
                const area = turf.area(feature);
                return total + area;
            }, 0);
            
            const isochroneArea = turf.area(boundaryPolygon);
            const percentage = (gardenArea / isochroneArea) * 100;
            
            // Stage 4: Show clipped layer
            console.log('🎨 Stage 4: Displaying clipped layer...');
            setCurrentStage(4);
            
            if (onAddLayer) {
                const clippedLayer: Layer = {
                    id: `clipped-green-spaces-${Date.now()}`,
                    name: `🌳 Gardens within 15-min Walk`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: filteredFeatures
                    },
                    color: '#ef4444',
                    opacity: 0.7,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                
                onAddLayer(clippedLayer);
                
                // Remove original garden layer
                if (greenSpaceLayer && onRemoveLayer) {
                    onRemoveLayer(greenSpaceLayer.id);
                }
                
                setStageData({ 
                    isochrones: isochronesGeoJSON,
                    greenSpaceLayer,
                    clippedFeatures: filteredFeatures,
                    gardenArea,
                    isochroneArea,
                    percentage,
                    clippedLayer
                });
            }
            
            // Stage 5: Show calculations
            console.log('📊 Stage 5: Showing calculations...');
            setCurrentStage(5);
            
            // Stage 6: Final score
            console.log('🎯 Stage 6: Calculating final score...');
            const score = Math.min(5.0, (percentage / 10) * 5);
            setStageData(prev => ({ ...prev, score }));
            setCurrentStage(6);
            
            console.log('✅ Analysis complete!');
            
        } catch (error) {
            console.error('Error during analysis:', error);
            alert('Failed to complete analysis');
            setIsCalculating(false);
        }
        
        setIsCalculating(false);
    };

    const handleNextStage = async () => {
        const nextStage = currentStage + 1;
        console.log(`🎯 Moving to Stage ${nextStage}`);
        
        if (nextStage === 2) {
            // Stage 2: Fetch and add full garden layer to map
            if (selectedCity === 'Tel Aviv') {
                // Check if already loaded
                let greenSpaceLayer = layers.find(l => l.name === 'שטחים ירוקים' || l.name.includes('ירוק'));
                
                if (!greenSpaceLayer) {
                    console.log('🌳 Fetching Tel Aviv garden layer from GIS server...');
                    setIsCalculating(true);
                    
                    try {
                        const fetchedLayer = await fetchTelAvivGreenSpaces();
                        
                        if (!fetchedLayer) {
                            alert('Failed to fetch Tel Aviv green spaces layer from GIS server');
                            setIsCalculating(false);
                            return;
                        }
                        
                        console.log(`✅ Fetched ${fetchedLayer.data.features.length} green space features`);
                        
                        // Add layer to map
                        if (onAddLayer) {
                            onAddLayer(fetchedLayer);
                        }
                        
                        greenSpaceLayer = fetchedLayer;
                    } catch (error) {
                        console.error('❌ Error fetching green spaces:', error);
                        alert('Failed to fetch green spaces layer. Check console for details.');
                        setIsCalculating(false);
                        return;
                    }
                    
                    setIsCalculating(false);
                } else {
                    console.log('🌳 Garden layer already loaded:', greenSpaceLayer.name);
                }
                
                setStageData(prev => ({ ...prev, greenSpaceLayer }));
                setCurrentStage(2);
            }
        } else if (nextStage === 3) {
            // Stage 3: Cut garden by 15-min boundary (same logic as Analyze tab)
            const greenSpaceLayer = stageData.greenSpaceLayer;
            const isochronesGeoJSON = stageData.isochrones;
            
            if (!greenSpaceLayer || !isochronesGeoJSON) {
                alert('Missing garden layer or 15-min isochrone');
                return;
            }
            
            console.log('✂️ Stage 3: Cutting gardens by 15-min boundary...');
            console.log('Garden layer features:', greenSpaceLayer.data.features.length);
            console.log('Isochrone features:', isochronesGeoJSON.features.length);
            
            // Find the first polygon feature from isochrone (same as AnalyzeView)
            const boundaryPolygon = isochronesGeoJSON.features.find(f => 
                f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
            );
            
            if (!boundaryPolygon) {
                alert('15-min isochrone has no polygon features');
                return;
            }
            
            console.log('Boundary polygon:', boundaryPolygon);
            
            // Use the same function as Analyze tab
            const filteredFeatures = filterFeaturesByPolygon(greenSpaceLayer.data.features, boundaryPolygon);
            
            console.log('Filtered features count:', filteredFeatures.length);
            
            if (filteredFeatures.length === 0) {
                alert('No gardens found within the 15-minute walking area. Try a different location with nearby parks.');
                return;
            }
            
            // Calculate areas for display
            const gardenArea = filteredFeatures.reduce((total, feature) => {
                const area = turf.area(feature);
                return total + area;
            }, 0);
            
            const isochroneArea = turf.area(boundaryPolygon);
            const percentage = (gardenArea / isochroneArea) * 100;
            
            setStageData(prev => ({ 
                ...prev, 
                clippedFeatures: filteredFeatures,
                gardenArea,
                isochroneArea,
                percentage
            }));
            setCurrentStage(3);
        } else if (nextStage === 4) {
            // Stage 4: Show clipped layer in RED
            const clippedFeatures = stageData.clippedFeatures;
            
            if (!clippedFeatures || clippedFeatures.length === 0) {
                console.error('Stage 4: No clipped features available!');
                alert('No clipped features to display');
                return;
            }
            
            if (onAddLayer) {
                const clippedLayer: Layer = {
                    id: `clipped-green-spaces-${Date.now()}`,
                    name: `🌳 Gardens within 15-min Walk`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: clippedFeatures
                    },
                    color: '#ef4444', // RED
                    opacity: 0.7,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                
                onAddLayer(clippedLayer);
                
                // Remove original garden layer
                if (stageData.greenSpaceLayer && onRemoveLayer) {
                    onRemoveLayer(stageData.greenSpaceLayer.id);
                }
                
                setStageData(prev => ({ ...prev, clippedLayer }));
            }
            
            setCurrentStage(4);
        } else if (nextStage === 5) {
            // Stage 5: Show calculations
            setCurrentStage(5);
        } else if (nextStage === 6) {
            // Stage 6: Final score
            if (stageData.percentage !== undefined) {
                const score = Math.min(5.0, (stageData.percentage / 10) * 5);
                setStageData(prev => ({ ...prev, score }));
                setCurrentStage(6);
            }
        }
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

    // Analysis handlers for table rows
    const handleIsochroneAreaAnalysis = async () => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        setRunningAnalysis('isochroneArea');
        
        try {
            console.log('📊 Running Isochrone Area Analysis...');
            
            // Generate 5, 10, 15 minute isochrones using gisToolbox
            const isochronesGeoJSON = await generateWalkingIsochrones(
                [samplePointLocation.lng, samplePointLocation.lat],
                [5, 10, 15]
            );

            if (!isochronesGeoJSON.features || isochronesGeoJSON.features.length === 0) {
                alert('Failed to generate isochrones');
                return;
            }

            console.log('🗺️ Generated isochrones:', isochronesGeoJSON.features.length, 'zones');

            // Calculate area for each zone
            const areas = {
                zone5: 0,
                zone10: 0,
                zone15: 0
            };

            isochronesGeoJSON.features.forEach(feature => {
                const minutes = feature.properties?.walkingMinutes || feature.properties?.contour || 0;
                const area = turf.area(feature);

                if (minutes <= 5) {
                    areas.zone5 = area;
                } else if (minutes <= 10) {
                    areas.zone10 = area;
                } else if (minutes <= 15) {
                    areas.zone15 = area;
                }
            });

            console.log('✅ Isochrone areas calculated:', areas);

            // Store isochrones for reuse in gardens analysis
            setStoredIsochrones(isochronesGeoJSON);

            // Display the 3 isochrones on the map
            if (onAddLayer) {
                const isochroneLayer: Layer = {
                    id: `isochrone-analysis-${Date.now()}`,
                    name: `🚶 Walking Isochrones (5, 10, 15 min)`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: isochronesGeoJSON.features
                    },
                    color: '#3b82f6',
                    opacity: 0.3,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(isochroneLayer);
                console.log('✅ Isochrones added to map');
            }

            setAnalysisResults(prev => ({
                ...prev,
                isochroneArea: areas
            }));

        } catch (error) {
            console.error('❌ Error in isochrone area analysis:', error);
            alert('Failed to calculate isochrone areas');
        } finally {
            setRunningAnalysis(null);
        }
    };

    const handleGardensAnalysis = async () => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        // Check if isochrone area analysis was run first
        if (!storedIsochrones) {
            alert('Please run Isochrone Area analysis first');
            return;
        }

        setRunningAnalysis('gardens');
        
        try {
            console.log('🌳 Running Gardens Analysis...');
            
            // Step 1: Take isochrone from isochrone area analysis
            console.log('📍 Step 1: Using stored isochrones from previous analysis');
            const isochronesGeoJSON = storedIsochrones;
            
            // Step 2: Duplicate layer
            console.log('📋 Step 2: Duplicating isochrone layer');
            const duplicatedIsochrones = duplicateLayer(isochronesGeoJSON) as any;
            
            // Step 3: Separate into 3 individual zone layers
            console.log('✂️ Step 3: Separating isochrones into individual zones');
            const separatedZones = separateIsochroneLayers(duplicatedIsochrones);
            const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
            
            console.log('✅ Separated into 3 zones:', {
                zone5: zone5Layer.features[0]?.properties?.walkingMinutes,
                zone10: zone10Layer.features[0]?.properties?.walkingMinutes,
                zone15: zone15Layer.features[0]?.properties?.walkingMinutes
            });
            
            // Step 4: Fetch garden layer from Tel Aviv GIS
            console.log('🌳 Step 4: Fetching garden layer from Tel Aviv GIS...');
            const gardenUrl = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/503/query?where=1%3D1&outFields=*&f=geojson';
            
            const response = await fetch(gardenUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch gardens: ${response.statusText}`);
            }
            
            const gardenData = await response.json();
            console.log('✅ Fetched garden layer:', gardenData.features.length, 'features');
            
            // Add original garden layer to map
            if (onAddLayer) {
                const gardenLayer: Layer = {
                    id: `gardens-original-${Date.now()}`,
                    name: `🌳 Tel Aviv Gardens (Original)`,
                    visible: true,
                    data: gardenData,
                    color: '#22c55e',
                    opacity: 0.4,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(gardenLayer);
            }
            
            // Step 5: Duplicate garden layer 3 times
            console.log('📋 Step 5: Duplicating garden layer 3 times');
            const gardenCopy1 = duplicateLayer(gardenData) as any;
            const gardenCopy2 = duplicateLayer(gardenData) as any;
            const gardenCopy3 = duplicateLayer(gardenData) as any;
            
            // Step 6: Clip each garden copy by corresponding zone
            console.log('✂️ Step 6: Clipping gardens by each zone...');
            
            // Clip copy 1 by zone 5
            const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden5 = clip(gardenCopy1.features, zone5Polygon);
            console.log('✅ Clipped zone 5:', clippedGarden5.length, 'features');
            
            // Clip copy 2 by zone 10
            const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden10 = clip(gardenCopy2.features, zone10Polygon);
            console.log('✅ Clipped zone 10:', clippedGarden10.length, 'features');
            
            // Clip copy 3 by zone 15
            const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden15 = clip(gardenCopy3.features, zone15Polygon);
            console.log('✅ Clipped zone 15:', clippedGarden15.length, 'features');
            
            // Step 7: Calculate area for each clipped layer
            console.log('📏 Step 7: Calculating areas...');
            
            const area5 = clippedGarden5.reduce((sum, feature) => {
                return sum + calculateArea(feature as Feature<Polygon | MultiPolygon>);
            }, 0);
            
            const area10 = clippedGarden10.reduce((sum, feature) => {
                return sum + calculateArea(feature as Feature<Polygon | MultiPolygon>);
            }, 0);
            
            const area15 = clippedGarden15.reduce((sum, feature) => {
                return sum + calculateArea(feature as Feature<Polygon | MultiPolygon>);
            }, 0);
            
            const gardenAreas = {
                zone5: area5,
                zone10: area10,
                zone15: area15
            };
            
            console.log('✅ Garden areas calculated:', gardenAreas);
            
            // Calculate scores: (garden area / isochrone area) * 100 * multiplier, max 5
            const calculateScore = (gardenArea: number, isochroneArea: number, multiplier: number): number => {
                if (!isochroneArea || isochroneArea === 0) return 0;
                const score = (gardenArea / isochroneArea) * 100 * multiplier;
                return Math.min(score, 5); // Cap at 5
            };
            
            const gardenScores = {
                zone5: calculateScore(area5, analysisResults.isochroneArea.zone5 || 0, 1.0),
                zone10: calculateScore(area10, analysisResults.isochroneArea.zone10 || 0, 0.7),
                zone15: calculateScore(area15, analysisResults.isochroneArea.zone15 || 0, 0.3)
            };
            
            console.log('✅ Garden scores calculated:', gardenScores);
            
            // Step 8: Don't delete layers - add clipped layers to map
            if (onAddLayer) {
                // Add clipped garden zone 5
                const clippedLayer5: Layer = {
                    id: `gardens-zone5-${Date.now()}`,
                    name: `🌳 Gardens in Zone 5 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: clippedGarden5 },
                    color: '#22c55e',
                    opacity: 0.6,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(clippedLayer5);
                
                // Add clipped garden zone 10
                const clippedLayer10: Layer = {
                    id: `gardens-zone10-${Date.now()}`,
                    name: `🌳 Gardens in Zone 10 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: clippedGarden10 },
                    color: '#eab308',
                    opacity: 0.6,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(clippedLayer10);
                
                // Add clipped garden zone 15
                const clippedLayer15: Layer = {
                    id: `gardens-zone15-${Date.now()}`,
                    name: `🌳 Gardens in Zone 15 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: clippedGarden15 },
                    color: '#f97316',
                    opacity: 0.6,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(clippedLayer15);
                
                console.log('✅ All clipped garden layers added to map');
            }
            
            // Update table with results
            setAnalysisResults(prev => ({
                ...prev,
                gardens: gardenAreas,
                gardenScores: gardenScores
            }));

        } catch (error) {
            console.error('❌ Error in gardens analysis:', error);
            alert(`Failed to calculate garden areas: ${error}`);
        } finally {
            setRunningAnalysis(null);
        }
    };

    const handleBusStationsAnalysis = async () => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        // Check if isochrone area analysis was run first
        if (!storedIsochrones) {
            alert('Please run Isochrone Area analysis first');
            return;
        }

        setRunningAnalysis('busStations');
        
        try {
            console.log('🚍 Running Bus Stations Analysis...');
            
            // Step 1: Fetch bus station layer from Tel Aviv GIS
            console.log('🚍 Step 1: Fetching bus station layer from Tel Aviv GIS...');
            const busUrl = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/956/query?where=1%3D1&outFields=*&f=geojson';
            
            const response = await fetch(busUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch bus stations: ${response.statusText}`);
            }
            
            const busData = await response.json();
            console.log('✅ Fetched bus station layer:', busData.features.length, 'features');
            
            // Add original bus station layer to map
            if (onAddLayer) {
                const busLayer: Layer = {
                    id: `bus-stations-original-${Date.now()}`,
                    name: `🚍 Tel Aviv Bus Stations (Original)`,
                    visible: true,
                    data: busData,
                    color: '#3b82f6',
                    opacity: 0.8,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer);
            }
            
            // Step 2: Get isochrones from isochrone area analysis
            console.log('📍 Step 2: Using stored isochrones from previous analysis');
            const isochronesGeoJSON = storedIsochrones;
            
            // Separate into 3 individual zone layers
            const separatedZones = separateIsochroneLayers(isochronesGeoJSON);
            const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
            
            const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
            
            console.log('✅ Separated zones ready for clipping');
            
            // Step 3: Create unique bus station points per zone using clip and difference
            console.log('✂️ Step 3: Creating unique bus points per zone...');
            
            // Zone 5 (innermost): Just clip with zone 5
            const busInZone5 = clip(busData.features, zone5Polygon);
            console.log('✅ Zone 5 buses:', busInZone5.length, 'stations');
            
            // Zone 10 (middle ring): Clip with zone 10, then remove buses inside zone 5
            const busInZone10Full = clip(busData.features, zone10Polygon);
            const busInZone10 = difference(busInZone10Full, zone5Polygon);
            console.log('✅ Zone 10 buses (ring only):', busInZone10.length, 'stations');
            
            // Zone 15 (outer ring): Clip with zone 15, then remove buses inside zone 10
            const busInZone15Full = clip(busData.features, zone15Polygon);
            const busInZone15 = difference(busInZone15Full, zone10Polygon);
            console.log('✅ Zone 15 buses (ring only):', busInZone15.length, 'stations');
            
            // Add clipped bus station layers to map
            if (onAddLayer) {
                // Add bus stations in zone 5
                const busLayer5: Layer = {
                    id: `bus-zone5-${Date.now()}`,
                    name: `🚍 Bus Stations in Zone 5 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: busInZone5 },
                    color: '#22c55e',
                    opacity: 0.9,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer5);
                
                // Add bus stations in zone 10
                const busLayer10: Layer = {
                    id: `bus-zone10-${Date.now()}`,
                    name: `🚍 Bus Stations in Zone 10 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: busInZone10 },
                    color: '#eab308',
                    opacity: 0.9,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer10);
                
                // Add bus stations in zone 15
                const busLayer15: Layer = {
                    id: `bus-zone15-${Date.now()}`,
                    name: `🚍 Bus Stations in Zone 15 min`,
                    visible: true,
                    data: { type: 'FeatureCollection', features: busInZone15 },
                    color: '#f97316',
                    opacity: 0.9,
                    type: 'point',
                    grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(busLayer15);
                
                console.log('✅ All bus station layers added to map');
            }
            
            // Update table with counts
            const busStationCounts = {
                zone5: busInZone5.length,
                zone10: busInZone10.length,
                zone15: busInZone15.length
            };
            
            console.log('✅ Bus station counts:', busStationCounts);
            
            // Calculate transit score using the formula
            const totalScore = calculateTransitScore(
                busStationCounts.zone5,
                busStationCounts.zone10,
                busStationCounts.zone15
            );
            
            // Calculate individual zone contributions for tooltip
            const zone5Score = Math.sqrt(busStationCounts.zone5) * 1.0;
            const zone10Score = Math.sqrt(busStationCounts.zone10) * 0.4;
            const zone15Score = Math.sqrt(busStationCounts.zone15) * 0.1;
            
            const busStationScores = {
                zone5: zone5Score,
                zone10: zone10Score,
                zone15: zone15Score
            };
            
            console.log('✅ Transit scores:', {
                zone5: zone5Score.toFixed(2),
                zone10: zone10Score.toFixed(2),
                zone15: zone15Score.toFixed(2),
                total: totalScore.toFixed(2)
            });
            
            setAnalysisResults(prev => ({
                ...prev,
                busStations: busStationCounts,
                busStationScores: busStationScores
            }));

        } catch (error) {
            console.error('❌ Error in bus stations analysis:', error);
            alert(`Failed to analyze bus stations: ${error}`);
        } finally {
            setRunningAnalysis(null);
        }
    };

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
                    <div className="flex gap-2">
                        <button
                            onClick={handleRunResearch}
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
                            onClick={() => {
                                setCalculationResults(null);
                                setCategorizedPoints(null);
                                setCurrentStage(0);
                                setStageData({});
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

                {/* Info Banner / Stage Progress */}
                {currentStage === 0 ? (
                    <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <Info size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-indigo-800">
                                This model calculates a weighted quality score (1-5) based on green space coverage within 15-minute walking distance.
                                Pick a point and run analysis to proceed step-by-step.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold">Stage {currentStage}/6</div>
                                        <h4 className="font-bold text-slate-800">
                                            {currentStage === 1 && '📍 15-min Isochrone Generated'}
                                            {currentStage === 2 && '🌳 Garden Layer Loaded'}
                                            {currentStage === 3 && '✂️ Cut Gardens by 15-min Boundary'}
                                            {currentStage === 4 && '🔴 Clipped Layer Displayed (Red)'}
                                            {currentStage === 5 && '📊 All Calculations Complete'}
                                            {currentStage === 6 && '⭐ Final Score (1-5)'}
                                        </h4>
                                    </div>
                                    <p className="text-sm text-slate-700">
                                        {currentStage === 1 && `15-minute walking distance isochrone shown on map`}
                                        {currentStage === 2 && `Full garden layer "שטחים ירוקים" added to map`}
                                        {currentStage === 3 && `Using "cut by boundary" function to clip gardens`}
                                        {currentStage === 4 && `Clipped gardens displayed in red - original layer removed`}
                                        {currentStage === 5 && `Garden area, isochrone area, and coverage percentage calculated`}
                                        {currentStage === 6 && `Final score calculated (10% coverage = perfect 5.0)`}
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
                                        <div className="text-xl font-bold text-red-700">{stageData.clippedLayer.data.features.length}</div>
                                        <div className="text-xs text-slate-600">segments</div>
                                    </div>
                                )}
                                {stageData.gardenArea !== undefined && (
                                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                        <div className="text-xs text-slate-500 mb-1">🌳 Garden Area</div>
                                        <div className="text-xl font-bold text-green-700">{stageData.gardenArea.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
                                        <div className="text-xs text-slate-600">m²</div>
                                    </div>
                                )}
                                {stageData.isochroneArea !== undefined && (
                                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                        <div className="text-xs text-slate-500 mb-1">📐 Isochrone Area</div>
                                        <div className="text-xl font-bold text-blue-700">{stageData.isochroneArea.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
                                        <div className="text-xs text-slate-600">m²</div>
                                    </div>
                                )}
                                {stageData.percentage !== undefined && (
                                    <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                        <div className="text-xs text-slate-500 mb-1">📊 Coverage</div>
                                        <div className="text-xl font-bold text-purple-700">{stageData.percentage.toFixed(2)}%</div>
                                        <div className="text-xs text-slate-600">of walkable area</div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Final Score Display */}
                        {currentStage === 6 && stageData.score !== undefined && (
                            <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg">
                                <div className="text-center">
                                    <div className="text-sm text-slate-600 mb-2">FINAL SCORE</div>
                                    <div className="text-6xl font-bold text-yellow-600 mb-2">⭐ {stageData.score.toFixed(2)}</div>
                                    <div className="text-2xl font-semibold text-slate-700">out of 5.00</div>
                                    <div className="mt-3 text-xs text-slate-600">10% green coverage = perfect score (5.0)</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
                                <option value="Tel Aviv">Tel Aviv</option>
                                <option value="Jerusalem">Jerusalem</option>
                                <option value="Haifa">Haifa</option>
                                <option value="Beer Sheva">Beer Sheva</option>
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

                {/* Analysis Table */}
                <section className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Info size={18} className="text-indigo-600" />
                        Analysis Results by Zone
                    </h3>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b-2 border-slate-200">
                                    <th className="text-left p-3 font-semibold text-slate-700">Subcategory</th>
                                    <th className="text-center p-3 font-semibold text-green-700">Zone 5 min</th>
                                    <th className="text-center p-3 font-semibold text-yellow-700">Zone 10 min</th>
                                    <th className="text-center p-3 font-semibold text-orange-700">Zone 15 min</th>
                                    <th className="text-center p-3 font-semibold text-indigo-700">Score</th>
                                    <th className="text-center p-3 font-semibold text-slate-700">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Isochrone Area Row */}
                                <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-medium text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                                <MapPin size={16} className="text-blue-600" />
                                            </div>
                                            <span>Isochrone Area</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.isochroneArea.zone5 !== null ? (
                                            <div className="bg-green-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-green-700">
                                                    {(analysisResults.isochroneArea.zone5 / 1000000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </div>
                                                <div className="text-xs text-green-600">km²</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.isochroneArea.zone10 !== null ? (
                                            <div className="bg-yellow-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-yellow-700">
                                                    {(analysisResults.isochroneArea.zone10 / 1000000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </div>
                                                <div className="text-xs text-yellow-600">km²</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.isochroneArea.zone15 !== null ? (
                                            <div className="bg-orange-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-orange-700">
                                                    {(analysisResults.isochroneArea.zone15 / 1000000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </div>
                                                <div className="text-xs text-orange-600">km²</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="text-slate-400 text-sm">-</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={handleIsochroneAreaAnalysis}
                                            disabled={!samplePointLocation || runningAnalysis === 'isochroneArea'}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
                                        >
                                            {runningAnalysis === 'isochroneArea' ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Running...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={14} />
                                                    Run
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>

                                {/* Gardens Row */}
                                <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-medium text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                                                <span className="text-green-600">🌳</span>
                                            </div>
                                            <span>Gardens</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.gardens.zone5 !== null ? (
                                            <div className="bg-green-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-green-700">
                                                    {(analysisResults.gardens.zone5 / 1000000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </div>
                                                <div className="text-xs text-green-600">km²</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.gardens.zone10 !== null ? (
                                            <div className="bg-yellow-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-yellow-700">
                                                    {(analysisResults.gardens.zone10 / 1000000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </div>
                                                <div className="text-xs text-yellow-600">km²</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.gardens.zone15 !== null ? (
                                            <div className="bg-orange-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-orange-700">
                                                    {(analysisResults.gardens.zone15 / 1000000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                </div>
                                                <div className="text-xs text-orange-600">km²</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.gardenScores.zone5 !== null || analysisResults.gardenScores.zone10 !== null || analysisResults.gardenScores.zone15 !== null ? (
                                            (() => {
                                                const score5 = analysisResults.gardenScores.zone5 || 0;
                                                const score10 = analysisResults.gardenScores.zone10 || 0;
                                                const score15 = analysisResults.gardenScores.zone15 || 0;
                                                const totalScore = Math.min(score5 + score10 + score15, 5);
                                                const breakdown = `Zone 5: ${score5.toFixed(2)}\nZone 10: ${score10.toFixed(2)}\nZone 15: ${score15.toFixed(2)}`;
                                                
                                                return (
                                                    <div 
                                                        className="bg-indigo-50 px-4 py-2 rounded inline-block cursor-help transition-all hover:bg-indigo-100 hover:shadow-md"
                                                        title={breakdown}
                                                    >
                                                        <div className="font-bold text-indigo-700 text-lg">
                                                            {totalScore.toFixed(2)}
                                                        </div>
                                                        <div className="text-xs text-indigo-600">Total</div>
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={handleGardensAnalysis}
                                            disabled={!samplePointLocation || runningAnalysis === 'gardens'}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
                                        >
                                            {runningAnalysis === 'gardens' ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Running...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={14} />
                                                    Run
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>

                                {/* Bus Stations Row */}
                                <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-medium text-slate-800">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                                <Bus size={16} className="text-blue-600" />
                                            </div>
                                            <span>Bus Stations</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.busStations.zone5 !== null ? (
                                            <div className="bg-green-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-green-700">
                                                    {analysisResults.busStations.zone5}
                                                </div>
                                                <div className="text-xs text-green-600">stations</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.busStations.zone10 !== null ? (
                                            <div className="bg-yellow-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-yellow-700">
                                                    {analysisResults.busStations.zone10}
                                                </div>
                                                <div className="text-xs text-yellow-600">stations</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.busStations.zone15 !== null ? (
                                            <div className="bg-orange-50 px-3 py-2 rounded inline-block">
                                                <div className="font-bold text-orange-700">
                                                    {analysisResults.busStations.zone15}
                                                </div>
                                                <div className="text-xs text-orange-600">stations</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">No data</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {analysisResults.busStationScores.zone5 !== null ? (
                                            <Tooltip title={
                                                <div className="text-xs">
                                                    <div className="font-semibold mb-1">Transit Score Breakdown:</div>
                                                    <div>Zone 5 min: {analysisResults.busStationScores.zone5.toFixed(2)}</div>
                                                    <div>Zone 10 min: {analysisResults.busStationScores.zone10!.toFixed(2)}</div>
                                                    <div>Zone 15 min: {analysisResults.busStationScores.zone15!.toFixed(2)}</div>
                                                    <div className="mt-1 pt-1 border-t border-white/20">
                                                        Total: {(
                                                            analysisResults.busStationScores.zone5 +
                                                            analysisResults.busStationScores.zone10! +
                                                            analysisResults.busStationScores.zone15!
                                                        ).toFixed(2)}
                                                    </div>
                                                    <div className="text-[10px] text-white/70 mt-1">
                                                        Formula: √(zone5)×1.0 + √(zone10)×0.4 + √(zone15)×0.1<br />
                                                        Normalized to 1-5 scale
                                                    </div>
                                                </div>
                                            } arrow>
                                                <div className="inline-flex items-center gap-1 cursor-help px-3 py-2 bg-purple-50 rounded-lg">
                                                    <span className="font-bold text-purple-700 text-lg">
                                                        {calculateTransitScore(
                                                            analysisResults.busStations.zone5!,
                                                            analysisResults.busStations.zone10!,
                                                            analysisResults.busStations.zone15!
                                                        ).toFixed(2)}
                                                    </span>
                                                    <span className="text-purple-600 text-xs">/5.00</span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <span className="text-slate-400 text-sm">-</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={handleBusStationsAnalysis}
                                            disabled={!samplePointLocation || runningAnalysis === 'busStations'}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
                                        >
                                            {runningAnalysis === 'busStations' ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Running...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={14} />
                                                    Run
                                                </>
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Info note */}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                            💡 Click "Run" button for each subcategory to calculate values for all three zones (5, 10, 15 minutes walking distance).
                            Make sure you have selected a point on the map first.
                        </p>
                    </div>
                </section>

                {/* More sections coming soon... */}
            </div>
        </div>
    );
};
