import React, { useMemo, useState } from 'react';
import { Layer } from '../types';
import { Search, ChevronLeft, ChevronRight, FileText, Download, Merge, AlertTriangle, X, Upload, Loader2, Link2, Edit } from 'lucide-react';
import { fetchGoogleSheetGeoJSON, fetchSheetHeaders, isValidSheetUrl } from '../utils/googleSheets';
import { getNextLayerColor } from '../utils/layerColors';

interface DataExplorerProps {
  layers: Layer[];
  onMergeLayers: (destinationId: string, sourceId: string) => number;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, name: string) => void;
  isLoading: boolean;
  onAddLayer?: (layer: Layer) => void;
  onUpdateFeature?: (layerId: string, featureIndex: number, newProperties: any) => void;
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ layers, onMergeLayers, onFileUpload, isLoading, onAddLayer, onUpdateFeature }) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string>(layers.length > 0 ? layers[0].id : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedData, setEditedData] = useState<Record<number, any>>({});

  // Helper function to format date columns
  const formatDateValue = (value: any, columnName: string): string => {
    if (value === undefined || value === null) return '-';
    if (!columnName.toUpperCase().includes('DEALDATE')) return String(value);
    
    let date: Date | null = null;
    
    // If it's a number, try Excel serial date format first (most common for CSV from Excel)
    if (typeof value === 'number') {
      // Excel serial date: days since Dec 30, 1899
      // Convert to JavaScript timestamp
      if (value > 0 && value < 100000) {
        // Likely an Excel serial date
        date = new Date((value - 25569) * 86400000);
      }
      // If not a valid date from Excel format, try as timestamp
      if (!date || isNaN(date.getTime())) {
        const asMs = new Date(value);
        const asSec = new Date(value * 1000);
        const now = Date.now();
        if (Math.abs(now - asMs.getTime()) < Math.abs(now - asSec.getTime())) {
          date = asMs;
        } else {
          date = asSec;
        }
      }
    } else if (typeof value === 'string') {
      // Try YYYYMMDD format
      if (/^\d{8}$/.test(value)) {
        const year = parseInt(value.substring(0, 4));
        const month = parseInt(value.substring(4, 6));
        const day = parseInt(value.substring(6, 8));
        date = new Date(year, month - 1, day);
      }
      // Try standard date parsing
      else {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
    }
    
    if (date && !isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    }
    
    return String(value);
  };

  // Merge State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string>('');
  const [mergeResult, setMergeResult] = useState<{ deletedCount: number } | null>(null);

  // Google Sheets State
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
    const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
    const [selectedLatCol, setSelectedLatCol] = useState<number>(-1);
    const [selectedLngCol, setSelectedLngCol] = useState<number>(-1);

  // Get the selected layer
  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  const tableData = useMemo(() => {
      if (!selectedLayer) return { headers: [], rows: [] };

      const features = selectedLayer.data.features;
      if (features.length === 0) return { headers: [], rows: [] };

      // Collect all unique keys from all features for headers
      const allKeys = new Set<string>();
      features.forEach(f => {
          if (f.properties) {
              Object.keys(f.properties).forEach(k => allKeys.add(k));
          }
      });
      // Add geometry columns
      allKeys.add('geometry_type');
      allKeys.add('coordinates');

      const headers = Array.from(allKeys);

      const rows = features.map((f, index) => {
          const row: any = { ...f.properties };
          row.id = index;  // Always use feature index as row.id (must come after spread to not be overwritten)
          row.geometry_type = f.geometry.type;
          
          if (f.geometry.type === 'Point') {
              row.coordinates = `${f.geometry.coordinates[0].toFixed(5)}, ${f.geometry.coordinates[1].toFixed(5)}`;
          } else {
              row.coordinates = '...';
          }
          return row;
      });

      return { headers, rows };
  }, [selectedLayer]);

  // Filter and Pagination
  const filteredRows = useMemo(() => {
      if (!searchTerm) return tableData.rows;
      const lower = searchTerm.toLowerCase();
      return tableData.rows.filter(row => 
          Object.values(row).some(val => String(val).toLowerCase().includes(lower))
      );
  }, [tableData, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);
  const currentRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset pagination on layer change or search
  React.useEffect(() => {
      setCurrentPage(1);
  }, [selectedLayerId, searchTerm]);

  // Reset edit mode when changing layers
  React.useEffect(() => {
      setIsEditMode(false);
      setEditedData({});
  }, [selectedLayerId]);

  // Sync selected layer if it gets deleted
  React.useEffect(() => {
      if (!layers.find(l => l.id === selectedLayerId) && layers.length > 0) {
          setSelectedLayerId(layers[0].id);
      }
  }, [layers, selectedLayerId]);

  // Detect column type for smart input rendering
  const getColumnType = (header: string, values: any[]) => {
    if (header.toLowerCase() === 'priority') {
      return { type: 'priority', options: ['None', 'Urgent', 'Normal', 'Low'] };
    }
    
    // Check if it's a date column
    if (header.toLowerCase().includes('date') || header.toLowerCase().includes('time')) {
      return { type: 'date' };
    }
    
    // Check for columns with limited unique values
    // Must have at least 3 occurrences of at least one value, and up to 6 unique values total
    const nonEmptyValues = values.filter(v => v !== undefined && v !== null && v !== '');
    const valueCounts = new Map<string, number>();
    
    nonEmptyValues.forEach(v => {
      const key = String(v);
      valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
    });
    
    // Check if any value appears at least 3 times
    const hasFrequentValue = Array.from(valueCounts.values()).some(count => count >= 3);
    const uniqueValues = Array.from(valueCounts.keys());
    
    if (hasFrequentValue && uniqueValues.length > 0 && uniqueValues.length <= 6) {
      return { type: 'select', options: [...uniqueValues, 'Other'] };
    }
    
    return { type: 'text' };
  };

  const handleCellChange = (rowId: number, header: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [header]: value
      }
    }));
  };

  const getCellValue = (row: any, header: string) => {
    if (editedData[row.id]?.[header] !== undefined) {
      return editedData[row.id][header];
    }
    return row[header];
  };

  const renderEditableCell = (row: any, header: string) => {
    const value = getCellValue(row, header);
    const allColumnValues = tableData.rows.map(r => r[header]);
    const columnInfo = getColumnType(header, allColumnValues);
    
    // Don't allow editing geometry columns
    if (header === 'geometry_type' || header === 'coordinates') {
      return <span className="text-slate-400">{value !== undefined && value !== null ? String(value) : '-'}</span>;
    }

    if (columnInfo.type === 'priority') {
      return (
        <select
          value={value || 'None'}
          onChange={(e) => handleCellChange(row.id, header, e.target.value)}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        >
          {columnInfo.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (columnInfo.type === 'date') {
      return (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => handleCellChange(row.id, header, e.target.value)}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
      );
    }

    if (columnInfo.type === 'select') {
      return (
        <select
          value={value || ''}
          onChange={(e) => handleCellChange(row.id, header, e.target.value)}
          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
        >
          <option value="">-</option>
          {columnInfo.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={(e) => handleCellChange(row.id, header, e.target.value)}
        className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
      />
    );
  };

  const handleExportCSV = () => {
    if (!selectedLayer) return;

    const { headers, rows } = tableData;
    if (rows.length === 0) {
        alert("No data to export");
        return;
    }

    // Create CSV content
    const csvContent = [
        headers.join(','), // Header row
        ...rows.map(row => {
            return headers.map(header => {
                const val = row[header];
                const stringVal = val === undefined || val === null ? '' : String(val);
                // Escape quotes and wrap in quotes if necessary
                if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
                    return `"${stringVal.replace(/"/g, '""')}"`;
                }
                return stringVal;
            }).join(',');
        })
    ].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedLayer.name || 'data'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMergeClick = () => {
    setIsMergeModalOpen(true);
    // Select first available source that isn't the current one
    const firstOption = layers.find(l => l.id !== selectedLayerId);
    if (firstOption) setMergeSourceId(firstOption.id);
  };

  const handleFetchHeaders = async () => {
    if (!sheetUrl.trim()) {
      setSheetError('Please enter a Google Sheets URL or ID');
      return;
    }

    if (!isValidSheetUrl(sheetUrl)) {
      setSheetError('Invalid Google Sheets URL');
      return;
    }

    setIsLoadingSheet(true);
    setSheetError(null);

    try {
      const { headers } = await fetchSheetHeaders(sheetUrl);
      setSheetHeaders(headers);
      
      // Try to auto-detect lat/lng columns
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());
      const latIdx = lowerHeaders.findIndex(h => h.includes('lat'));
      const lngIdx = lowerHeaders.findIndex(h => h.includes('lon') || h.includes('lng'));
      
      setSelectedLatCol(latIdx >= 0 ? latIdx : -1);
      setSelectedLngCol(lngIdx >= 0 ? lngIdx : -1);
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Failed to fetch sheet headers');
      setSheetHeaders([]);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleLoadGoogleSheet = async () => {
    if (selectedLatCol === -1 || selectedLngCol === -1) {
      setSheetError('Please select both latitude and longitude columns');
      return;
    }

    setIsLoadingSheet(true);
    setSheetError(null);

    try {
      const geojson = await fetchGoogleSheetGeoJSON(sheetUrl, selectedLatCol, selectedLngCol);
      
      if (!onAddLayer) {
        throw new Error('Layer addition not supported');
      }

      const newLayer: Layer = {
        id: `sheet-${Date.now()}`,
        name: `Google Sheet ${new Date().toLocaleString()}`,
        data: geojson,
        visible: true,
                color: getNextLayerColor(),
        opacity: 0.7,
        type: 'point',
        grid: {
          show: false,
          showLabels: false,
          size: 10,
          opacity: 0.3
        }
      };

      onAddLayer(newLayer);
      setIsSheetModalOpen(false);
      setSheetUrl('');
      setSheetHeaders([]);
      setSelectedLatCol(-1);
      setSelectedLngCol(-1);
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : 'Failed to load sheet');
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleLoadGoogleSheetOLD = async () => {
    if (!sheetUrl.trim()) {
      setSheetError('Please enter a Google Sheets URL or ID');
      return;
    }

    if (!isValidSheetUrl(sheetUrl)) {
      setSheetError('Invalid Google Sheets URL');
      return;
    }

    setIsLoadingSheet(true);
    setSheetError(null);

    try {
      const geojson = await fetchGoogleSheetGeoJSON(sheetUrl, 0, 1);
      
      const newLayer: Layer = {
        id: `sheet-${Date.now()}`,
        name: `Google Sheet (${geojson.features.length} points)`,
        visible: true,
        data: geojson,
                color: getNextLayerColor(),
        opacity: 0.7,
        type: 'point',
        grid: { show: false, showLabels: false, size: 0.5, opacity: 0.5 },
        lastUpdated: Date.now()
      };

      if (onAddLayer) {
        onAddLayer(newLayer);
      }

      setSheetUrl('');
      setIsSheetModalOpen(false);
    } catch (error: any) {
      setSheetError(error.message || 'Failed to load Google Sheet');
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const executeMerge = () => {
    if (!selectedLayerId || !mergeSourceId) return;
    const deleted = onMergeLayers(selectedLayerId, mergeSourceId);
    setIsMergeModalOpen(false);
    
    if (deleted > 0) {
      setMergeResult({ deletedCount: deleted });
    }
  };

  if (layers.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 relative">
              <div className="bg-slate-100 p-6 rounded-full mb-4">
                  <FileText size={48} className="opacity-50 text-slate-500" />
              </div>
              <p className="mb-4 font-medium">No data available.</p>
              
              <div className="relative">
                    <input 
                        type="file" 
                        id="empty-state-upload" 
                        className="hidden" 
                        accept=".geojson,.json,.shp,.zip,.csv,.xlsx,.xls"
                        onChange={(e) => onFileUpload(e, '')}
                        disabled={isLoading}
                    />
                    <label 
                        htmlFor="empty-state-upload" 
                        className="flex items-center gap-2 px-5 py-2.5 bg-coral-600 text-white rounded-lg font-semibold hover:bg-coral-700 cursor-pointer shadow-md transition-all"
                    >
                         {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                         Upload File
                    </label>
              </div>

              <div className="text-slate-400 my-2">or</div>

              <button
                onClick={() => {
                  setIsSheetModalOpen(true);
                  setSheetError(null);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer shadow-md transition-all"
              >
                <Link2 size={18} />
                Link Google Sheet
              </button>

              {/* Google Sheets Modal in empty state */}
              {isSheetModalOpen && (
                  <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 animate-in zoom-in-95 duration-200">
                          <div className="p-6 border-b border-slate-200">
                              <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                      <Link2 size={20} className="text-blue-600" />
                                      Link Google Sheet
                                  </h3>
                                  <button 
                                      onClick={() => {
                                        setIsSheetModalOpen(false);
                                        setSheetUrl('');
                                        setSheetError(null);
                                      }}
                                      className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                                  >
                                      <X size={20} />
                                  </button>
                              </div>
                          </div>

                          <div className="p-6 space-y-4">
                              <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                      Google Sheets URL or ID
                                  </label>
                                  <div className="flex gap-2">
                                      <input
                                          type="text"
                                          value={sheetUrl}
                                          onChange={(e) => {
                                            setSheetUrl(e.target.value);
                                            setSheetError(null);
                                            setSheetHeaders([]);
                                          }}
                                          placeholder="https://docs.google.com/spreadsheets/d/..."
                                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                      />
                                      <button
                                          onClick={handleFetchHeaders}
                                          disabled={isLoadingSheet || !sheetUrl.trim()}
                                          className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center gap-2 whitespace-nowrap"
                                      >
                                          {isLoadingSheet ? (
                                              <Loader2 size={16} className="animate-spin" />
                                          ) : (
                                              'Fetch Columns'
                                          )}
                                      </button>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-2">
                                      The sheet must be publicly accessible (Anyone with link can view).
                                  </p>
                              </div>

                              {sheetHeaders.length > 0 && (
                                  <>
                                      <div>
                                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                                              Latitude Column
                                          </label>
                                          <select
                                              value={selectedLatCol}
                                              onChange={(e) => setSelectedLatCol(Number(e.target.value))}
                                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                          >
                                              <option value={-1}>-- Select Latitude Column --</option>
                                              {sheetHeaders.map((header, idx) => (
                                                  <option key={idx} value={idx}>{header}</option>
                                              ))}
                                          </select>
                                      </div>

                                      <div>
                                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                                              Longitude Column
                                          </label>
                                          <select
                                              value={selectedLngCol}
                                              onChange={(e) => setSelectedLngCol(Number(e.target.value))}
                                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                          >
                                              <option value={-1}>-- Select Longitude Column --</option>
                                              {sheetHeaders.map((header, idx) => (
                                                  <option key={idx} value={idx}>{header}</option>
                                              ))}
                                          </select>
                                      </div>
                                  </>
                              )}

                              {sheetHeaders.length === 0 && (
                                  <div>
                                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                                          Requirements
                                      </label>
                                      <ul className="text-xs text-slate-600 space-y-1">
                                          <li>✓ Sheet must contain latitude and longitude columns</li>
                                          <li>✓ First row should be headers</li>
                                          <li>✓ Share settings: Anyone with link can view</li>
                                      </ul>
                                  </div>
                              )}

                              {sheetError && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                      {sheetError}
                                  </div>
                              )}

                              <div className="flex gap-3 pt-2">
                                  <button 
                                      onClick={() => {
                                        setIsSheetModalOpen(false);
                                        setSheetUrl('');
                                        setSheetError(null);
                                        setSheetHeaders([]);
                                        setSelectedLatCol(-1);
                                        setSelectedLngCol(-1);
                                      }}
                                      className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                                  >
                                      Cancel
                                  </button>
                                  <button 
                                      onClick={handleLoadGoogleSheet}
                                      disabled={isLoadingSheet || sheetHeaders.length === 0 || selectedLatCol === -1 || selectedLngCol === -1}
                                      className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center justify-center gap-2"
                                  >
                                      {isLoadingSheet ? (
                                          <>
                                              <Loader2 size={16} className="animate-spin" />
                                              Loading...
                                          </>
                                      ) : (
                                          <>
                                              <Link2 size={16} />
                                              Link Sheet
                                          </>
                                      )}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
        {/* Google Sheets Modal - Fixed position at root level */}
        {isSheetModalOpen && (
            <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Link2 size={20} className="text-blue-600" />
                                Link Google Sheet
                            </h3>
                            <button 
                                onClick={() => {
                                  setIsSheetModalOpen(false);
                                  setSheetUrl('');
                                  setSheetError(null);
                                }}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Google Sheets URL or ID
                            </label>
                            <input
                                type="text"
                                value={sheetUrl}
                                onChange={(e) => {
                                  setSheetUrl(e.target.value);
                                  setSheetError(null);
                                }}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Paste the sheet URL or just the ID. The sheet must be publicly accessible.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Requirements
                            </label>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li>✓ Sheet must contain &quot;latitude&quot; or &quot;lat&quot; column</li>
                                <li>✓ Sheet must contain &quot;longitude&quot;, &quot;lng&quot;, or &quot;lon&quot; column</li>
                                <li>✓ First row should be headers</li>
                                <li>✓ Share settings: Anyone with link can view</li>
                            </ul>
                        </div>

                        {sheetError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {sheetError}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => {
                                  setIsSheetModalOpen(false);
                                  setSheetUrl('');
                                  setSheetError(null);
                                }}
                                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleLoadGoogleSheet}
                                disabled={isLoadingSheet || !sheetUrl.trim()}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center justify-center gap-2"
                            >
                                {isLoadingSheet ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Link2 size={16} />
                                        Link Sheet
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Toolbar */}
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between z-20">
            <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Active Layer:</label>
                    <select 
                        value={selectedLayerId} 
                        onChange={(e) => setSelectedLayerId(e.target.value)}
                        className="p-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-medium text-slate-700 min-w-[150px] outline-none focus:ring-2 focus:ring-coral-500"
                    >
                        {layers.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                     {/* Import Button */}
                    <div className="relative">
                        <input 
                            type="file" 
                            id="data-view-upload" 
                            className="hidden" 
                            accept=".geojson,.json,.shp,.zip,.csv,.xlsx,.xls"
                            onChange={(e) => onFileUpload(e, '')}
                            disabled={isLoading}
                        />
                        <label 
                            htmlFor="data-view-upload" 
                            className={`flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white border border-emerald-700 rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
                            title="Import File"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                            <span className="hidden sm:inline">Import</span>
                        </label>
                    </div>

                    <button 
                        onClick={() => {
                          setIsSheetModalOpen(true);
                          setSheetError(null);
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white border border-blue-700 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                        title="Link Google Sheet"
                    >
                        <Link2 size={16} />
                        <span className="hidden sm:inline">Link Sheet</span>
                    </button>

                    <button 
                        onClick={() => {
                          if (isEditMode) {
                            // Save changes
                            console.log('Save clicked. EditedData:', editedData);
                            console.log('Selected Layer:', selectedLayer?.id);
                            console.log('onUpdateFeature exists?', !!onUpdateFeature);
                            
                            if (selectedLayer && onUpdateFeature) {
                              Object.entries(editedData).forEach(([rowId, properties]) => {
                                const featureIndex = parseInt(rowId);
                                console.log(`Calling onUpdateFeature for feature ${featureIndex} with:`, properties);
                                onUpdateFeature(selectedLayer.id, featureIndex, properties);
                              });
                            }
                            setEditedData({});
                          }
                          setIsEditMode(!isEditMode);
                        }}
                        disabled={!selectedLayer}
                        className={`flex items-center gap-2 px-3 py-2 ${isEditMode ? 'bg-green-600 border-green-700 hover:bg-green-700' : 'bg-amber-600 border-amber-700 hover:bg-amber-700'} text-white border rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm`}
                        title={isEditMode ? "Save Changes" : "Edit Layer Data"}
                    >
                        <Edit size={16} />
                        <span className="hidden sm:inline">{isEditMode ? 'Save' : 'Edit'}</span>
                    </button>

                    <button 
                        onClick={handleExportCSV}
                        disabled={!selectedLayer}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        title="Export to CSV"
                    >
                        <Download size={16} />
                        <span className="hidden sm:inline">Export CSV</span>
                    </button>

                    <button 
                        onClick={handleMergeClick}
                        disabled={layers.length < 2}
                        className="flex items-center gap-2 px-3 py-2 bg-coral-50 border border-coral-200 text-coral-700 rounded-md text-sm font-medium hover:bg-coral-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:border-slate-300 disabled:text-slate-400 transition-colors shadow-sm"
                        title="Merge with another layer"
                    >
                        <Merge size={16} />
                        <span className="hidden sm:inline">Merge</span>
                    </button>
                </div>
            </div>

            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search attributes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-coral-500 outline-none"
                />
            </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto p-4 z-10">
            <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden min-w-full inline-block align-middle">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            {tableData.headers.map(header => (
                                <th key={header} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {currentRows.length > 0 ? (
                            currentRows.map((row) => (
                                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                    {tableData.headers.map(header => (
                                        <td key={`${row.id}-${header}`} className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 max-w-xs overflow-hidden text-ellipsis">
                                            {isEditMode ? renderEditableCell(row, header) : (
                                                formatDateValue(row[header], header)
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={tableData.headers.length} className="px-6 py-12 text-center text-slate-400">
                                    No features found matching your search.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Footer / Pagination */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between z-20">
            <div className="text-sm text-slate-500">
                Showing {Math.min(filteredRows.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(filteredRows.length, currentPage * itemsPerPage)} of {filteredRows.length} entries
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-slate-700">
                    Page {currentPage} of {Math.max(1, totalPages)}
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>

        {/* Merge Modal */}
        {isMergeModalOpen && (
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Merge size={18} className="text-coral-600" /> Merge Layers
                        </h3>
                        <button onClick={() => setIsMergeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={20} />
                        </button>
                    </div>
                    <div className="p-6">
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-600 mb-2">Target Layer (Destination)</label>
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium">
                                {selectedLayer?.name}
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-600 mb-2">Select Layer to Merge From</label>
                            <select 
                                value={mergeSourceId}
                                onChange={(e) => setMergeSourceId(e.target.value)}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-coral-500"
                            >
                                <option value="" disabled>Select a layer...</option>
                                {layers.filter(l => l.id !== selectedLayerId).map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsMergeModalOpen(false)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeMerge}
                                disabled={!mergeSourceId}
                                className="flex-1 py-2.5 bg-coral-600 text-white rounded-lg font-semibold hover:bg-coral-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            >
                                Merge Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Warning Modal for Duplicates */}
        {mergeResult && (
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                 <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm border-2 border-amber-100 animate-in zoom-in-95 duration-200">
                    <div className="p-6 text-center">
                        <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={24} className="text-amber-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Merge Completed</h3>
                        <p className="text-slate-600 mb-6">
                            The layers have been merged successfully. 
                            <br/>
                            <span className="font-bold text-amber-600">{mergeResult.deletedCount} duplicate rows</span> were detected and removed.
                        </p>
                        <button 
                            onClick={() => setMergeResult(null)}
                            className="w-full py-2.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 shadow-md"
                        >
                            Understood
                        </button>
                    </div>
                 </div>
            </div>
        )}

        {/* Google Sheets Modal in main view */}
        {isSheetModalOpen && (
            <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="p-6 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Link2 size={20} className="text-blue-600" />
                                Link Google Sheet
                            </h3>
                            <button 
                                onClick={() => {
                                  setIsSheetModalOpen(false);
                                  setSheetUrl('');
                                  setSheetError(null);
                                  setSheetHeaders([]);
                                  setSelectedLatCol(-1);
                                  setSelectedLngCol(-1);
                                }}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Google Sheets URL or ID
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={sheetUrl}
                                    onChange={(e) => {
                                      setSheetUrl(e.target.value);
                                      setSheetError(null);
                                      setSheetHeaders([]);
                                    }}
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                />
                                <button
                                    onClick={handleFetchHeaders}
                                    disabled={isLoadingSheet || !sheetUrl.trim()}
                                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center gap-2 whitespace-nowrap"
                                >
                                    {isLoadingSheet ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        'Fetch Columns'
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                The sheet must be publicly accessible (Anyone with link can view).
                            </p>
                        </div>

                        {sheetHeaders.length > 0 && (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Latitude Column
                                    </label>
                                    <select
                                        value={selectedLatCol}
                                        onChange={(e) => setSelectedLatCol(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    >
                                        <option value={-1}>-- Select Latitude Column --</option>
                                        {sheetHeaders.map((header, idx) => (
                                            <option key={idx} value={idx}>{header}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Longitude Column
                                    </label>
                                    <select
                                        value={selectedLngCol}
                                        onChange={(e) => setSelectedLngCol(Number(e.target.value))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    >
                                        <option value={-1}>-- Select Longitude Column --</option>
                                        {sheetHeaders.map((header, idx) => (
                                            <option key={idx} value={idx}>{header}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {sheetHeaders.length === 0 && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Requirements
                                </label>
                                <ul className="text-xs text-slate-600 space-y-1">
                                    <li>✓ Sheet must contain latitude and longitude columns</li>
                                    <li>✓ First row should be headers</li>
                                    <li>✓ Share settings: Anyone with link can view</li>
                                </ul>
                            </div>
                        )}

                        {sheetError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                {sheetError}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => {
                                  setIsSheetModalOpen(false);
                                  setSheetUrl('');
                                  setSheetError(null);
                                  setSheetHeaders([]);
                                  setSelectedLatCol(-1);
                                  setSelectedLngCol(-1);
                                }}
                                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleLoadGoogleSheet}
                                disabled={isLoadingSheet || sheetHeaders.length === 0 || selectedLatCol === -1 || selectedLngCol === -1}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center justify-center gap-2"
                            >
                                {isLoadingSheet ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Link2 size={16} />
                                        Link Sheet
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};