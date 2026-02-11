import React, { useState } from 'react';
import { Layer } from '../types';
import { AVAILABLE_LAMAS_FILES, loadLamasFile, filterByLocality } from '../utils/lamasFiles';
import { Download, Loader2 } from 'lucide-react';

interface LamasFileLoaderProps {
  onAddLayer: (layer: Layer) => void;
  selectedLocality?: string;
}

export const LamasFileLoader: React.FC<LamasFileLoaderProps> = ({ onAddLayer, selectedLocality = 'All' }) => {
  const [selectedFileId, setSelectedFileId] = useState<string>('mifkad2022');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const handleLoadFile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Load the GeoJSON file
      let geojson = await loadLamasFile(selectedFileId);

      // Filter by locality if selected
      geojson = filterByLocality(geojson, selectedLocality);

      if (geojson.features.length === 0) {
        throw new Error(`No data found for locality: ${selectedLocality}`);
      }

      // Get file info
      const fileInfo = AVAILABLE_LAMAS_FILES.find(f => f.id === selectedFileId);
      
      if (!fileInfo) {
        throw new Error('File info not found');
      }

      // Create layer name based on file and locality selection
      const layerName = selectedLocality === 'All' 
        ? fileInfo.name
        : `${fileInfo.name} - ${selectedLocality}`;

      // Create layer object
      const layer: Layer = {
        id: `lamas_${selectedFileId}_${Date.now()}`,
        name: layerName,
        type: 'polygon',
        data: geojson,
        visible: true,
        color: '#10B981',
        opacity: 0.6,
        grid: {
          show: false,
          showLabels: false,
          size: 1,
          opacity: 0.3
        },
        metadata: {
          source: 'LAMAS',
          fileId: selectedFileId,
          year: fileInfo.year,
          fieldMetadata: fileInfo.fieldMetadata,
          featureCount: geojson.features.length,
          loadedAt: new Date().toISOString()
        }
      };

      // Add layer to map
      onAddLayer(layer);

      // Show success message
      const featureCount = geojson.features.length;
      setSuccess(`Successfully loaded ${featureCount.toLocaleString()} features!`);
    } catch (err) {
      console.error('Error loading LAMAS file:', err);
      setError(
        err instanceof Error
          ? `Error loading file: ${err.message}`
          : 'Unknown error loading file'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Dataset selector */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">
          Select Dataset
        </label>
        <select
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white"
          disabled={loading}
        >
          {AVAILABLE_LAMAS_FILES.map(file => (
            <option key={file.id} value={file.id}>
              {file.name}
            </option>
          ))}
        </select>
      </div>

      {/* Load button */}
      <button
        onClick={handleLoadFile}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Download size={16} />
            Load Data
          </>
        )}
      </button>

      {/* Success message */}
      {success && (
        <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs text-green-800">{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
};
