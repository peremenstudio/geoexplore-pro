// GovMap API Integration (via server-side proxy)
// API Documentation: https://api.govmap.gov.il/docs/intro/javascript-functions

const GOVMAP_PROXY_URL = '/api/govmap';

export interface GovMapSearchResult {
  X: number;
  Y: number;
  LayerName: string;
  Feature: any;
  Score: number;
}

/**
 * Test GovMap API connection via proxy
 */
export const testGovMapConnection = async (): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    const response = await fetch(GOVMAP_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'test' })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.error || 'Failed to connect to GovMap API',
        data: result
      };
    }

    return {
      success: true,
      message: 'GovMap API proxy connected successfully',
      data: {
        tokenConfigured: result.tokenConfigured,
        proxyUrl: GOVMAP_PROXY_URL
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error testing GovMap connection: ${error.message}`,
      data: { error: error.message }
    };
  }
};

/**
 * Initialize GovMap API with token
 * Call this after the API script is loaded
 */
export const initGovMapAPI = (): boolean => {
  // Not needed anymore - using server-side proxy
  console.log('✅ GovMap API proxy ready');
  return true;
};

/**
 * Search for location using GovMap API
 * @param query Search query string
 */
export const searchGovMapLocation = async (query: string): Promise<GovMapSearchResult[]> => {
  // TODO: Implement search via proxy if needed
  throw new Error('Search not yet implemented. Use fetchGovMapLayer for layer data.');
};

/**
 * Fetch GovMap layer data via proxy and convert to GeoJSON
 * @param layerId Numeric ID of the GovMap layer (e.g., 383 for wineries)
 * @param bounds Optional bounds to limit the query [minX, minY, maxX, maxY] in EPSG:4326
 */
export const fetchGovMapLayer = async (
  layerId: number,
  bounds?: [number, number, number, number]
): Promise<{ success: boolean; data?: any; message: string }> => {
  try {
    const response = await fetch(GOVMAP_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'fetchLayer',
        layerId,
        bounds
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: result.error || result.message || 'Failed to fetch layer from GovMap'
      };
    }

    if (result.success && result.data) {
      return {
        success: true,
        data: result.data,
        message: `Successfully fetched ${result.featureCount || 0} features from layer ${layerId}`
      };
    }

    return {
      success: false,
      message: 'Invalid response from GovMap API'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error fetching GovMap layer: ${error.message}`
    };
  }
};
