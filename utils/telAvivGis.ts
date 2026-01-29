import { Feature } from 'geojson';
import proj4 from 'proj4';

// Define Israel TM Grid (EPSG:6991 / ITM)
const ITM = '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

export const TEL_AVIV_GIS_SERVER = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer';

/**
 * Converts coordinates from ITM (Israel TM Grid) to WGS84 if needed
 * @param x - X coordinate (longitude or easting)
 * @param y - Y coordinate (latitude or northing)
 * @returns [lon, lat] in WGS84
 */
const convertToWGS84 = (x: number, y: number): [number, number] => {
    // Check if coordinates are already in WGS84 (lon/lat)
    // Israel's longitude range: ~34-36, latitude range: ~29-33
    const isAlreadyWGS84 = (x >= 34 && x <= 36) && (y >= 29 && y <= 34);
    
    if (isAlreadyWGS84) {
        return [x, y];
    }
    
    // Convert from ITM to WGS84
    const [lon, lat] = proj4(ITM, WGS84, [x, y]);
    return [lon, lat];
};

interface ArcGISFeature {
    attributes: {
        [key: string]: any;
    };
    geometry?: {
        x?: number;
        y?: number;
        rings?: number[][][];
        paths?: number[][][];
    };
}

interface ArcGISResponse {
    features: ArcGISFeature[];
    fields?: Array<{
        name: string;
        type: string;
        alias: string;
    }>;
}

/**
 * Fetches sports fields data from Tel Aviv GIS Portal
 */
export const fetchTelAvivSportsFields = async (): Promise<Feature[]> => {
    const url = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/943/query?where=1%3D1&outFields=*&f=json';
    return fetchArcGISLayer(url);
};

/**
 * Generic function to fetch any ArcGIS layer by URL
 */
export const fetchArcGISLayer = async (layerUrl: string): Promise<Feature[]> => {
    try {
        const response = await fetch(layerUrl);
        
        if (!response.ok) {
            throw new Error(`ArcGIS API failed: ${response.statusText}`);
        }

        const data: ArcGISResponse = await response.json();

        if (!data.features || data.features.length === 0) {
            return [];
        }

        const features: Feature[] = data.features
            .filter(f => f.geometry && (f.geometry.x !== undefined || f.geometry.rings || f.geometry.paths))
            .map((item, index) => {
                const geom = item.geometry!;
                let geometry: any;

                // Handle point geometry
                if (geom.x !== undefined && geom.y !== undefined) {
                    const [lon, lat] = convertToWGS84(geom.x, geom.y);
                    geometry = {
                        type: 'Point',
                        coordinates: [lon, lat]
                    };
                }
                // Handle polygon geometry
                else if (geom.rings) {
                    geometry = {
                        type: 'Polygon',
                        coordinates: geom.rings.map(ring => 
                            ring.map(([x, y]) => convertToWGS84(x, y))
                        )
                    };
                }
                // Handle line geometry
                else if (geom.paths) {
                    geometry = {
                        type: 'LineString',
                        coordinates: geom.paths[0].map(([x, y]) => convertToWGS84(x, y))
                    };
                }

                // Extract meaningful properties
                const attrs = item.attributes;
                const name = attrs.NAME || attrs.name || attrs.OBJECTID || `Feature ${index + 1}`;
                
                return {
                    type: 'Feature',
                    geometry,
                    properties: {
                        id: `arcgis-${attrs.OBJECTID || index}`,
                        name: name,
                        ...attrs
                    }
                };
            });

        return features;

    } catch (error: any) {
        console.error('ArcGIS Error:', error);
        throw new Error(`Failed to fetch layer: ${error.message}`);
    }
};

/**
 * Hebrew to English translations for common GIS layer names
 */
