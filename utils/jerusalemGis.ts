import { fetchArcGISLayer } from './telAvivGis';

export interface JerusalemLayer {
    id: number;
    name: string;
    color: string;
}

export interface JerusalemCategory {
    id: string;
    name: string;
    layers: JerusalemLayer[];
}

/**
 * Jerusalem GIS layers organized by category
 */
export const JERUSALEM_CATEGORIES: JerusalemCategory[] = [
    {
        id: 'education',
        name: 'Education',
        layers: [
            { id: 3, name: 'Schools / מוסדות חינוך', color: '#3b82f6' },
            { id: 88, name: 'Kindergartens / גני ילדים', color: '#60a5fa' },
        ]
    },
    {
        id: 'sports',
        name: 'Sports & Recreation',
        layers: [
            { id: 78, name: 'Sports Facilities / מתקני ספורט', color: '#10b981' },
            { id: 36, name: 'Parks & Gardens / גנים', color: '#34d399' },
        ]
    },
    {
        id: 'transportation',
        name: 'Transportation',
        layers: [
            { id: 0, name: 'Bus Stops / תחנות אוטובוס', color: '#8b5cf6' },
            { id: 96, name: 'Light Rail Stations / תחנות רכבת קלה', color: '#a78bfa' },
            { id: 97, name: 'Light Rail Lines / קווי רכבת קלה', color: '#c4b5fd' },
        ]
    },
    {
        id: 'infrastructure',
        name: 'Infrastructure',
        layers: [
            { id: 2040, name: 'Security Cameras / מצלמות בטחון', color: '#ef4444' },
            { id: 2061, name: 'Fire Hydrants / ברזי כיבוי אש', color: '#f87171' },
        ]
    }
];

/**
 * Fetches a layer from Jerusalem GIS by layer ID
 */
export const fetchJerusalemLayer = async (layerId: number): Promise<any[]> => {
    const baseUrl = 'https://gisviewer.jerusalem.muni.il/arcgis/rest/services/BaseLayers/MapServer';
    const url = `${baseUrl}/${layerId}/query?where=1%3D1&outFields=*&f=json`;
    
    return fetchArcGISLayer(url);
};
