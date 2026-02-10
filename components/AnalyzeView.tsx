import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layer } from '../types';
import { Feature } from 'geojson';
import { BarChart3, Filter, PieChart, Layers, Check, X, MoreHorizontal, LayoutGrid, List, AlignVerticalJustifyEnd, Map as MapIcon, Clock, User, Pencil, Square, Circle, Scissors, EyeOff } from 'lucide-react';
import { AlertModal, useAlertModal } from './AlertModal';
import { generateWalkingIsochrones } from '../utils/spatialAnalysis';
import { filterFeaturesByPolygon } from '../utils/spatialFilter';
import { getFieldHebrewName } from '../utils/lamasFiles';
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';

interface AnalyzeViewProps {
    layers: Layer[];
    layerFilters: Record<string, Record<string, FilterValue>>;
    layerSelectedAttributes: Record<string, string[]>;
    onFilterChange: (layerId: string | null, features: Feature[] | null) => void;
    onFiltersUpdate: (layerId: string, filters: Record<string, FilterValue>) => void;
    onSelectedAttributesUpdate: (layerId: string, attributes: string[]) => void;
    onAddLayer?: (layer: Layer) => void;
}

type ChartType = 'bar' | 'column' | 'donut' | 'treemap';
type FilterValue = string[] | { min: number; max: number };

// Color Palette for categorical data
const COLORS = [
    '#f2c80f', '#fc625e', '#a66999', '#c07350', '#9c9a9b', 
    '#608a5d', '#b888ad', '#fdab85', '#f7de6f', '#b7b3b3'
];

const getColor = (index: number) => COLORS[index % COLORS.length];

// Helper to determine if a column is relevant
const isRelevantColumn = (columnName: string, values: any[]): boolean => {
    // Skip metadata columns
    if (columnName.startsWith('_') || columnName === 'id' || columnName === 'created_at' || 
        columnName === 'name' || columnName.toLowerCase() === 'geometry') {
        return false;
    }

    // Show all columns - user wants to see everything
    return true;
};

// Helper to determine column type by checking all values
const getColumnType = (values: any[]): 'string' | 'number' | 'other' => {
    const nonEmptyValues = values.filter(v => v !== undefined && v !== null && v !== '');
    
    if (nonEmptyValues.length === 0) return 'string';
    
    // Count how many values are numbers
    let numberCount = 0;
    let stringCount = 0;
    
    for (const val of nonEmptyValues) {
        if (typeof val === 'number') {
            numberCount++;
        } else if (typeof val === 'string') {
            stringCount++;
        }
    }
    
    // If more than 50% are numbers, treat as numeric column
    if (numberCount > stringCount) {
        return 'number';
    }
    
    return 'string';
};

