import { Feature } from 'geojson';
import { fetchArcGISLayer, GISLayerInfo } from './telAvivGis';

export const JERUSALEM_GIS_SERVER = 'https://gisviewer.jerusalem.muni.il/arcgis/rest/services/BaseLayers/MapServer';

/**
 * Fetches available layers from Jerusalem GIS Server
 */
export const fetchJerusalemLayers = async (): Promise<GISLayerInfo[]> => {
    try {
        const url = `${JERUSALEM_GIS_SERVER}?f=json`;
        console.log('📡 Fetching Jerusalem layers from:', url);

        const response = await fetch(url);
        console.log('📊 Jerusalem response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Jerusalem server error response:', errorText);
            throw new Error(`Server returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('📥 Jerusalem fetched data:', data);

        if (!data.layers || !Array.isArray(data.layers)) {
            console.warn('No layers found in Jerusalem response');
            return [];
        }

        const layers = data.layers.map((layer: any) => ({
            id: layer.id,
            name: layer.name,
            type: layer.type || 'Unknown',
            description: layer.description
        }));

        console.log(`✅ Loaded ${layers.length} layers from Jerusalem GIS`);
        return layers;
    } catch (error: any) {
        console.error('❌ Failed to fetch Jerusalem layers:', error);
        throw error;
    }
};

/**
 * Fetches data from a specific Jerusalem GIS layer by ID
 */
export const fetchJerusalemLayerData = async (layerId: number): Promise<Feature[]> => {
    const url = `${JERUSALEM_GIS_SERVER}/${layerId}/query?where=1%3D1&outFields=*&f=json`;
    console.log('🗺️ Fetching Jerusalem layer data from:', url);
    return fetchArcGISLayer(url);
};
