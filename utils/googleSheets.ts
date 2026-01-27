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
  
  // Common latitude column names (ordered by priority)
  const latPatterns = ['latitude', 'lat', 'y', 'north', 'широта'];
  // Common longitude column names (ordered by priority)
  const lngPatterns = ['longitude', 'lng', 'lon', 'x', 'east', 'долгота'];

  let latCol = -1;
  let lngCol = -1;
  let latScore = -1;
  let lngScore = -1;

  for (let i = 0; i < lowerHeaders.length; i++) {
    const header = lowerHeaders[i];
    
    // Match latitude with priority
    for (let j = 0; j < latPatterns.length; j++) {
      if (header.includes(latPatterns[j])) {
        if (j > latScore) {
          latCol = i;
          latScore = j;
        }
        break;
      }
    }
    
    // Match longitude with priority
    for (let j = 0; j < lngPatterns.length; j++) {
      if (header.includes(lngPatterns[j])) {
        if (j > lngScore) {
          lngCol = i;
          lngScore = j;
        }
        break;
      }
    }
  }

  console.log('Sheet headers found:', headers);
  console.log('Detected lat column index:', latCol, 'lng column index:', lngCol);
  
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
 * Fetches sheet headers and preview data
 * @param sheetUrl - Google Sheets URL or ID
 * @param gid - Sheet tab ID (default 0 for first sheet)
 * @returns Headers array and preview rows
 */
export async function fetchSheetHeaders(
  sheetUrl: string,
  gid: string = '0'
): Promise<{ headers: string[]; rows: string[][] }> {
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

    if (rows.length === 0) {
      throw new Error('Sheet is empty');
    }

    return { headers: rows[0], rows };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch sheet headers');
  }
}

/**
 * Fetches and processes Google Sheets data
 * @param sheetUrl - Google Sheets URL or ID
 * @param latCol - Index of latitude column
 * @param lngCol - Index of longitude column
 * @param gid - Sheet tab ID (default 0 for first sheet)
 * @returns GeoJSON FeatureCollection
 */
export async function fetchGoogleSheetGeoJSON(
  sheetUrl: string,
  latCol: number,
  lngCol: number,
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

    return convertToGeoJSON(rows, { lat: latCol, lng: lngCol });
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
