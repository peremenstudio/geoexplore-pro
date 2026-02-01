import React, { useState } from 'react';
import { Globe, Loader2, Download, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { FeatureCollection } from 'geojson';
import {
    fetchEconomicDataByMunicipality,
    fetchCBSData,
    CBS_TABLES,
    calculateMetricStatistics,
    createMetricColorScale,
} from '../utils/lamasApi';
import { Layer } from '../types';

interface LamasDataFetcherProps {
    onAddLayer: (layer: Layer) => void;
    isLoading?: boolean;
}

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

export const LamasDataFetcher: React.FC<LamasDataFetcherProps> = ({ onAddLayer, isLoading: externalLoading }) => {
    const [status, setStatus] = useState<FetchStatus>('idle');
    const [selectedTable, setSelectedTable] = useState<number>(CBS_TABLES.MUNICIPALITY_STATISTICS);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear() - 1);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [successMessage, setSuccessMessage] = useState<string>('');

    const isLoading = externalLoading || status === 'loading';

    const handleFetchNationalData = async () => {
        try {
            setStatus('loading');
            setErrorMessage('');
            setSuccessMessage('');

            console.log('🌍 Fetching national data from LAMAS...');

            // Create a basic Israel municipalities GeoJSON (you can enhance this with real municipal boundaries)
            // For now, we'll fetch the data and create a feature collection
            const mockMunicipalityGeoJSON: FeatureCollection = {
                type: 'FeatureCollection',
                features: [],
            };

            // Fetch CBS data
            const cbsData = await fetchCBSData(selectedTable, {
                year: selectedYear,
            });

            console.log(`📊 Retrieved ${cbsData.length} data points from CBS`);

            if (cbsData.length === 0) {
                throw new Error('No data available for selected parameters');
            }

            // Group data by geography to create features
            const geographyMap = new Map<string, typeof cbsData>();
            cbsData.forEach(point => {
                if (!geographyMap.has(point.geography)) {
                    geographyMap.set(point.geography, []);
                }
                geographyMap.get(point.geography)!.push(point);
            });

            // Convert to GeoJSON features
            const features = Array.from(geographyMap.entries()).map(([geography, data]) => {
                const primaryData = data[0];
                return {
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [0, 0], // Placeholder - would need actual coordinates
                    },
                    properties: {
                        name: geography,
                        municipality: geography,
                        geographyLevel: primaryData.geographyLevel,
                        cbsData: data,
                        economicIndicators: data.reduce((acc, d) => {
                            acc[`${d.variable}_${d.period}`] = d.value;
                            return acc;
                        }, {} as Record<string, number>),
                    },
                };
            });

            const enrichedGeoJSON: FeatureCollection = {
                type: 'FeatureCollection',
                features,
            };

            // Calculate statistics
            const stats = calculateMetricStatistics(
                enrichedGeoJSON,
                Object.keys(enrichedGeoJSON.features[0]?.properties?.economicIndicators || {})[0] || ''
            );

            console.log('📈 Statistics:', stats);

            // Create layer
            const layer: Layer = {
                id: `lamas-${selectedTable}-${selectedYear}-${Date.now()}`,
                name: `National Data - Table ${selectedTable} (${selectedYear})`,
                visible: true,
                data: enrichedGeoJSON,
                color: '#059669',
                opacity: 0.7,
                type: 'point',
                grid: { show: false, showLabels: true, size: 0.5, opacity: 0.5 },
                lastUpdated: Date.now(),
            };

            onAddLayer(layer);

            setSuccessMessage(
                `✅ Loaded ${features.length} municipalities from CBS (Table ${selectedTable})`
            );
            setStatus('success');

            // Reset to idle after 3 seconds
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('❌ Error fetching LAMAS data:', error);
            setErrorMessage(message);
            setStatus('error');
        }
    };

    const tableOptions = [
        { id: CBS_TABLES.MUNICIPALITY_STATISTICS, label: 'Municipality Statistics' },
        { id: CBS_TABLES.POPULATION_BY_SETTLEMENT, label: 'Population by Settlement' },
        { id: CBS_TABLES.ECONOMIC_ACTIVITY, label: 'Economic Activity' },
        { id: CBS_TABLES.EMPLOYMENT, label: 'Employment Data' },
        { id: CBS_TABLES.EDUCATION, label: 'Education Statistics' },
        { id: CBS_TABLES.HOUSING, label: 'Housing Data' },
    ];

    const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Globe size={14} className="text-green-600" /> National Data (LAMAS)
                </h3>
            </div>

            {/* Table Selection */}
            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">
                    Data Source
                </label>
                <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(Number(e.target.value))}
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {tableOptions.map(option => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Year Selection */}
            <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">
                    Year
                </label>
                <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {years.map(year => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
            </div>

            {/* Info Box */}
            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="font-semibold text-green-600">CBS Data:</span> Official statistics from the Central Bureau of Statistics Israel. Data is typically available with a 3-6 month delay.
            </div>

            {/* Error Message */}
            {status === 'error' && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{errorMessage}</p>
                </div>
            )}

            {/* Success Message */}
            {status === 'success' && (
                <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-green-700">{successMessage}</p>
                </div>
            )}

            {/* Fetch Button */}
            <button
                onClick={handleFetchNationalData}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
            >
                {isLoading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Loading...
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        Fetch National Data
                    </>
                )}
            </button>

            {/* Help Text */}
            <div className="pt-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-500">Workflow:</span> Map → Fetch → National → LAMAS. Data will be automatically added as a new layer.
                </p>
            </div>
        </div>
    );
};
