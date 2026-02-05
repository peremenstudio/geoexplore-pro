import shp from 'shpjs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import toGeoJSON from '@mapbox/togeojson';
import { FeatureCollection } from 'geojson';

// Helper to convert arbitrary JSON to GeoJSON if it has X/Y properties
const convertXYToGeoJSON = (json: any): FeatureCollection => {
  // If it's already GeoJSON
  if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
    return json as FeatureCollection;
  }

  // If it's a simple array of objects
  const features = Array.isArray(json) ? json : (json.features || []);
  
  if (features.length === 0) {
      return { type: 'FeatureCollection', features: [] };
  }

  // Try to find x/y or lat/lng fields
  const sample = features[0].properties || features[0];
  const keys = Object.keys(sample).map(k => k.toLowerCase());
  
  // Expanded search terms
  const xKey = Object.keys(sample).find(k => ['x', 'lng', 'longitude', 'long', 'lon'].includes(k.toLowerCase()));
  const yKey = Object.keys(sample).find(k => ['y', 'lat', 'latitude'].includes(k.toLowerCase()));

  if (!xKey || !yKey) {
      return { type: 'FeatureCollection', features: [] };
  }

  const convertedFeatures = features.map((item: any) => {
     const props = item.properties || item;
     const x = parseFloat(props[xKey]);
     const y = parseFloat(props[yKey]);
     
     if (isNaN(x) || isNaN(y)) return null;

     return {
         type: 'Feature',
         geometry: {
             type: 'Point',
             coordinates: [x, y]
         },
         properties: props
     };
  }).filter((f: any) => f !== null);

  return {
      type: 'FeatureCollection',
      features: convertedFeatures as any
  };
};

// Helper to format date columns (Excel serial dates to ISO string)
const formatDateColumns = (geojson: FeatureCollection): FeatureCollection => {
  const excelDateToISO = (value: any): any => {
    // Only process numbers that look like Excel serial dates
    if (typeof value !== 'number' || value <= 0 || value >= 100000) {
      return value;
    }
    
    // Excel serial date: days since Dec 30, 1899
    const date = new Date((value - 25569) * 86400000);
    
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    return value;
  };

  return {
    ...geojson,
    features: geojson.features.map(feature => ({
      ...feature,
      properties: feature.properties ? Object.entries(feature.properties).reduce((acc, [key, val]) => {
        // Check if column name contains DEALDATE
        if (key.toUpperCase().includes('DEALDATE')) {
          acc[key] = excelDateToISO(val);
        } else {
          acc[key] = val;
        }
        return acc;
      }, {} as any) : {}
    }))
  };
};

// Helper to sanitize ZIP buffers by trimming junk after the End of Central Directory (EOCD) record
const fixZipBuffer = (buffer: ArrayBuffer): ArrayBuffer => {
    try {
        const view = new DataView(buffer);
        const len = view.byteLength;
        // EOCD signature is 0x06054b50 (little endian)
        // Min size of EOCD is 22 bytes. Max comment length is 65535.
        // We scan backwards from the end of the file.
        const maxScan = Math.min(len, 65535 + 22);
        
        for (let i = len - 22; i >= len - maxScan && i >= 0; i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                // Found potential EOCD signature
                const commentLen = view.getUint16(i + 20, true);
                const expectedSize = i + 22 + commentLen;
                
                if (expectedSize <= len) {
                    // Valid EOCD found.
                    if (expectedSize < len) {
                        console.warn(`Repaired ZIP: Trimmed ${len - expectedSize} bytes of junk data.`);
                        return buffer.slice(0, expectedSize);
                    }
                    // Exact match, no junk
                    return buffer;
                }
            }
        }
    } catch (e) {
        console.warn("Failed to check/repair ZIP buffer:", e);
    }
    return buffer;
};