const HEBREW_TO_ENGLISH: { [key: string]: string[] } = {
    'עצים': ['trees', 'tree', 'vegetation', 'flora', 'green'],
    'פארקים': ['parks', 'park', 'gardens', 'green space'],
    'גנים': ['gardens', 'garden', 'parks'],
    'חנייה': ['parking', 'parking lots', 'parking spaces'],
    'מדרכות': ['sidewalks', 'pedestrian', 'walkways'],
    'אופניים': ['bikes', 'bicycles', 'cycling'],
    'תחזוקה': ['maintenance', 'facilities'],
    'בריאות': ['health', 'hospitals', 'clinics', 'medical'],
    'חינוך': ['schools', 'education', 'educational'],
    'תרבות': ['culture', 'cultural', 'museums', 'theater'],
    'ספורט': ['sports', 'sports fields', 'recreation', 'fitness'],
    'תחבורה': ['transportation', 'transport', 'transit', 'public transport'],
    'אזור': ['area', 'zone', 'region'],
    'כביש': ['roads', 'streets', 'highways', 'paths'],
    'מים': ['water', 'lakes', 'rivers', 'fountains'],
    'תורם': ['contributors', 'community'],
    'לילה': ['night', 'evening', 'lights', 'lighting'],
};

/**
 * Fetches available layers from Tel Aviv GIS Server
 */
export interface GISLayerInfo {
    id: number;
    name: string;
    englishName?: string;
    type: string;
    description?: string;
    url?: string;
    serviceName?: string;
}

export const fetchTelAvivLayers = async (): Promise<GISLayerInfo[]> => {
    try {
        const url = `${TEL_AVIV_GIS_SERVER}?f=json`;
        console.log('📡 Fetching layers from:', url);
        
        const response = await fetch(url);
        console.log('📊 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('📥 Fetched data:', data);
        
        if (!data.layers || !Array.isArray(data.layers)) {
            console.warn('No layers found in response');
            return [];
        }
        
        const layers = data.layers.map((layer: any) => ({
            id: layer.id,
            name: layer.name,
            englishName: findEnglishName(layer.name),
            type: layer.type || 'Unknown',
            description: layer.description
        }));
        
        console.log(`✅ Loaded ${layers.length} layers from Tel Aviv GIS`);
        return layers;
    } catch (error: any) {
        console.error('❌ Failed to fetch Tel Aviv layers:', error);
        throw error;
    }
};

/**
 * Fetches data from a specific Tel Aviv GIS layer by ID
 */
export const fetchTelAvivLayerData = async (layerId: number): Promise<Feature[]> => {
    const url = `${TEL_AVIV_GIS_SERVER}/${layerId}/query?where=1%3D1&outFields=*&f=json`;
    console.log('🗺️ Fetching layer data from:', url);
    try {
        const features = await fetchArcGISLayer(url);
        console.log(`✅ Loaded ${features.length} features from layer ${layerId}`);
        return features;
    } catch (error: any) {
        console.error(`❌ Failed to fetch layer ${layerId}:`, error);
        throw error;
    }
};

/**
 * Find matching layers by name - searches both Hebrew and English
 */
export const findMatchingLayers = (query: string, layers: GISLayerInfo[]): GISLayerInfo[] => {
    const lower = query.toLowerCase();
    return layers
        .filter(l => {
            // Search in Hebrew name
            if (l.name.toLowerCase().includes(lower)) return true;
            // Search in English name or translations
            if (l.englishName && l.englishName.toLowerCase().includes(lower)) return true;
            return false;
        })
        .sort((a, b) => {
            // Prioritize exact matches and matches at the start
            const aHebrewStart = a.name.toLowerCase().startsWith(lower);
            const bHebrewStart = b.name.toLowerCase().startsWith(lower);
            const aEnglishStart = a.englishName && a.englishName.toLowerCase().startsWith(lower);
            const bEnglishStart = b.englishName && b.englishName.toLowerCase().startsWith(lower);
            
            if ((aHebrewStart || aEnglishStart) && !(bHebrewStart || bEnglishStart)) return -1;
            if (!(aHebrewStart || aEnglishStart) && (bHebrewStart || bEnglishStart)) return 1;
            return a.name.localeCompare(b.name);
        })
        .slice(0, 5); // Return top 5 matches
};

/**
 * Find English name for a Hebrew layer name
 */
const findEnglishName = (hebrewName: string): string => {
    for (const [hebrew, englishOptions] of Object.entries(HEBREW_TO_ENGLISH)) {
        if (hebrewName.includes(hebrew)) {
            return englishOptions[0]; // Return first English option
        }
    }
    return hebrewName; // Fallback to original if no translation found
};
