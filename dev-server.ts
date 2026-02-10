import http from 'http';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
function loadEnv(): Record<string, string> {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    console.log(`📂 Reading env from: ${envPath}`);
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          const cleanKey = key.trim();
          const cleanValue = valueParts.join('=').trim();
          env[cleanKey] = cleanValue;
          if (cleanKey === 'GOOGLE_PLACES_API' || cleanKey === 'GOVMAP_API_TOKEN') {
            console.log(`✓ Loaded ${cleanKey}: ${cleanValue.substring(0, 20)}...`);
          }
        }
      }
    });
    
    return env;
  } catch (error) {
    console.error('❌ Error loading .env.local:', error);
    return {};
  }
}

const env = loadEnv();
const GOOGLE_PLACES_API_KEY = env.GOOGLE_PLACES_API || '';
const GOVMAP_API_TOKEN = env.GOVMAP_API_TOKEN || '';

const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const GOVMAP_BASE_URL = 'https://www.govmap.gov.il';

function sendJson(res: http.ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

async function parseBody(req: http.IncomingMessage): Promise<any> {
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

const server = http.createServer(async (req, res) => {
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

  // Route to appropriate handler based on URL
  const url = req.url || '';
  
  if (url.includes('govmap') || url === '/govmap') {
    await handleGovMapRequest(req, res);
  } else {
    await handleGooglePlacesRequest(req, res);
  }
});

// Google Places request handler
async function handleGooglePlacesRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (!GOOGLE_PLACES_API_KEY) {
    sendJson(res, 500, { error: 'Google Places API key not configured' });
    return;
  }

  try {
    // Parse request body
    const body = await parseBody(req);
    const { action, params } = body;

    if (action === 'nearby') {
      // Fetch nearby places
      const { lat, lng, radius, type } = params;

      if (!lat || !lng || !radius || !type) {
        sendJson(res, 400, { error: 'Missing required parameters: lat, lng, radius, type' });
        return;
      }

      console.log(`[Google Places] Fetching nearby ${type} at ${lat}, ${lng} with radius ${radius}m`);

      const url = `${PLACES_API_URL}?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_PLACES_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('[Google Places] API error:', error);
        sendJson(res, response.status, {
          error: `Google Places API error: ${error.error_message || response.statusText}`
        });
        return;
      }

      const data = await response.json();
      console.log(`[Google Places] Found ${data.results?.length || 0} results`);
      sendJson(res, 200, data);
    } else if (action === 'details') {
      // Fetch place details
      const { placeId } = params;

      if (!placeId) {
        sendJson(res, 400, { error: 'Missing required parameter: placeId' });
        return;
      }

      console.log(`[Google Places] Fetching details for place ${placeId}`);

      const url = `${DETAILS_API_URL}?place_id=${placeId}&key=${GOOGLE_PLACES_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('[Google Places] Details API error:', error);
        sendJson(res, response.status, {
          error: `Google Places API error: ${error.error_message || response.statusText}`
        });
        return;
      }

      const data = await response.json();
      sendJson(res, 200, data);
    } else {
      sendJson(res, 400, { error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[Google Places] Server error:', error);
    sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
}

// GovMap request handler
async function handleGovMapRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = await parseBody(req);
    const { action, layerId, bounds } = body;

    if (!GOVMAP_API_TOKEN) {
      sendJson(res, 500, { 
        error: 'GovMap API token not configured',
        message: 'Please set GOVMAP_API_TOKEN in .env.local'
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

      // Build GovMap WFS query URL
      const params = new URLSearchParams({
        SERVICE: 'WFS',
        VERSION: '2.0.0',
        REQUEST: 'GetFeature',
        TYPENAME: `gm:layer_${layerId}`,
        OUTPUTFORMAT: 'application/json',
        SRSNAME: 'EPSG:4326',
        token: GOVMAP_API_TOKEN
      });

      // Add bounds filter if provided
      if (bounds && Array.isArray(bounds) && bounds.length === 4) {
        const bbox = `${bounds[0]},${bounds[1]},${bounds[2]},${bounds[3]},EPSG:4326`;
        params.append('BBOX', bbox);
      }

      const wfsUrl = `${GOVMAP_BASE_URL}/wfs?${params.toString()}`;
      console.log(`[GovMap] Fetching layer ${layerId}...`);

      const response = await fetch(wfsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GovMap] Error: ${response.status}`, errorText);
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

      console.log(`[GovMap] Success: Fetched ${geojson.features.length} features from layer ${layerId}`);

      sendJson(res, 200, {
        success: true,
        data: geojson,
        featureCount: geojson.features.length
      });
      return;
    }

    sendJson(res, 400, { error: 'Invalid action. Use "test" or "fetchLayer"' });
  } catch (error: any) {
    console.error('[GovMap] Error:', error);
    sendJson(res, 500, { 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ API Proxy Server running on http://localhost:${PORT}`);
  console.log(`📍 Make sure Vite is also running: npm run dev`);
  console.log(`🔑 Google Places API Key: ${GOOGLE_PLACES_API_KEY ? '✓ Yes' : '✗ No (check .env.local)'}`);
  console.log(`🔑 GovMap API Token: ${GOVMAP_API_TOKEN ? '✓ Yes' : '✗ No (check .env.local)'}\n`);
});
