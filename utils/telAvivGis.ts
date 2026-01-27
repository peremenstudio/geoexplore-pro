import { Feature } from 'geojson';
import proj4 from 'proj4';

// Define Israel TM Grid (EPSG:6991 / ITM)
const ITM = '+proj=tmerc +lat_0=31.7343936111111 +lon_0=35.2045169444444 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

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
