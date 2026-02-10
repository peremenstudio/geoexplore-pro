// GovMap API Integration
// API Documentation: https://api.govmap.gov.il/docs/intro/javascript-functions

const GOVMAP_API_TOKEN = process.env.GOVMAP_API_TOKEN || '';
const GOVMAP_API_URL = 'https://www.govmap.gov.il/govmap/api/govmap.api.js';

export interface GovMapSearchResult {
  X: number;
  Y: number;
  LayerName: string;
  Feature: any;
  Score: number;
}

/**
 * Test GovMap API connection
 */
export const testGovMapConnection = async (): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    // Load GovMap API script dynamically
    const scriptId = 'govmap-api-script';
    
    // Check if script already loaded
    if (!document.getElementById(scriptId)) {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = GOVMAP_API_URL;
        script.async = true;
        
        script.onload = () => {
          // Script loaded successfully
          resolve({
            success: true,
            message: `GovMap API script loaded successfully. Token: ${GOVMAP_API_TOKEN ? 'configured' : 'missing'}`,
            data: {
              token: GOVMAP_API_TOKEN ? '***masked***' : 'not configured',
              apiUrl: GOVMAP_API_URL,
              scriptLoaded: true
            }
          });
        };
        
        script.onerror = () => {
          resolve({
            success: false,
            message: 'Failed to load GovMap API script',
            data: { apiUrl: GOVMAP_API_URL }
          });
        };
        
        document.head.appendChild(script);
      });
    }
    
    // Script already loaded
    return {
      success: true,
      message: 'GovMap API script already loaded',
      data: {
        token: GOVMAP_API_TOKEN ? '***masked***' : 'not configured',
        apiUrl: GOVMAP_API_URL,
        scriptLoaded: true
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
  try {
    // Check if GovMap API is available in window
    if (typeof (window as any).govm !== 'undefined') {
      console.log('✅ GovMap API is available');
      return true;
    } else {
      console.warn('⚠️ GovMap API not found in window object');
      return false;
    }
  } catch (error) {
    console.error('❌ Error initializing GovMap API:', error);
    return false;
  }
};

/**
 * Search for location using GovMap API
 * @param query Search query string
 */
export const searchGovMapLocation = async (query: string): Promise<GovMapSearchResult[]> => {
  return new Promise((resolve, reject) => {
    try {
      const govmap = (window as any).govm;
      
      if (!govmap) {
        reject(new Error('GovMap API not initialized. Call testGovMapConnection first.'));
        return;
      }

      // Use GovMap search API
      // This is a placeholder - actual implementation depends on GovMap API documentation
      govmap.search(query, {
        token: GOVMAP_API_TOKEN,
        callback: (results: GovMapSearchResult[]) => {
          resolve(results);
        },
        error: (error: any) => {
          reject(new Error(`GovMap search error: ${error}`));
        }
      });
    } catch (error: any) {
      reject(new Error(`Error searching GovMap: ${error.message}`));
    }
  });
};
