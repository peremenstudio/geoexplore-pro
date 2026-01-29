import type { IncomingMessage, ServerResponse } from 'http';

// Get API key from environment - works on both Vercel and local dev
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API || '';

console.log('[API] GOOGLE_PLACES_API_KEY configured:', !!GOOGLE_PLACES_API_KEY);
console.log('[API] Available env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE')));

const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

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

      const url = `${PLACES_API_URL}?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_PLACES_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        sendJson(res, response.status, {
          error: `Google Places API error: ${error.error_message || response.statusText}`
        });
        return;
      }

      const data = await response.json();
      sendJson(res, 200, data);
    } else if (action === 'details') {
      // Fetch place details
      const { placeId } = params;

      if (!placeId) {
        sendJson(res, 400, { error: 'Missing required parameter: placeId' });
        return;
      }

      const url = `${DETAILS_API_URL}?place_id=${placeId}&key=${GOOGLE_PLACES_API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
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
    console.error('Error in Google Places proxy:', error);
    sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
}
