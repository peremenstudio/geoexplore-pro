import { Feature } from 'geojson';
import { fetchArcGISLayer, GISLayerInfo } from './telAvivGis';

export const HAIFA_GIS_SERVER = 'https://gisserver.haifa.muni.il/arcgiswebadaptor/rest/services';
const HAIFA_PUBLIC_FOLDER = 'PublicSite';

type HaifaServiceInfo = {
    name: string;
    type: string;
};

type HaifaDirectoryResponse = {
    services?: HaifaServiceInfo[];
    folders?: string[];
};

const fetchServicesInFolder = async (folderPath: string): Promise<HaifaServiceInfo[]> => {
    const url = `${HAIFA_GIS_SERVER}/${folderPath}?f=json`;
    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`Haifa folder fetch failed (${folderPath}):`, response.statusText);
        return [];
    }
    const data: HaifaDirectoryResponse = await response.json();
    return data.services || [];
};

const fetchServiceLayers = async (service: HaifaServiceInfo): Promise<GISLayerInfo[]> => {
    const serviceUrl = `${HAIFA_GIS_SERVER}/${service.name}/${service.type}`;
    const response = await fetch(`${serviceUrl}?f=json`);
    if (!response.ok) {
        console.warn(`Haifa service fetch failed (${service.name}):`, response.statusText);
        return [];
    }
    const data = await response.json();
    if (!data.layers || !Array.isArray(data.layers)) {
        return [];
    }

    return data.layers.map((layer: any) => ({
        id: layer.id,
        name: layer.name,
        type: layer.type || 'Unknown',
        description: layer.description || data.serviceDescription,
        url: `${serviceUrl}/${layer.id}/query?where=1%3D1&outFields=*&f=json`,
        serviceName: service.name
    }));
};

/**
 * Fetches available layers from Haifa GIS Server
 */
export const fetchHaifaLayers = async (): Promise<GISLayerInfo[]> => {
    try {
        const rootUrl = `${HAIFA_GIS_SERVER}/${HAIFA_PUBLIC_FOLDER}?f=json`;
        console.log('📡 Fetching Haifa layers from:', rootUrl);

        const response = await fetch(rootUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Haifa server returned ${response.status}: ${errorText}`);
        }

        const data: HaifaDirectoryResponse = await response.json();
        const services: HaifaServiceInfo[] = data.services || [];
        const folders = (data.folders || []).filter(folder => folder.toLowerCase() !== 'system');

        const folderServices = await Promise.all(folders.map(folder => fetchServicesInFolder(`${HAIFA_PUBLIC_FOLDER}/${folder}`)));
        const allServices = [...services, ...folderServices.flat()]
            .filter(service => service.type === 'MapServer' || service.type === 'FeatureServer');

        const layersNested = await Promise.all(allServices.map(fetchServiceLayers));
        const layers = layersNested.flat();

        console.log(`✅ Loaded ${layers.length} layers from Haifa GIS`);
        return layers;
    } catch (error: any) {
        console.error('❌ Failed to fetch Haifa layers:', error);
        throw error;
    }
};

/**
 * Fetches data from a specific Haifa GIS layer by URL
 */
export const fetchHaifaLayerData = async (layerUrl: string): Promise<Feature[]> => {
    console.log('🗺️ Fetching Haifa layer data from:', layerUrl);
    return fetchArcGISLayer(layerUrl);
};
