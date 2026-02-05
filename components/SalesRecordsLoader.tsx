import React, { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Layer } from '../types';
import { getNextLayerColor } from '../utils/layerColors';
import { getPricesCities, getPricesYears, loadSalesRecordsCsv } from '../utils/pricesFiles';

interface SalesRecordsLoaderProps {
  onAddLayer: (layer: Layer) => void;
}

export const SalesRecordsLoader: React.FC<SalesRecordsLoaderProps> = ({ onAddLayer }) => {
  const cities = useMemo(() => getPricesCities(), []);
  const years = useMemo(() => getPricesYears(), []);

  const [selectedCity, setSelectedCity] = useState<string>(cities[0] ?? '');
  const [selectedYear, setSelectedYear] = useState<number>(years[years.length - 1] ?? 2025);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLoad = async () => {
    if (!selectedCity || !selectedYear) {
      setError('Please select both city and year.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const geojson = await loadSalesRecordsCsv(selectedCity, selectedYear);

      const layer: Layer = {
        id: `sales_${selectedCity}_${selectedYear}_${Date.now()}`,
        name: `Sales Records - ${selectedCity} ${selectedYear}`,
        type: 'point',
        data: geojson,
        visible: true,
        color: getNextLayerColor(),
        opacity: 0.7,
        grid: {
          show: false,
          showLabels: false,
          size: 10,
          opacity: 0.3
        },
        metadata: {
          source: 'Sales Records',
          municipality: selectedCity,
          year: selectedYear,
          featureCount: geojson.features.length,
          loadedAt: new Date().toISOString()
        }
      };

      onAddLayer(layer);
      setSuccess(`Loaded ${geojson.features.length.toLocaleString()} records.`);
    } catch (err) {
      console.error('Error loading sales records:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sales records.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">City</label>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          disabled={loading}
        >
          {cities.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">Year</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          disabled={loading}
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleLoad}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Download size={16} />
            Load Sales Records
          </>
        )}
      </button>

      {success && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-800">{success}</p>
        </div>
      )}

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
};