// --- Dual Range Slider Component (MUI) ---
const DualRangeSlider: React.FC<{
    min: number;
    max: number;
    value: { min: number; max: number };
    onChange: (value: { min: number; max: number }) => void;
}> = ({ min, max, value, onChange }) => {
    // Use controlled local state during dragging
    const [sliderValue, setSliderValue] = useState<[number, number]>([value.min, value.max]);
    const [inputValues, setInputValues] = useState<[string, string]>([
        value.min.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        value.max.toLocaleString(undefined, { maximumFractionDigits: 2 })
    ]);
    const isFirstRender = useRef(true);

    // Sync with external value changes only on mount and when not dragging
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setSliderValue([value.min, value.max]);
        setInputValues([
            value.min.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            value.max.toLocaleString(undefined, { maximumFractionDigits: 2 })
        ]);
    }, [value.min, value.max]);

    // Determine decimals based on range size
    const range = max - min;
    const step = range < 10 && range > 0 ? 0.01 : range < 100 && range > 0 ? 0.1 : 1;

    const handleChange = (event: Event, newValue: number | number[]) => {
        if (Array.isArray(newValue)) {
            // Update local state immediately for smooth UI
            setSliderValue([newValue[0], newValue[1]]);
            setInputValues([
                newValue[0].toLocaleString(undefined, { maximumFractionDigits: 2 }),
                newValue[1].toLocaleString(undefined, { maximumFractionDigits: 2 })
            ]);
            // Also update parent
            onChange({ min: newValue[0], max: newValue[1] });
        }
    };

    const handleInputChange = (index: 0 | 1, val: string) => {
        const newInputValues: [string, string] = [...inputValues] as [string, string];
        newInputValues[index] = val;
        setInputValues(newInputValues);
    };

    const handleInputBlur = (index: 0 | 1) => {
        const numValue = parseFloat(inputValues[index].replace(/,/g, ''));
        
        if (isNaN(numValue)) {
            // Reset to current slider value if invalid
            setInputValues([
                sliderValue[0].toLocaleString(undefined, { maximumFractionDigits: 2 }),
                sliderValue[1].toLocaleString(undefined, { maximumFractionDigits: 2 })
            ]);
            return;
        }

        // Clamp value between min and max
        const clampedValue = Math.max(min, Math.min(max, numValue));
        
        const newSliderValue: [number, number] = [...sliderValue] as [number, number];
        newSliderValue[index] = clampedValue;
        
        // Ensure min <= max
        if (index === 0 && newSliderValue[0] > newSliderValue[1]) {
            newSliderValue[0] = newSliderValue[1];
        } else if (index === 1 && newSliderValue[1] < newSliderValue[0]) {
            newSliderValue[1] = newSliderValue[0];
        }
        
        setSliderValue(newSliderValue);
        setInputValues([
            newSliderValue[0].toLocaleString(undefined, { maximumFractionDigits: 2 }),
            newSliderValue[1].toLocaleString(undefined, { maximumFractionDigits: 2 })
        ]);
        onChange({ min: newSliderValue[0], max: newSliderValue[1] });
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: 0 | 1) => {
        if (e.key === 'Enter') {
            handleInputBlur(index);
            (e.target as HTMLInputElement).blur();
        }
    };

    const valuetext = (val: number) => {
        return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    return (
        <Box sx={{ width: '100%', px: 1, mt: 1, mb: 2 }}>
            <Slider
                value={sliderValue}
                onChange={handleChange}
                valueLabelDisplay="auto"
                getAriaValueText={valuetext}
                min={min}
                max={max}
                step={step}
                disableSwap={false}
                sx={{
                    color: '#f2c80f',
                    height: 6,
                    '& .MuiSlider-thumb': {
                        width: 18,
                        height: 18,
                        backgroundColor: '#fff',
                        border: '2px solid #f2c80f',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s ease-out',
                        '&:hover': {
                            boxShadow: '0 0 0 10px rgba(242, 200, 15, 0.2)',
                        },
                        '&.Mui-active': {
                            boxShadow: '0 0 0 12px rgba(242, 200, 15, 0.3)',
                        },
                    },
                    '& .MuiSlider-track': {
                        height: 6,
                        backgroundColor: '#f2c80f',
                        border: 'none',
                    },
                    '& .MuiSlider-rail': {
                        height: 6,
                        backgroundColor: '#e2e8f0',
                        opacity: 1,
                    },
                    '& .MuiSlider-valueLabel': {
                        fontSize: 11,
                        fontWeight: 'bold',
                        backgroundColor: '#334155',
                    },
                }}
            />
            <div className="flex justify-between gap-2 mt-1">
                <input
                    type="text"
                    value={inputValues[0]}
                    onChange={(e) => handleInputChange(0, e.target.value)}
                    onBlur={() => handleInputBlur(0)}
                    onKeyDown={(e) => handleInputKeyDown(e, 0)}
                    className="w-20 px-2 py-1 text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded text-center hover:border-yellow-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-colors"
                />
                <input
                    type="text"
                    value={inputValues[1]}
                    onChange={(e) => handleInputChange(1, e.target.value)}
                    onBlur={() => handleInputBlur(1)}
                    onKeyDown={(e) => handleInputKeyDown(e, 1)}
                    className="w-20 px-2 py-1 text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded text-center hover:border-yellow-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none transition-colors"
                />
            </div>
        </Box>
    );
};

