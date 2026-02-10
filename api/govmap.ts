import type { IncomingMessage, ServerResponse } from 'http';

// Get API key from environment - works on both Vercel and local dev
const GOVMAP_API_TOKEN = process.env.GOVMAP_API_TOKEN || '';

console.log('[API] GOVMAP_API_TOKEN configured:', !!GOVMAP_API_TOKEN);

const GOVMAP_BASE_URL = 'https://www.govmap.gov.il';

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, {});
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseBody(req);
    const { action, layerId, bounds } = body;

    if (!GOVMAP_API_TOKEN) {
      sendJson(res, 500, { 
        error: 'GovMap API token not configured',
        message: 'Please set GOVMAP_API_TOKEN environment variable'
      });
      return;
    }

    // Test connection
    if (action === 'test') {
      sendJson(res, 200, { 
        success: true,
        message: 'GovMap API proxy is working',
        tokenConfigured: true
      });
      return;
    }

    // Fetch layer data
    if (action === 'fetchLayer') {
      if (!layerId) {
        sendJson(res, 400, { error: 'Layer ID is required' });
        return;
      }

      // Build GovMap API query URL
      // Using WFS (Web Feature Service) to get GeoJSON data
      const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAME: `gm:layer_${layerId}`,
        OUTPUTFORMAT: 'application/json',
        SRSNAME: 'EPSG:4326', // WGS84 (lat/lng)
        token: GOVMAP_API_TOKEN
      });

      // Add bounds filter if provided
      if (bounds && Array.isArray(bounds) && bounds.length === 4) {
        const bbox = `${bounds[0]},${bounds[1]},${bounds[2]},${bounds[3]},EPSG:4326`;
        params.append('BBOX', bbox);
      }

      const wfsUrl = `${GOVMAP_BASE_URL}/wfs?${params.toString()}`;

      console.log('[GovMap API] Fetching:', wfsUrl.replace(GOVMAP_API_TOKEN, '***'));

      const response = await fetch(wfsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GovMap API] Error:', response.status, errorText);
        sendJson(res, response.status, { 
          error: 'Failed to fetch from GovMap',
          status: response.status,
          details: errorText
        });
        return;
      }

      const data = await response.json();
      
      // Convert to standard GeoJSON if needed
      const geojson = {
        type: 'FeatureCollection',
        features: data.features || []
      };

      console.log(`[GovMap API] Success: Fetched ${geojson.features.length} features from layer ${layerId}`);

      sendJson(res, 200, {
        success: true,
        data: geojson,
        featureCount: geojson.features.length
      });
      return;
    }

    sendJson(res, 400, { error: 'Invalid action. Use "test" or "fetchLayer"' });
  } catch (error: any) {
    console.error('[GovMap API] Error:', error);
    sendJson(res, 500, { 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
