import { Feature } from 'geojson';

const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const PROXY_URL = '/api/googlePlaces';

export interface PlaceSearchParams {
    lat: number;
    lng: number;
    radius: number;
    type: string; // e.g., 'restaurant', 'cafe', 'hotel', 'shop'
}

export interface PlaceDetails {
    name: string;
    address: string;
    rating?: number;
    ratingCount?: number;
    category: string;
    closingHour?: string;
    priceLevel?: number; // 0-4 ($, $$, $$$, $$$$)
    phone?: string;
    website?: string;
    lat: number;
    lng: number;
}

export interface DailyUsageStats {
    requestsToday: number;
    requestsLimit: number;
    percentageUsed: number;
    estimatedRemaining: number;
}

// Google Places API free tier: 25,000 requests per day
const FREE_TIER_DAILY_LIMIT = 25000;

// Store requests in sessionStorage to track daily usage
const getStorageKey = (): string => {
    const today = new Date().toISOString().split('T')[0];
    return `google_places_requests_${today}`;
};

const incrementRequestCount = (): void => {
    const key = getStorageKey();
    const current = parseInt(sessionStorage.getItem(key) || '0', 10);
    sessionStorage.setItem(key, String(current + 1));
};

const getRequestCount = (): number => {
    const key = getStorageKey();
    return parseInt(sessionStorage.getItem(key) || '0', 10);
};

export const getDailyUsageStats = (): DailyUsageStats => {
    const requestsToday = getRequestCount();
    const percentageUsed = (requestsToday / FREE_TIER_DAILY_LIMIT) * 100;
    return {
        requestsToday,
        requestsLimit: FREE_TIER_DAILY_LIMIT,
        percentageUsed: Math.min(percentageUsed, 100),
        estimatedRemaining: Math.max(FREE_TIER_DAILY_LIMIT - requestsToday, 0)
    };
};

/**
 * Fetch nearby places from Google Places API via backend proxy
 */
export const fetchNearbyPlaces = async (params: PlaceSearchParams): Promise<PlaceDetails[]> => {
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'nearby',
                params: {
                    lat: params.lat,
                    lng: params.lng,
                    radius: params.radius,
                    type: params.type
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Google Places API error: ${error.error || response.statusText}`);
        }

        const data = await response.json();
        incrementRequestCount();

        if (!data.results || data.results.length === 0) {
            return [];
        }

        // Fetch detailed info for each place
        const detailedPlaces = await Promise.all(
            data.results.map(async (place: any) => {
                try {
                    const details = await fetchPlaceDetails(place.place_id);
                    return details;
                } catch (err) {
                    console.warn(`Failed to fetch details for ${place.name}:`, err);
                    return {
                        name: place.name,
                        address: place.vicinity || '',
                        rating: place.rating,
                        ratingCount: place.user_ratings_total,
                        category: params.type,
                        lat: place.geometry.location.lat,
                        lng: place.geometry.location.lng
                    };
                }
            })
        );

        return detailedPlaces;
    } catch (error: any) {
        console.error('Error fetching places from Google Places:', error);
        throw error;
    }
};

/**
 * Fetch detailed information for a specific place via backend proxy
 */
const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails> => {
    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'details',
                params: { placeId }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch place details: ${error.error || response.statusText}`);
        }

        const data = await response.json();
        incrementRequestCount();

        const result = data.result;
        const openingHours = result.opening_hours?.weekday_text || [];
        const todayHours = openingHours[new Date().getDay()] || '';
        
        // Extract closing hour from format like "9:00 AM – 10:00 PM"
        const closingMatch = todayHours.match(/–\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        let closingHour: string | undefined;
        if (closingMatch) {
            closingHour = closingMatch[1] + ':' + closingMatch[2] + ' ' + closingMatch[3];
        }

        return {
            name: result.name,
            address: result.formatted_address,
            rating: result.rating,
            ratingCount: result.user_ratings_total,
            category: 'place', // Generic category from details
            closingHour,
            priceLevel: result.price_level,
            phone: result.phone_number,
            website: result.website,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
        };
    } catch (error: any) {
        console.error('Error fetching place details:', error);
        throw error;
    }
};

/**
 * Convert places to GeoJSON features
 */
export const placesToGeoJSON = (places: PlaceDetails[]): Feature[] => {
    return places.map((place, idx) => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [place.lng, place.lat]
        },
        properties: {
            id: `place-${idx}`,
            name: place.name,
            address: place.address,
            category: place.category,
            rating: place.rating || 'N/A',
            ratingCount: place.ratingCount || 0,
            closingHour: place.closingHour || 'Not available',
            priceLevel: place.priceLevel ? '$'.repeat(place.priceLevel) : 'N/A',
            phone: place.phone || 'N/A',
            website: place.website || 'N/A'
        }
    }));
};

/**
 * Get price level display string
 */
export const getPriceLevelDisplay = (level?: number): string => {
    if (!level) return 'N/A';
    return '$'.repeat(level);
};

/**
 * Get category display name
 */
export const getCategoryDisplay = (type: string): string => {
    const categoryMap: { [key: string]: string } = {
        restaurant: '🍽️ Restaurant',
        cafe: '☕ Café',
        bar: '🍺 Bar',
        hotel: '🏨 Hotel',
        shop: '🛍️ Shop',
        supermarket: '🛒 Supermarket',
        pharmacy: '💊 Pharmacy',
        hospital: '🏥 Hospital',
        park: '🌳 Park',
        museum: '🏛️ Museum',
        library: '📚 Library',
        school: '🎓 School',
        bank: '🏦 Bank',
        atm: '💰 ATM'
    };
    return categoryMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
};
