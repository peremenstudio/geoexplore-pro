import React, { useMemo, useState } from 'react';
import { Layer } from '../types';
import { Search, ChevronLeft, ChevronRight, FileText, Download, Merge, AlertTriangle, X, Upload, Loader2 } from 'lucide-react';

interface DataExplorerProps {
  layers: Layer[];
  onMergeLayers: (destinationId: string, sourceId: string) => number;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, name: string) => void;
  isLoading: boolean;
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ layers, onMergeLayers, onFileUpload, isLoading }) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string>(layers.length > 0 ? layers[0].id : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Merge State
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string>('');
  const [mergeResult, setMergeResult] = useState<{ deletedCount: number } | null>(null);

  const selectedLayer = layers.find(l => l.id === selectedLayerId);

  // Flatten features into table rows
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
          const row: any = { id: index, ...f.properties };
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

  // Sync selected layer if it gets deleted
  React.useEffect(() => {
      if (!layers.find(l => l.id === selectedLayerId) && layers.length > 0) {
          setSelectedLayerId(layers[0].id);
      }
  }, [layers, selectedLayerId]);

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
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
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
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
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
                                            {row[header] !== undefined && row[header] !== null ? String(row[header]) : '-'}
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
    </div>
  );
};