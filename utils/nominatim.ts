import { Feature } from 'geojson';

interface NominatimResult {
    place_id: number;
    licence: string;
    osm_type: string;
    osm_id: number;
    boundingbox: string[];
    lat: string;
    lon: string;
    display_name: string;
    class: string;
    type: string;
    importance: number;
    icon?: string;
    address?: {
        name?: string;
        road?: string;
        suburb?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
        [key: string]: string | undefined;
    };
    name?: string;
}

/**
 * Fetches places from OpenStreetMap via Nominatim.
 * @param query The text query (e.g. "Pizza").
 * @param center Optional center point {lat, lng}.
 * @param radius Optional radius in meters to restrict search. Defaults to 5000m (5km).
 */
export const fetchNominatimPlaces = async (query: string, center?: { lat: number, lng: number }, radius: number = 5000): Promise<Feature[]> => {
    // Construct the URL
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.append('q', query);
    url.searchParams.append('format', 'jsonv2');
    url.searchParams.append('addressdetails', '1');
    url.searchParams.append('limit', '50');

    // If a center is provided, calculate the bounding box based on the radius
    if (center) {
        // Earth's radius calculation approximation
        // 1 deg lat ~= 111320 meters
        // 1 deg lng ~= 111320 * cos(lat) meters
        const latOffset = radius / 111320;
        const lngOffset = radius / (111320 * Math.cos(center.lat * (Math.PI / 180)));

        // Nominatim expects viewbox=<x1>,<y1>,<x2>,<y2> (left, top, right, bottom)
        // We use minLon, minLat, maxLon, maxLat
        const viewbox = [
            (center.lng - lngOffset).toFixed(5),
            (center.lat - latOffset).toFixed(5),
            (center.lng + lngOffset).toFixed(5),
            (center.lat + latOffset).toFixed(5)
        ].join(',');

        url.searchParams.append('viewbox', viewbox);
        url.searchParams.append('bounded', '1'); // Strictly restrict results to the viewbox
    }

    try {
        const response = await fetch(url.toString(), {
            headers: {
                // Nominatim requires a User-Agent identifying the application
                'User-Agent': 'GeoExplorePro/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`OpenStreetMap request failed: ${response.statusText}`);
        }

        const data: NominatimResult[] = await response.json();

        if (data.length === 0) {
            return [];
        }

        const features: Feature[] = data.map((item, index) => {
            // Determine a clean name
            // item.name is usually the specific name (e.g. "Starbucks")
            // item.display_name is the full string (e.g. "Starbucks, Main St, London...")
            const name = item.name || item.display_name.split(',')[0];
            
            // Format Category (Capitalize item.type or item.class)
            const category = (item.type || item.class || 'location').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
                },
                properties: {
                    id: `osm-${item.place_id}-${index}`,
                    name: name,
                    address: item.display_name,
                    category: category,
                    source: 'OpenStreetMap'
                }
            };
        });

        return features;

    } catch (error) {
        console.error("Nominatim API Error:", error);
        throw new Error("Failed to fetch data from OpenStreetMap.");
    }
};
