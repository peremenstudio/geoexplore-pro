import { Feature, FeatureCollection } from 'geojson';

interface SheetData {
  values: string[][];
}

/**
 * Extracts Google Sheet ID from various URL formats
 */
function extractSheetId(url: string): string {
  // Match Google Sheets URL patterns
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/, // Standard format
    /[?&]id=([a-zA-Z0-9-_]+)/, // ID parameter
    /^([a-zA-Z0-9-_]+)$/ // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new Error('Invalid Google Sheets URL');
}

/**
 * Detects coordinate columns in sheet headers
 */
function findCoordinateColumns(headers: string[]): { lat: number; lng: number } | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  // Common latitude column names
  const latPatterns = ['lat', 'latitude', 'y', 'north'];
  // Common longitude column names
  const lngPatterns = ['lng', 'lon', 'longitude', 'x', 'east'];

  let latCol = -1;
  let lngCol = -1;

  for (let i = 0; i < lowerHeaders.length; i++) {
    const header = lowerHeaders[i];
    
    if (latPatterns.some(p => header.includes(p))) {
      latCol = i;
    }
    if (lngPatterns.some(p => header.includes(p))) {
      lngCol = i;
    }
  }

  if (latCol !== -1 && lngCol !== -1) {
    return { lat: latCol, lng: lngCol };
  }

  return null;
}

/**
 * Parses CSV content from Google Sheets export
 */
function parseCSV(csv: string): string[][] {
  const lines = csv.split('\n').filter(line => line.trim());
  const rows: string[][] = [];

  for (const line of lines) {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      row.push(current.trim());
    }

    if (row.some(cell => cell)) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Converts Google Sheets data to GeoJSON
 */
function convertToGeoJSON(
  rows: string[][],
  coordCols: { lat: number; lng: number }
): FeatureCollection {
  if (rows.length < 2) {
    throw new Error('Sheet must contain headers and at least one data row');
  }

  const headers = rows[0];
  const features: Feature[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    const latStr = row[coordCols.lat]?.trim();
    const lngStr = row[coordCols.lng]?.trim();

    if (!latStr || !lngStr) continue;

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) continue;

    // Build properties from other columns
    const properties: Record<string, any> = {};
    headers.forEach((header, idx) => {
      if (idx !== coordCols.lat && idx !== coordCols.lng) {
        properties[header] = row[idx] || '';
      }
    });

    const feature: Feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties
    };

    features.push(feature);
  }

  if (features.length === 0) {
    throw new Error('No valid coordinates found in sheet');
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Fetches and processes Google Sheets data
 * @param sheetUrl - Google Sheets URL or ID
 * @param gid - Sheet tab ID (default 0 for first sheet)
 * @returns GeoJSON FeatureCollection
 */
export async function fetchGoogleSheetGeoJSON(
  sheetUrl: string,
  gid: string = '0'
): Promise<FeatureCollection> {
  try {
    const sheetId = extractSheetId(sheetUrl);
    
    // Export sheet as CSV
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }

    const csv = await response.text();
    const rows = parseCSV(csv);

    const coordCols = findCoordinateColumns(rows[0]);
    if (!coordCols) {
      throw new Error('Could not find latitude/longitude columns. Expected headers like "latitude", "longitude" or "lat", "lng"');
    }

    return convertToGeoJSON(rows, coordCols);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to process Google Sheet');
  }
}

/**
 * Validates a Google Sheets URL or ID
 */
export function isValidSheetUrl(url: string): boolean {
  try {
    extractSheetId(url);
    return true;
  } catch {
    return false;
  }
}
