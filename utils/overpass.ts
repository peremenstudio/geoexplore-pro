import { Feature } from 'geojson';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    [key: string]: string;
  };
}

interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: {
    timestamp_osm_base: string;
    copyright: string;
  };
  elements: OverpassElement[];
}

/**
 * Helper to determine a readable category from tags.
 */
const determineCategory = (tags: { [key: string]: string }): string => {
  if (tags.amenity) return tags.amenity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (tags.shop) return `${tags.shop.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (Shop)`;
  if (tags.tourism) return tags.tourism.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (tags.leisure) return tags.leisure.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (tags.cuisine) return `${tags.cuisine.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Place`;
  if (tags.office) return `${tags.office.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (Office)`;
  if (tags.craft) return `${tags.craft.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (Craft)`;
  if (tags.historic) return tags.historic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return 'Point of Interest';
};

/**
 * Helper to construct a readable address from tags.
 */
const formatAddress = (tags: { [key: string]: string }): string => {
  const parts = [];
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  
  if (parts.length > 0) return parts.join(', ');
  
  // Fallback to other location hints
  if (tags['addr:full']) return tags['addr:full'];
  
  return 'Address not available';
};

export const fetchOverpassData = async (query: string, center: { lat: number, lng: number }, radius: number): Promise<Feature[]> => {
  // 1. Sanitize query - remove quotes and trim
  let cleanQuery = query.replace(/"/g, '').trim().toLowerCase();
  
  if (!cleanQuery) return [];

  // 2. Handle plural to singular conversion for common searches
  const singularQuery = cleanQuery.endsWith('s') && !cleanQuery.endsWith('ss') 
    ? cleanQuery.slice(0, -1) 
    : cleanQuery;

  // 3. Construct Overpass QL Query
  // Use simpler tag matching without regex to avoid syntax issues
  // Try both singular and plural forms if they're different
  const searchTerms = cleanQuery === singularQuery 
    ? [cleanQuery]
    : [cleanQuery, singularQuery];

  const filterExpressions = searchTerms.map(term => 
    `(nwr["amenity"="${term}"](around:${radius},${center.lat},${center.lng});
     nwr["tourism"="${term}"](around:${radius},${center.lat},${center.lng});
     nwr["leisure"="${term}"](around:${radius},${center.lat},${center.lng});
     nwr["shop"="${term}"](around:${radius},${center.lat},${center.lng});
     nwr["cuisine"~"${term}"](around:${radius},${center.lat},${center.lng});)`
  ).join(';');

  const queryQL = `
    [out:json][timeout:60];
    ${filterExpressions};
    out center 500;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      // Fix: Overpass API requires 'data=' prefix for form-urlencoded content type
      body: 'data=' + encodeURIComponent(queryQL),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
        // Handle specific HTTP errors
        if (response.status === 504) {
             throw new Error("Overpass API timed out. Try reducing the search radius or using a more specific query.");
        }
        if (response.status === 429) {
             throw new Error("Overpass API rate limit reached. Please wait a moment before trying again.");
        }
        if (response.status === 400) {
             throw new Error("Invalid query syntax. Please try a simpler search term without special characters.");
        }
        throw new Error(`Overpass API request failed: ${response.status} ${response.statusText}`);
    }

    const data: OverpassResponse = await response.json();
    
    // 3. Convert elements to GeoJSON
    const features = data.elements.map((el, index): Feature | null => {
      // For 'way' and 'relation', Overpass 'out center' provides a 'center' object.
      // For 'node', it provides 'lat' and 'lon' directly.
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;

      if (lat === undefined || lon === undefined) return null;

      const tags = el.tags || {};
      const name = tags.name || tags.alt_name || `Unnamed ${determineCategory(tags)}`;
      const category = determineCategory(tags);
      const address = formatAddress(tags);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          id: `op-${el.id}-${index}`,
          name: name,
          category: category,
          address: address,
          source: 'Overpass API',
          ...tags // Include all raw tags as properties too, for deep inspection
        }
      };
    }).filter((f): f is Feature => f !== null);

    return features;

  } catch (error: any) {
    console.error("Overpass API Error:", error);
    // Propagate the specific error message if it's one we created
    if (error.message.includes("Overpass API") || error.message.includes("Invalid query")) {
        throw error;
    }
    throw new Error("Failed to fetch data from OpenStreetMap (Overpass). Check internet connection.");
  }
};