export const processFile = async (file: File): Promise<FeatureCollection> => {
    const fileName = file.name.toLowerCase();

    // 1. ZIP Handling
    if (fileName.endsWith('.zip')) {
        let arrayBuffer = await file.arrayBuffer();
        
        // Fix "Junk found after end of compressed data" errors
        arrayBuffer = fixZipBuffer(arrayBuffer);
        
        // Load ZIP using JSZip
        let zip;
        try {
            zip = await JSZip.loadAsync(arrayBuffer);
        } catch(e) {
            throw new Error("Failed to read ZIP file. It might be corrupted or invalid.");
        }
        
        const fileNames = Object.keys(zip.files);

        // A. Prefer Shapefile if present (.shp)
        const shpFilePath = fileNames.find(f => f.toLowerCase().endsWith('.shp'));
        if (shpFilePath) {
            try {
                // Manual extraction avoids parsing errors in shpjs for some zips
                
                const basePath = shpFilePath.substring(0, shpFilePath.lastIndexOf('.'));
                
                // Find sibling files (case-insensitive)
                const dbfFilePath = fileNames.find(f => 
                    f.substring(0, f.lastIndexOf('.')).toLowerCase() === basePath.toLowerCase() && 
                    f.toLowerCase().endsWith('.dbf')
                );
                const prjFilePath = fileNames.find(f => 
                    f.substring(0, f.lastIndexOf('.')).toLowerCase() === basePath.toLowerCase() && 
                    f.toLowerCase().endsWith('.prj')
                );

                // Extract buffers
                const shpBuffer = await zip.files[shpFilePath].async('arraybuffer');
                
                // Parse Projection
                let prjStr;
                if (prjFilePath) {
                    prjStr = await zip.files[prjFilePath].async('string');
                }

                // Parse SHP
                // @ts-ignore: shpjs types vary
                const geometries = shp.parseShp(shpBuffer, prjStr);

                // Parse DBF
                let properties = [];
                if (dbfFilePath) {
                    const dbfBuffer = await zip.files[dbfFilePath].async('arraybuffer');
                    // @ts-ignore
                    properties = shp.parseDbf(dbfBuffer);
                }

                // Combine
                // @ts-ignore
                const combined = shp.combine([geometries, properties]);
                return combined;

            } catch (err) {
                console.warn("Manual SHP parsing failed, attempting fallback:", err);
                // Last resort: Try standard shpjs zip parsing with the fixed buffer
                const result = await shp(arrayBuffer);
                if (Array.isArray(result)) {
                    return result[0];
                }
                return result;
            }
        }

        // B. Fallback to KML if present (.kml)
        const kmlFile = fileNames.find(f => f.toLowerCase().endsWith('.kml'));
        if (kmlFile) {
            const kmlText = await zip.files[kmlFile].async('string');
            const parser = new DOMParser();
            const kmlDom = parser.parseFromString(kmlText, 'text/xml');
            // @ts-ignore
            return toGeoJSON.kml(kmlDom) as FeatureCollection;
        }

        // C. Fallback to Excel (.xlsx, .xls)
        const xlsFile = fileNames.find(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'));
        if (xlsFile) {
            const xlsData = await zip.files[xlsFile].async('arraybuffer');
            const workbook = XLSX.read(xlsData, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            return convertXYToGeoJSON(json);
        }

        // D. Fallback to CSV (.csv) inside ZIP
        const csvFile = fileNames.find(f => f.toLowerCase().endsWith('.csv'));
        if (csvFile) {
             const csvText = await zip.files[csvFile].async('string');
             const workbook = XLSX.read(csvText, { type: 'string' });
             const sheetName = workbook.SheetNames[0];
             const worksheet = workbook.Sheets[sheetName];
             const json = XLSX.utils.sheet_to_json(worksheet);
             const geojson = convertXYToGeoJSON(json);
             return formatDateColumns(geojson);
        }

        throw new Error('No supported geospatial files (.shp, .kml, .xlsx, .csv) found inside the zip.');
    } 
    
    // 2. Direct Shapefile (Limited browser support without .dbf, handled by shpjs best effort)
    if (fileName.endsWith('.shp')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await shp(arrayBuffer);
         if (Array.isArray(result)) {
            return result[0];
        }
        return result;
    }

    // 3. Direct KML
    if (fileName.endsWith('.kml')) {
        const text = await file.text();
        const parser = new DOMParser();
        const kmlDom = parser.parseFromString(text, 'text/xml');
        // @ts-ignore
        return toGeoJSON.kml(kmlDom) as FeatureCollection;
    }

    // 4. Direct Excel
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        return convertXYToGeoJSON(json);
    }

    // 5. Direct CSV
    if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        const geojson = convertXYToGeoJSON(json);
        return formatDateColumns(geojson);
    }

    // 6. Direct GeoJSON/JSON
    if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        return convertXYToGeoJSON(json);
    }

    throw new Error('Unsupported file type');
};