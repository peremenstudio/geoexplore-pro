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

      // Try multiple GovMap API endpoints
      
      // Method 1: ArcGIS REST API format (most common for Israeli government services)
      const arcgisUrl = `${GOVMAP_BASE_URL}/arcgis/rest/services/Layers/layer_${layerId}/MapServer/0/query?where=1%3D1&outFields=*&f=geojson&token=${GOVMAP_API_TOKEN}`;
      
      console.log('[GovMap API] Trying ArcGIS REST format...');

      let response = await fetch(arcgisUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      // If ArcGIS format fails, try WFS format
      if (!response.ok) {
        console.log('[GovMap API] ArcGIS format failed, trying WFS...');
        
        const params = new URLSearchParams({
          SERVICE: 'WFS',
          VERSION: '2.0.0',
          REQUEST: 'GetFeature',
          TYPENAME: `layer_${layerId}`,
          OUTPUTFORMAT: 'application/json',
          SRSNAME: 'EPSG:4326',
          token: GOVMAP_API_TOKEN
        });

        const wfsUrl = `${GOVMAP_BASE_URL}/wfs?${params.toString()}`;
        response = await fetch(wfsUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });
      }

      // Check response
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();

      console.log('[GovMap API] Response status:', response.status);
      console.log('[GovMap API] Content-Type:', contentType);
      console.log('[GovMap API] Response (first 500 chars):', responseText.substring(0, 500));

      if (!response.ok) {
        console.error('[GovMap API] Error:', response.status, responseText);
        sendJson(res, response.status, { 
          error: 'Failed to fetch from GovMap',
          status: response.status,
          details: responseText.substring(0, 1000),
          contentType: contentType
        });
        return;
      }

      // Check if response is HTML (error page)
      if (contentType?.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error('[GovMap API] Received HTML instead of JSON');
        sendJson(res, 500, { 
          error: 'GovMap returned HTML instead of JSON',
          message: 'The API endpoint or authentication may be incorrect',
          details: responseText.substring(0, 1000)
        });
        return;
      }

      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[GovMap API] JSON parse error:', parseError);
        sendJson(res, 500, { 
          error: 'Invalid JSON response from GovMap',
          details: responseText.substring(0, 1000)
        });
        return;
      }
      
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
