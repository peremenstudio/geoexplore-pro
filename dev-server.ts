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
          if (cleanKey === 'GOOGLE_PLACES_API') {
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

const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

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
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Google Places API proxy running on http://localhost:${PORT}`);
  console.log(`📍 Make sure Vite is also running: npm run dev`);
  console.log(`🔑 API Key loaded: ${GOOGLE_PLACES_API_KEY ? '✓ Yes' : '✗ No (check .env.local)'}\n`);
});
