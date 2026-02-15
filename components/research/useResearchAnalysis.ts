import { useState } from 'react';
import { Layer } from '../../types';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';
import { 
    generateWalkingIsochrones, 
    duplicateLayer, 
    separateIsochroneLayers, 
    clip, 
    calculateArea, 
    difference 
} from '../../utils/gisToolbox';
import { 
    calculateAreaInIsochrones, 
    calculateGreenSpaceScore, 
    fetchTelAvivGreenSpaces 
} from '../../utils/researchTelAviv';
import { filterFeaturesByPolygon } from '../../utils/spatialFilter';
import { 
    calculateIndicatorScore, 
    NormalizationFunctions 
} from '../../utils/researchScoring';
import { AnalysisResults, Indicator, CategorizedPoints, StageData } from './types';
import { CATEGORY_COLORS } from './constants';

interface UseResearchAnalysisProps {
    layers: Layer[];
    onAddLayer?: (layer: Layer) => void;
    onRemoveLayer?: (layerId: string) => void;
    onSetResearchIsochrones?: (features: Feature[] | null) => void;
}

export const useResearchAnalysis = ({
    layers,
    onAddLayer,
    onRemoveLayer,
    onSetResearchIsochrones
}: UseResearchAnalysisProps) => {
    const [calculationResults, setCalculationResults] = useState<any>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [categorizedPoints, setCategorizedPoints] = useState<CategorizedPoints | null>(null);
    const [currentStage, setCurrentStage] = useState<number>(0);
    const [stageData, setStageData] = useState<StageData>({});
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

    // Calculate point score with full analysis
    const calculatePointScore = async (
        point: { lat: number; lng: number },
        indicators: Indicator[],
        weights: any,
        selectedCity: string
    ) => {
        setIsCalculating(true);
        
        try {
            console.log('🔬 Starting Research Analysis for point:', point);
            
            // 1. Generate REAL walking isochrones
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
            
            for (const feature of allFeatures) {
                let featurePoint: [number, number];
                
                if (feature.geometry.type === 'Point') {
                    featurePoint = feature.geometry.coordinates as [number, number];
                } else {
                    const centroid = turf.centroid(feature);
                    featurePoint = centroid.geometry.coordinates as [number, number];
                }
                
                const pt = turf.point(featurePoint);
                
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

            // 4. Calculate scores per category
            const categoryScores: Record<string, number[]> = {
                urban: [],
                social: [],
                economic: [],
                historical: []
            };

            // Use city-specific indicators if Tel Aviv is selected
            if (selectedCity === 'Tel Aviv') {
                console.log('🏙️ Using Tel Aviv municipal layers for analysis');
                
                const greenSpaceLayer = layers.find(l => l.name === 'שטחים ירוקים' || l.name.includes('ירוק'));
                if (greenSpaceLayer) {
                    console.log('🌳 Found green space layer:', greenSpaceLayer.name);
                    const greenAreas = calculateAreaInIsochrones(greenSpaceLayer, isochronesGeoJSON.features);
                    const greenScore = calculateGreenSpaceScore(greenAreas.gardenArea, greenAreas.isochroneArea, greenAreas.percentage);
                    categoryScores.urban.push(greenScore / 20);
                    
                    if (greenAreas.clippedFeatures.length > 0 && onAddLayer) {
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
                    }
                }
            }

            // Add OSM-based indicators
            const enabledIndicators = indicators.filter(ind => ind.enabled);
            
            enabledIndicators.forEach(indicator => {
                if (selectedCity === 'Tel Aviv' && indicator.id === 'parks') {
                    return;
                }
                
                let normalizeFunc = NormalizationFunctions.linearMoreIsBetter;
                
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

            // 7. Prepare isochrone features for map display
            const isochroneFeatures = isochronesGeoJSON.features.map((feature, idx) => {
                const minutes = feature.properties?.contour || [5, 10, 15][idx];
                return {
                    type: 'Feature' as const,
                    properties: {
                        ...feature.properties,
                        minutes: `${minutes} min`,
                        strokeColor: minutes <= 5 ? '#22c55e' : minutes <= 10 ? '#eab308' : '#f97316',
                        fillOpacity: 0,
                        strokeWidth: 3,
                        strokeOpacity: 1
                    },
                    geometry: feature.geometry
                };
            });
            
            if (onSetResearchIsochrones) {
                onSetResearchIsochrones(isochroneFeatures);
            }
            
            // 8. Categorize points for display
            const categorizedFeatures: CategorizedPoints = {
                urban: [],
                social: [],
                economic: [],
                historical: []
            };
            
            [...featuresByZone.A, ...featuresByZone.B, ...featuresByZone.C].forEach(feature => {
                const props = feature.properties || {};
                const propsStr = JSON.stringify(props).toLowerCase();
                
                if (propsStr.includes('park') || propsStr.includes('green') || propsStr.includes('transit') || propsStr.includes('transport')) {
                    categorizedFeatures.urban.push(feature);
                } else if (propsStr.includes('school') || propsStr.includes('hospital') || propsStr.includes('clinic') || propsStr.includes('health')) {
                    categorizedFeatures.social.push(feature);
                } else if (propsStr.includes('shop') || propsStr.includes('store') || propsStr.includes('commercial') || propsStr.includes('retail')) {
                    categorizedFeatures.economic.push(feature);
                } else if (propsStr.includes('heritage') || propsStr.includes('historic') || propsStr.includes('monument') || propsStr.includes('landmark')) {
                    categorizedFeatures.historical.push(feature);
                } else {
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

    // Run full research analysis
    const handleRunResearch = async (samplePointLocation: { lat: number; lng: number } | null, selectedCity: string) => {
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
            
            console.log('📍 Generated walking-based isochrones');
            
            if (onSetResearchIsochrones) {
                onSetResearchIsochrones(isochronesGeoJSON.features);
            }
            
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

    // Individual analysis handlers for the table
    const handleIsochroneAreaAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        setRunningAnalysis('isochroneArea');
        
        try {
            console.log('📊 Running Isochrone Area Analysis...');
            
            const isochronesGeoJSON = await generateWalkingIsochrones(
                [samplePointLocation.lng, samplePointLocation.lat],
                [5, 10, 15]
            );

            if (!isochronesGeoJSON.features || isochronesGeoJSON.features.length === 0) {
                alert('Failed to generate isochrones');
                return;
            }

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

            setStoredIsochrones(isochronesGeoJSON);

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

    const handleGardensAnalysis = async (samplePointLocation: { lat: number; lng: number } | null, analysisResults: AnalysisResults) => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        if (!storedIsochrones) {
            alert('Please run Isochrone Area analysis first');
            return;
        }

        setRunningAnalysis('gardens');
        
        try {
            console.log('🌳 Running Gardens Analysis...');
            
            const isochronesGeoJSON = storedIsochrones;
            const duplicatedIsochrones = duplicateLayer(isochronesGeoJSON) as any;
            const separatedZones = separateIsochroneLayers(duplicatedIsochrones);
            const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
            
            console.log('🌳 Fetching garden layer from Tel Aviv GIS...');
            const gardenUrl = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/503/query?where=1%3D1&outFields=*&f=geojson';
            
            const response = await fetch(gardenUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch gardens: ${response.statusText}`);
            }
            
            const gardenData = await response.json();
            console.log('✅ Fetched garden layer:', gardenData.features.length, 'features');
            
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
            
            const gardenCopy1 = duplicateLayer(gardenData) as any;
            const gardenCopy2 = duplicateLayer(gardenData) as any;
            const gardenCopy3 = duplicateLayer(gardenData) as any;
            
            const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden5 = clip(gardenCopy1.features, zone5Polygon);
            
            const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden10 = clip(gardenCopy2.features, zone10Polygon);
            
            const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const clippedGarden15 = clip(gardenCopy3.features, zone15Polygon);
            
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
            
            const calculateScore = (gardenArea: number, isochroneArea: number, multiplier: number): number => {
                if (!isochroneArea || isochroneArea === 0) return 0;
                const score = (gardenArea / isochroneArea) * 100 * multiplier;
                return Math.min(score, 5);
            };
            
            const gardenScores = {
                zone5: calculateScore(area5, analysisResults.isochroneArea.zone5 || 0, 1.0),
                zone10: calculateScore(area10, analysisResults.isochroneArea.zone10 || 0, 0.7),
                zone15: calculateScore(area15, analysisResults.isochroneArea.zone15 || 0, 0.3)
            };
            
            if (onAddLayer) {
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
            }
            
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

    const handleBusStationsAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
        if (!samplePointLocation) {
            alert('Please select a point on the map first');
            return;
        }

        if (!storedIsochrones) {
            alert('Please run Isochrone Area analysis first');
            return;
        }

        setRunningAnalysis('busStations');
        
        try {
            console.log('🚍 Running Bus Stations Analysis...');
            
            const busUrl = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/956/query?where=1%3D1&outFields=*&f=geojson';
            
            const response = await fetch(busUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch bus stations: ${response.statusText}`);
            }
            
            const busData = await response.json();
            console.log('✅ Fetched bus station layer:', busData.features.length, 'features');
            
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
            
            const isochronesGeoJSON = storedIsochrones;
            const separatedZones = separateIsochroneLayers(isochronesGeoJSON);
            const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
            
            const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
            const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
            
            const busInZone5 = clip(busData.features, zone5Polygon);
            const busInZone10Full = clip(busData.features, zone10Polygon);
            const busInZone10 = difference(busInZone10Full, zone5Polygon);
            const busInZone15Full = clip(busData.features, zone15Polygon);
            const busInZone15 = difference(busInZone15Full, zone10Polygon);
            
            if (onAddLayer) {
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
            }
            
            const busStationCounts = {
                zone5: busInZone5.length,
                zone10: busInZone10.length,
                zone15: busInZone15.length
            };
            
            const zone5Score = Math.sqrt(busStationCounts.zone5) * 1.0;
            const zone10Score = Math.sqrt(busStationCounts.zone10) * 0.4;
            const zone15Score = Math.sqrt(busStationCounts.zone15) * 0.1;
            
            const busStationScores = {
                zone5: zone5Score,
                zone10: zone10Score,
                zone15: zone15Score
            };
            
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

    return {
        calculationResults,
        isCalculating,
        categorizedPoints,
        currentStage,
        stageData,
        analysisResults,
        runningAnalysis,
        storedIsochrones,
        calculateTransitScore,
        calculatePointScore,
        handleRunResearch,
        handleIsochroneAreaAnalysis,
        handleGardensAnalysis,
        handleBusStationsAnalysis,
        setCalculationResults,
        setCategorizedPoints,
        setCurrentStage,
        setStageData,
        setAnalysisResults,
        setRunningAnalysis,
        setStoredIsochrones
    };
};
