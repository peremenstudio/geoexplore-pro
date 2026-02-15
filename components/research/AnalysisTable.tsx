import React from 'react';
import { Play, Loader2, MapPin, Bus } from 'lucide-react';
import Tooltip from '@mui/material/Tooltip';
import { AnalysisResults } from './types';

interface AnalysisTableProps {
    analysisResults: AnalysisResults;
    runningAnalysis: string | null;
    samplePointLocation: { lat: number; lng: number } | null;
    onIsochroneAreaAnalysis: () => void;
    onGardensAnalysis: () => void;
    onBusStationsAnalysis: () => void;
    calculateTransitScore: (zone5: number, zone10: number, zone15: number) => number;
}

export const AnalysisTable: React.FC<AnalysisTableProps> = ({
    analysisResults,
    runningAnalysis,
    samplePointLocation,
    onIsochroneAreaAnalysis,
    onGardensAnalysis,
    onBusStationsAnalysis,
    calculateTransitScore
}) => {
    return (
        <section className="bg-white p-6 rounded-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
                    <MapPin size={16} className="text-indigo-600" />
                </div>
                🏙️ Urban Indicators · Point Analysis
            </h3>

            <div className="overflow-x-auto">
                <table className="w-full border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                        <tr>
                            <th className="p-3 text-left text-sm font-semibold text-slate-700">Subcategory</th>
                            <th className="p-3 text-center text-sm font-semibold text-slate-700">Zone 5 min</th>
                            <th className="p-3 text-center text-sm font-semibold text-slate-700">Zone 10 min</th>
                            <th className="p-3 text-center text-sm font-semibold text-slate-700">Zone 15 min</th>
                            <th className="p-3 text-center text-sm font-semibold text-slate-700">Score</th>
                            <th className="p-3 text-center text-sm font-semibold text-slate-700">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Isochrone Area Row */}
                        <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-slate-800">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-indigo-100 rounded flex items-center justify-center">
                                        <MapPin size={16} className="text-indigo-600" />
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
                                <span className="text-slate-400 text-sm">N/A</span>
                            </td>
                            <td className="p-3 text-center">
                                <button
                                    onClick={onIsochroneAreaAnalysis}
                                    disabled={!samplePointLocation || runningAnalysis === 'isochroneArea'}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 mx-auto"
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
                                {analysisResults.gardenScores.zone5 !== null ? (
                                    <Tooltip title={
                                        <div className="text-xs">
                                            <div className="font-semibold mb-1">Garden Score Breakdown:</div>
                                            <div>Zone 5 min: {analysisResults.gardenScores.zone5.toFixed(2)}</div>
                                            <div>Zone 10 min: {analysisResults.gardenScores.zone10!.toFixed(2)}</div>
                                            <div>Zone 15 min: {analysisResults.gardenScores.zone15!.toFixed(2)}</div>
                                            <div className="mt-1 pt-1 border-t border-white/20">
                                                Total: {Math.min(
                                                    analysisResults.gardenScores.zone5 +
                                                    analysisResults.gardenScores.zone10! +
                                                    analysisResults.gardenScores.zone15!,
                                                    5
                                                ).toFixed(2)}
                                            </div>
                                        </div>
                                    } arrow>
                                        <div className="inline-flex items-center gap-1 cursor-help px-3 py-2 bg-green-50 rounded-lg">
                                            <span className="font-bold text-green-700 text-lg">
                                                {Math.min(
                                                    analysisResults.gardenScores.zone5 +
                                                    analysisResults.gardenScores.zone10! +
                                                    analysisResults.gardenScores.zone15!,
                                                    5
                                                ).toFixed(2)}
                                            </span>
                                            <span className="text-green-600 text-xs">/5.00</span>
                                        </div>
                                    </Tooltip>
                                ) : (
                                    <span className="text-slate-400 text-sm">-</span>
                                )}
                            </td>
                            <td className="p-3 text-center">
                                <button
                                    onClick={onGardensAnalysis}
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
                                    onClick={onBusStationsAnalysis}
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
    );
};
