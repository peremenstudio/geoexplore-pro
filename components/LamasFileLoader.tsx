import React, { useState, useEffect } from 'react';
import { Layer } from '../types';
import {
  AVAILABLE_LAMAS_FILES,
  loadLamasFile,
  filterByMunicipality,
  getUniqueMunicipalities
} from '../utils/lamasFiles';

interface LamasFileLoaderProps {
  onAddLayer: (layer: Layer) => void;
}

export const LamasFileLoader: React.FC<LamasFileLoaderProps> = ({ onAddLayer }) => {
  const [selectedFileId, setSelectedFileId] = useState<string>('mifkad2022');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [externalUrl, setExternalUrl] = useState<string>('');

  // Reset municipality filter when file changes
  useEffect(() => {
    setSelectedMunicipality('');
    setMunicipalities([]);
  }, [selectedFileId]);

  const handleLoadFile = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Load the GeoJSON file
      const geojson = await loadLamasFile(selectedFileId, externalUrl || undefined);
      
      // Get municipalities if not already loaded
      if (municipalities.length === 0) {
        const uniqueMunicipalities = getUniqueMunicipalities(geojson);
        setMunicipalities(uniqueMunicipalities);
      }

      // Apply municipality filter if selected
      let filteredData = geojson;
      if (selectedMunicipality) {
        filteredData = filterByMunicipality(geojson, selectedMunicipality);
        
        if (filteredData.features.length === 0) {
          setError(`לא נמצאו נתונים עבור ${selectedMunicipality}`);
          setLoading(false);
          return;
        }
      }

      // Get file info
      const fileInfo = AVAILABLE_LAMAS_FILES.find(f => f.id === selectedFileId);
      
      if (!fileInfo) {
        throw new Error('File info not found');
      }

      // Create layer object
      const layer: Layer = {
        id: `lamas_${selectedFileId}_${Date.now()}`,
        name: selectedMunicipality 
          ? `${fileInfo.name} - ${selectedMunicipality}`
          : fileInfo.name,
        type: 'polygon',
        data: filteredData,
        visible: true,
        color: '#3B82F6',
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
          municipality: selectedMunicipality || 'כל הארץ',
          year: fileInfo.year,
          fieldMetadata: fileInfo.fieldMetadata,
          featureCount: filteredData.features.length,
          loadedAt: new Date().toISOString()
        }
      };

      // Add layer to map
      onAddLayer(layer);

      // Show success message
      const featureCount = filteredData.features.length;
      setSuccess(
        `הקובץ נטען בהצלחה! ${featureCount} ישויות גאוגרפיות${
          selectedMunicipality ? ` עבור ${selectedMunicipality}` : ''
        }`
      );
    } catch (err) {
      console.error('Error loading LAMAS file:', err);
      setError(
        err instanceof Error
          ? `שגיאה בטעינת הקובץ: ${err.message}`
          : 'שגיאה לא ידועה בטעינת הקובץ'
      );
    } finally {
      setLoading(false);
    }
  };

  // Load municipalities when file is selected (for pre-filtering)
  const handleLoadMunicipalities = async () => {
    if (municipalities.length > 0) return; // Already loaded

    setLoading(true);
    setError('');

    try {
      const geojson = await loadLamasFile(selectedFileId, externalUrl || undefined);
      const uniqueMunicipalities = getUniqueMunicipalities(geojson);
      setMunicipalities(uniqueMunicipalities);
    } catch (err) {
      console.error('Error loading municipalities:', err);
      setError('שגיאה בטעינת רשימת הרשויות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">טעינת נתוני LAMAS</h3>

      {/* File selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          בחר קובץ
        </label>
        <select
          value={selectedFileId}
          onChange={(e) => setSelectedFileId(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          {AVAILABLE_LAMAS_FILES.map(file => (
            <option key={file.id} value={file.id}>
              {file.name} ({file.year})
            </option>
          ))}
        </select>
        {AVAILABLE_LAMAS_FILES.find(f => f.id === selectedFileId)?.description && (
          <p className="text-sm text-gray-500 mt-1">
            {AVAILABLE_LAMAS_FILES.find(f => f.id === selectedFileId)?.description}
          </p>
        )}
      </div>

      {/* External URL (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          כתובת URL חיצונית (אופציונלי)
        </label>
        <input
          type="text"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://..."
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-1">
          אם לא מוזן, הקובץ ייטען מהתיקייה המקומית
        </p>
      </div>

      {/* Municipality filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          סינון לפי רשות
        </label>
        <div className="flex gap-2">
          <select
            value={selectedMunicipality}
            onChange={(e) => setSelectedMunicipality(e.target.value)}
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading || municipalities.length === 0}
          >
            <option value="">כל הרשויות</option>
            {municipalities.map(municipality => (
              <option key={municipality} value={municipality}>
                {municipality}
              </option>
            ))}
          </select>
          {municipalities.length === 0 && (
            <button
              onClick={handleLoadMunicipalities}
              disabled={loading}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              טען רשימה
            </button>
          )}
        </div>
      </div>

      {/* Load button */}
      <button
        onClick={handleLoadFile}
        disabled={loading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {loading ? 'טוען...' : 'טען נתונים'}
      </button>

      {/* Success message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
};