// Component for a Single Attribute Widget
const AttributeWidget: React.FC<{
    attribute: string;
    features: Feature[];
    allFeatures: Feature[]; // Unfiltered features for stats calculation
    activeFilters: FilterValue | undefined;
    onToggleFilter: (value: any) => void;
}> = ({ attribute, features, allFeatures, activeFilters, onToggleFilter }) => {
    
    // Default to 'bar' (Cluster Bar / List) for strings
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate Stats from ALL features (not filtered) to get true min/max
    const stats = useMemo(() => {
        const values = allFeatures.map(f => f.properties?.[attribute]);
        const type = getColumnType(values);

        if (type === 'number') {
            const nums = values.filter(v => typeof v === 'number') as number[];
            if (nums.length === 0) return { type: 'number', min: 0, max: 0 };
            return {
                type: 'number',
                min: Math.min(...nums),
                max: Math.max(...nums)
            };
        } else {
            // String / Categorical - use filtered features for distribution
            const filteredValues = features.map(f => f.properties?.[attribute]);
            const counts: Record<string, number> = {};
            filteredValues.forEach(v => {
                const key = v === undefined || v === null || v === '' ? '(Empty)' : String(v);
                counts[key] = (counts[key] || 0) + 1;
            });
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            const topCategories = sorted.slice(0, 15); // Show top 15
            const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
            return {
                type: 'string',
                distribution: topCategories,
                maxCount: topCategories[0]?.[1] || 1,
                totalCount
            };
        }
    }, [allFeatures, features, attribute]);

    // Render Numerical Widget with Slider
    if (stats.type === 'number') {
        const currentRange = (activeFilters as { min: number, max: number }) || { min: stats.min, max: stats.max };
        const displayName = getFieldHebrewName(attribute);

        return (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <PieChart size={16} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm truncate" title={displayName}>{displayName}</span>
                </div>
                
                {/* KPI Grid - Min and Max only */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                     <div className="bg-slate-50 p-2 rounded-lg">
                         <span className="block text-[10px] uppercase text-slate-400 font-bold">Min</span>
                         <span className="text-sm font-bold text-slate-800">{stats.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                     </div>
                     <div className="bg-slate-50 p-2 rounded-lg">
                         <span className="block text-[10px] uppercase text-slate-400 font-bold">Max</span>
                         <span className="text-sm font-bold text-slate-800">{stats.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                     </div>
                </div>

                {/* Slider Control */}
                <div className="mt-auto px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Filter Range</span>
                    <DualRangeSlider 
                        min={stats.min} 
                        max={stats.max} 
                        value={currentRange}
                        onChange={(val) => onToggleFilter(val)}
                    />
                </div>
            </div>
        );
    }

    // --- Render Categorical Widget ---
    const activeStringFilters = (activeFilters as string[]) || [];
    const displayName = getFieldHebrewName(attribute);

    const renderChart = () => {
        // 1. Cluster Bar (List)
        if (chartType === 'bar') {
            return (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {stats.distribution.map(([key, count], idx) => {
                        const isSelected = activeStringFilters.includes(key);
                        const isDimmed = activeStringFilters.length > 0 && !isSelected;
                        const percent = (count / stats.maxCount) * 100;
                        
                        return (
                            <div 
                            key={key} 
                            onClick={() => onToggleFilter(key)}
                            className={`group cursor-pointer relative flex items-center text-xs transition-all duration-200 ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
                            >
                                <div className="w-24 truncate text-slate-600 font-medium mr-2 text-right flex-shrink-0" title={key}>{key}</div>
                                <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden relative">
                                    <div 
                                    className={`h-full rounded-md transition-all duration-300 ${isSelected ? 'bg-coral-600' : 'bg-coral-400 group-hover:bg-coral-500'}`}
                                    style={{ width: `${percent}%` }}
                                    />
                                    <span className={`absolute right-2 top-1/2 -translate-y-1/2 font-bold text-[10px] ${percent > 80 ? 'text-white' : 'text-slate-600'}`}>
                                        {count}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // 2. Column Chart
        if (chartType === 'column') {
            return (
                <div className="flex-1 flex items-end gap-1 overflow-x-auto custom-scrollbar pt-4 pb-1">
                    {stats.distribution.map(([key, count]) => {
                        const isSelected = activeStringFilters.includes(key);
                        const isDimmed = activeStringFilters.length > 0 && !isSelected;
                        const heightPercent = Math.max((count / stats.maxCount) * 100, 5); // Min 5% height

                        return (
                            <div 
                                key={key}
                                onClick={() => onToggleFilter(key)}
                                className={`flex flex-col items-center gap-1 cursor-pointer transition-opacity ${isDimmed ? 'opacity-40' : 'opacity-100'} flex-shrink-0 w-12`}
                            >
                                <span className="text-[9px] font-bold text-slate-500">{count}</span>
                                <div className="w-full relative h-32 bg-slate-50 rounded-t-md flex items-end justify-center group">
                                     <div 
                                        className={`w-full rounded-t-md transition-all duration-300 ${isSelected ? 'bg-coral-600' : 'bg-coral-400 group-hover:bg-coral-500'}`}
                                        style={{ height: `${heightPercent}%` }}
                                     />
                                </div>
                                <span className="text-[9px] text-slate-600 truncate w-full text-center" title={key}>{key}</span>
                            </div>
                        )
                    })}
                </div>
            );
        }

        // 3. Treemap
        if (chartType === 'treemap') {
            return (
                <div className="flex-1 flex flex-wrap content-start gap-0.5 overflow-hidden rounded-lg bg-slate-100 p-0.5">
                    {stats.distribution.map(([key, count], idx) => {
                         const isSelected = activeStringFilters.includes(key);
                         const isDimmed = activeStringFilters.length > 0 && !isSelected;
                         const areaPercent = (count / stats.totalCount) * 100;
                         // Simple visual sizing approximation based on percentage
                         const grow = Math.floor(areaPercent * 10); 
                         const color = getColor(idx);

                         return (
                            <div 
                                key={key}
                                onClick={() => onToggleFilter(key)}
                                className={`h-auto min-h-[40px] flex flex-col items-center justify-center text-center p-1 cursor-pointer transition-all hover:brightness-110 ${isDimmed ? 'opacity-20 grayscale' : 'opacity-100'}`}
                                style={{ 
                                    flexGrow: grow || 1, 
                                    flexBasis: `${Math.max(areaPercent, 15)}%`,
                                    backgroundColor: isSelected ? '#1e293b' : color,
                                    color: 'white'
                                }}
                                title={`${key}: ${count}`}
                            >
                                <span className="text-[10px] font-bold truncate w-full px-1">{key}</span>
                                <span className="text-[9px] opacity-80">{count}</span>
                            </div>
                         );
                    })}
                </div>
            );
        }

        // 4. Donut Chart
        if (chartType === 'donut') {
            let cumulativePercent = 0;
            const size = 160;
            const strokeWidth = 30;
            const radius = (size - strokeWidth) / 2;
            const circumference = 2 * Math.PI * radius;

            return (
                <div className="flex-1 flex flex-col items-center justify-center relative">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
                        {stats.distribution.map(([key, count], idx) => {
                            const isSelected = activeStringFilters.includes(key);
                            const isDimmed = activeStringFilters.length > 0 && !isSelected;
                            
                            const percent = count / stats.totalCount;
                            const strokeDasharray = `${percent * circumference} ${circumference}`;
                            const strokeDashoffset = -cumulativePercent * circumference;
                            
                            cumulativePercent += percent;
                            const color = getColor(idx);

                            return (
                                <circle
                                    key={key}
                                    cx={size/2}
                                    cy={size/2}
                                    r={radius}
                                    fill="transparent"
                                    stroke={isSelected ? '#1e293b' : color}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    className={`transition-all duration-300 cursor-pointer hover:stroke-[34px] ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
                                    onClick={() => onToggleFilter(key)}
                                >
                                    <title>{key}: {count}</title>
                                </circle>
                            );
                        })}
                    </svg>
                    
                    {/* Legend */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm">
                             <span className="block text-xs text-slate-400 font-bold uppercase">Total</span>
                             <span className="block text-lg font-bold text-slate-800">{stats.totalCount}</span>
                        </div>
                    </div>

                    <div className="w-full mt-2 flex flex-wrap gap-2 justify-center max-h-20 overflow-y-auto px-2">
                        {stats.distribution.slice(0, 5).map(([key], idx) => (
                             <div key={key} className="flex items-center gap-1 text-[9px] text-slate-600">
                                 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(idx) }}/>
                                 <span className="truncate max-w-[60px]">{key}</span>
                             </div>
                        ))}
                    </div>
                </div>
            );
        }

        return null;
    };


    // Categorical Chart Container
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full overflow-hidden flex flex-col relative">
             <div className="flex items-center justify-between mb-3 z-10">
                 <div className="flex items-center gap-2 overflow-hidden">
                    <div className="p-1.5 bg-coral-50 text-coral-600 rounded-lg flex-shrink-0">
                        <BarChart3 size={16} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm truncate" title={displayName}>{displayName}</span>
                 </div>
                 
                 <div className="flex items-center gap-2 flex-shrink-0">
                     {activeStringFilters.length > 0 && (
                        <span className="text-[10px] bg-coral-100 text-coral-700 px-1.5 py-0.5 rounded font-bold">
                            {activeStringFilters.length}
                        </span>
                     )}
                     
                     <div className="relative" ref={menuRef}>
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                        
                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg p-1.5 w-40 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                                <button 
                                    onClick={() => { setChartType('donut'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md text-left ${chartType === 'donut' ? 'bg-coral-50 text-coral-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <PieChart size={14} /> Donut Chart
                                </button>
                                <button 
                                    onClick={() => { setChartType('treemap'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md text-left ${chartType === 'treemap' ? 'bg-coral-50 text-coral-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <LayoutGrid size={14} /> Treemap
                                </button>
                                <button 
                                    onClick={() => { setChartType('bar'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md text-left ${chartType === 'bar' ? 'bg-coral-50 text-coral-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <List size={14} /> Cluster Bar
                                </button>
                                <button 
                                    onClick={() => { setChartType('column'); setIsMenuOpen(false); }}
                                    className={`flex items-center gap-2 px-2 py-1.5 text-xs font-medium rounded-md text-left ${chartType === 'column' ? 'bg-coral-50 text-coral-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <AlignVerticalJustifyEnd size={14} /> Columns
                                </button>
                            </div>
                        )}
                     </div>
                 </div>
             </div>
             
             {renderChart()}
        </div>
    );
};

export const AnalyzeView: React.FC<AnalyzeViewProps> = ({ 
    layers, 
    layerFilters, 
    layerSelectedAttributes, 
    onFilterChange, 
    onFiltersUpdate,
    onSelectedAttributesUpdate,
    onAddLayer 
}) => {
    const [selectedLayerId, setSelectedLayerId] = useState<string>('');
    
    // Get current layer's filters and attributes from parent state
    const filters = selectedLayerId ? (layerFilters[selectedLayerId] || {}) : {};
    const selectedAttributes = selectedLayerId ? (layerSelectedAttributes[selectedLayerId] || []) : [];
    
    // Helper to update filters
    const setFilters = (newFilters: Record<string, FilterValue> | ((prev: Record<string, FilterValue>) => Record<string, FilterValue>)) => {
        if (!selectedLayerId) return;
        const resolvedFilters = typeof newFilters === 'function' ? newFilters(filters) : newFilters;
        onFiltersUpdate(selectedLayerId, resolvedFilters);
    };
    
    // Helper to update selected attributes
    const setSelectedAttributes = (newAttributes: string[] | ((prev: string[]) => string[])) => {
        if (!selectedLayerId) return;
        const resolvedAttributes = typeof newAttributes === 'function' ? newAttributes(selectedAttributes) : newAttributes;
        onSelectedAttributesUpdate(selectedLayerId, resolvedAttributes);
    };
    
    // Spatial Analysis State
    const [isGeneratingIsochrone, setIsGeneratingIsochrone] = useState(false);
    const [showCutByBoundaryModal, setShowCutByBoundaryModal] = useState(false);
    const [isCuttingByBoundary, setIsCuttingByBoundary] = useState(false);
    
    // Alert Modal
    const { modal, showAlert, hideAlert } = useAlertModal();

    const selectedLayer = layers.find(l => l.id === selectedLayerId);
    const visibleLayers = layers.filter(l => l.visible);

    // Initial Selection - only select from visible layers
    useEffect(() => {
        if (!selectedLayerId && visibleLayers.length > 0) {
            setSelectedLayerId(visibleLayers[0].id);
        }
    }, [layers, selectedLayerId, visibleLayers.length]);

    // Auto-switch if current layer becomes hidden
    useEffect(() => {
        if (selectedLayerId && selectedLayer && !selectedLayer.visible && visibleLayers.length > 0) {
            setSelectedLayerId(visibleLayers[0].id);
        }
    }, [selectedLayerId, selectedLayer, visibleLayers]);

    // Auto-select attributes only if not already set for this layer
    useEffect(() => {
        if (selectedLayer && selectedAttributes.length === 0) {
             // Auto-select up to 4 relevant columns (with at least 3 different values)
            const features = selectedLayer.data.features;
            if (features.length > 0 && features[0]?.properties) {
                const firstFeature = features[0];
                const allKeys = Object.keys(firstFeature.properties);
                
                // Filter for relevant columns
                const relevantKeys = allKeys.filter(key => {
                    const values = features.map(f => f.properties?.[key]);
                    return isRelevantColumn(key, values);
                });
                
                // Take first 4 relevant columns
                setSelectedAttributes(relevantKeys.slice(0, 4));
            }
        }
    }, [selectedLayerId, selectedLayer, selectedAttributes.length]);

    // Calculate Filtered Features (for cross-filtering across all widgets)
    const filteredFeatures = useMemo(() => {
        if (!selectedLayer) return [];
        
        const activeFilterKeys = Object.keys(filters);
        
        if (activeFilterKeys.length === 0) {
            return selectedLayer.data.features;
        }

        return selectedLayer.data.features.filter(f => {
            return activeFilterKeys.every(attr => {
                const val = f.properties?.[attr];
                const filterValue = filters[attr];

                // 1. Numerical Range Filter
                if (filterValue && typeof filterValue === 'object' && 'min' in filterValue && 'max' in filterValue) {
                     const numVal = Number(val);
                     if (isNaN(numVal)) return false; 
                     return numVal >= filterValue.min && numVal <= filterValue.max;
                }
                
                // 2. Categorical / String Filter (Array)
                if (Array.isArray(filterValue) && filterValue.length > 0) {
                    const strVal = val === undefined || val === null || val === '' ? '(Empty)' : String(val);
                    return filterValue.includes(strVal);
                }

                return true;
            });
        });
    }, [selectedLayer, filters]);

    // Notify parent of filter changes
    useEffect(() => {
        if (!selectedLayer) {
            onFilterChange(null, null);
            return;
        }
        onFilterChange(selectedLayer.id, filteredFeatures);
    }, [selectedLayer, filteredFeatures, onFilterChange]);


    const toggleAttribute = (attr: string) => {
        setSelectedAttributes(prev => 
            prev.includes(attr) ? prev.filter(k => k !== attr) : [...prev, attr]
        );
    };

    const toggleFilter = (attr: string, value: any) => {
        setFilters(prev => {
            // If value is a range object {min, max}, replace directly
            if (value && typeof value === 'object' && 'min' in value) {
                return { ...prev, [attr]: value };
            }

            // Otherwise assume it's a string value for categorical toggle
            const currentList = (prev[attr] as string[]) || [];
            if (!Array.isArray(currentList)) return prev; // Should not happen if types matched

            const updated = currentList.includes(value) 
                ? currentList.filter(v => v !== value)
                : [...currentList, value];
            
            // Cleanup empty arrays
            if (updated.length === 0) {
                const { [attr]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [attr]: updated };
        });
    };

    const clearFilters = () => setFilters({});

    const handleGenerateIsochrones = async () => {
        if (!selectedLayer) return;
        
        // Find ALL point features in the layer
        const pointFeatures = selectedLayer.data.features.filter(f => f.geometry?.type === 'Point');
        if (pointFeatures.length === 0) {
            showAlert('warning', 'No Point Features', 'Please select a layer with point features to generate isochrones.');
            return;
        }
        
        // Validate maximum 5 points
        if (pointFeatures.length > 5) {
            showAlert('warning', 'Too Many Points', `You have ${pointFeatures.length} points in the layer.\n\nMaximum allowed: 5 points\n\nPlease filter the layer or create a smaller subset.`);
            return;
        }
        
        setIsGeneratingIsochrone(true);
        try {
            console.log(`🎯 Generating isochrones for ${pointFeatures.length} point(s)...`);
            
            // Collect all isochrone features from all points
            const allIsochroneFeatures: any[] = [];
            
            // Process each point sequentially to avoid rate limits
            for (let i = 0; i < pointFeatures.length; i++) {
                const feature = pointFeatures[i];
                const coords = (feature.geometry.coordinates) as [number, number];
                console.log(`📍 Point ${i + 1}/${pointFeatures.length}:`, coords);
                
                const isochrones = await generateWalkingIsochrones(coords, [5, 10, 15]);
                
                // Add point identifier to each isochrone
                isochrones.features.forEach(isoFeature => {
                    isoFeature.properties = {
                        ...isoFeature.properties,
                        pointIndex: i + 1,
                        sourcePoint: coords
                    };
                });
                
                allIsochroneFeatures.push(...isochrones.features);
                
                // Small delay between points to avoid rate limiting
                if (i < pointFeatures.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            if (onAddLayer && allIsochroneFeatures.length > 0) {
                const isochroneLayer: Layer = {
                    id: `isochrone-${selectedLayer.id}-${Date.now()}`,
                    name: `Walking Isochrones - ${selectedLayer.name} (${pointFeatures.length} pts)`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: allIsochroneFeatures
                    },
                    color: '#8b5cf6',
                    opacity: 0.4,
                    type: 'polygon',
                    grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
                    lastUpdated: Date.now()
                };
                onAddLayer(isochroneLayer);
                console.log(`✅ Generated ${allIsochroneFeatures.length} isochrones for ${pointFeatures.length} points`);
            }
        } catch (error: any) {
            console.error('Isochrone generation error:', error);
            showAlert('error', 'Error Generating Isochrones', error.message || 'An unexpected error occurred.');
        } finally {
            setIsGeneratingIsochrone(false);
        }
    };

    const handleCutByBoundary = async (boundaryLayerId: string) => {
        if (!selectedLayer) return;
        
        const boundaryLayer = layers.find(l => l.id === boundaryLayerId);
        if (!boundaryLayer) return;
        
        // Find the first polygon feature to use as boundary
        const boundaryPolygon = boundaryLayer.data.features.find(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');
        if (!boundaryPolygon) {
            showAlert('warning', 'Invalid Boundary', 'Selected boundary layer has no polygon features.');
            return;
        }

        setIsCuttingByBoundary(true);
        try {
            console.log(`✂️ Cutting ${selectedLayer.name} by boundary from ${boundaryLayer.name}...`);
            
            // Filter features using the boundary polygon
            const filteredFeatures = filterFeaturesByPolygon(selectedLayer.data.features, boundaryPolygon);
            
            if (filteredFeatures.length === 0) {
                showAlert('info', 'No Features Found', 'No features found inside the selected boundary.');
                setShowCutByBoundaryModal(false);
                return;
            }

            if (onAddLayer) {
                const cutLayer: Layer = {
                    id: `cut-${selectedLayer.id}-${Date.now()}`,
                    name: `${selectedLayer.name} - Cut by ${boundaryLayer.name}`,
                    visible: true,
                    data: {
                        type: 'FeatureCollection',
                        features: filteredFeatures
                    },
                    color: selectedLayer.color || '#8b5cf6',
                    opacity: selectedLayer.opacity || 0.8,
                    type: selectedLayer.type,
                    grid: selectedLayer.grid,
                    lastUpdated: Date.now()
                };
                onAddLayer(cutLayer);
                console.log(`✅ Created new layer with ${filteredFeatures.length} features inside boundary`);
                showAlert('success', 'Layer Created', `Successfully created "${cutLayer.name}" with ${filteredFeatures.length} features.`);
            }
        } catch (error: any) {
            console.error('Cut by boundary error:', error);
            showAlert('error', 'Error Cutting Layer', error.message || 'An unexpected error occurred.');
        } finally {
            setIsCuttingByBoundary(false);
            setShowCutByBoundaryModal(false);
        }
    };

    if (visibleLayers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <EyeOff size={48} className="text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No visible layers to analyze</p>
                <p className="text-slate-400 text-sm mt-2">Show at least one layer to start analyzing</p>
            </div>
        );
    }

    if (!selectedLayer) {
        return <div className="p-8 text-center text-slate-400">No layers available to analyze.</div>;
    }

    const availableAttributes = selectedLayer.data.features.length > 0 
        ? Object.keys(selectedLayer.data.features[0].properties || {}).filter(k => !k.startsWith('_') && k !== 'id')
        : [];

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            {/* Header / Config */}
            <div className="bg-white p-5 border-b border-slate-200 shadow-sm z-10">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-purple-600" /> Data Analysis
                    </h2>
                    {Object.keys(filters).length > 0 && (
                        <button 
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors"
                        >
                            <X size={14} /> Clear {Object.keys(filters).length} Filters
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
                    {/* Layer Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Source Layer</label>
                        <div className="relative mb-3">
                            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            {visibleLayers.length > 0 ? (
                                <select 
                                    value={selectedLayerId}
                                    onChange={(e) => setSelectedLayerId(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 appearance-none"
                                >
                                    {visibleLayers.map(l => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-400 italic">
                                    No visible layers
                                </div>
                            )}
                        </div>
                        
                        {/* Spatial Analysis Buttons */}
                        <div className="space-y-2">
                            <button
                                onClick={handleGenerateIsochrones}
                                disabled={isGeneratingIsochrone}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <User size={14} />
                                {isGeneratingIsochrone ? 'Generating...' : 'Walking Distance 5,10,15 min'}
                            </button>
                            <button
                                onClick={() => setShowCutByBoundaryModal(true)}
                                disabled={!selectedLayer || isCuttingByBoundary}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Scissors size={14} />
                                {isCuttingByBoundary ? 'Cutting...' : 'Cut by Boundary'}
                            </button>
                        </div>
                    </div>

                    {/* Columns Selector */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fields to Visualize</label>
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar p-1">
                            {availableAttributes.map(attr => (
                                <button
                                    key={attr}
                                    onClick={() => toggleAttribute(attr)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                                        selectedAttributes.includes(attr)
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                                    }`}
                                    title={attr}
                                >
                                    {getFieldHebrewName(attr)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-100/50">
                {selectedAttributes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Filter size={48} className="opacity-20 mb-4" />
                        <p className="font-medium">Select fields above to generate charts.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 auto-rows-[280px]">
                        {selectedAttributes.map(attr => (
                            <AttributeWidget 
                                key={attr}
                                attribute={attr}
                                features={filteredFeatures} // Filtered features for display
                                allFeatures={selectedLayer.data.features} // Original unfiltered features for stats
                                activeFilters={filters[attr]}
                                onToggleFilter={(val) => toggleFilter(attr, val)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Cut by Boundary Modal */}
            {showCutByBoundaryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-96 overflow-hidden flex flex-col">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Select Boundary Polygon</h2>
                        
                        {/* List of polygon layers with single feature */}
                        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
                            {layers
                                .filter(l => 
                                    l.type === 'polygon' && 
                                    l.data.features.length === 1 &&
                                    l.id !== selectedLayerId
                                )
                                .length === 0 ? (
                                <div className="text-center text-slate-400 text-sm py-4">
                                    <p>No polygon layers with single boundary found.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {layers
                                        .filter(l => 
                                            l.type === 'polygon' && 
                                            l.data.features.length === 1 &&
                                            l.id !== selectedLayerId
                                        )
                                        .map(layer => (
                                            <button
                                                key={layer.id}
                                                onClick={() => handleCutByBoundary(layer.id)}
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-purple-100 border border-slate-200 hover:border-purple-300 transition-colors text-sm font-medium text-slate-700"
                                            >
                                                {layer.name}
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowCutByBoundaryModal(false)}
                            className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            
            {/* Alert Modal */}
            <AlertModal 
                show={modal.show}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                onClose={hideAlert}
            />
        </div>
    );
};