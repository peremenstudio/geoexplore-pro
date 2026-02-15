import { Indicator, ZoneMultiplier } from './types';

// Isochrone zone multipliers for weighted scoring
export const ZONE_MULTIPLIERS: Record<string, ZoneMultiplier> = {
    zoneA: { min: 0, max: 5, multiplier: 1.0, label: 'Zone A (0-5 min)' },
    zoneB: { min: 5, max: 10, multiplier: 0.6, label: 'Zone B (5-10 min)' },
    zoneC: { min: 10, max: 15, multiplier: 0.3, label: 'Zone C (10-15 min)' }
};

// City center coordinates for research analysis
export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
    'Tel Aviv': { lat: 32.0853, lng: 34.7818 },
    'Jerusalem': { lat: 31.7683, lng: 35.2137 },
    'Haifa': { lat: 32.7940, lng: 34.9896 },
    'Beer Sheva': { lat: 31.2518, lng: 34.7913 }
};

// Default indicators for research analysis
export const DEFAULT_INDICATORS: Indicator[] = [
    // Urban indicators
    { id: 'parks', name: 'Green Spaces & Parks', category: 'urban', enabled: true, dataSource: 'OSM', zoneSensitivity: 'medium' },
    { id: 'transit', name: 'Public Transport Stops', category: 'urban', enabled: true, dataSource: 'OSM', zoneSensitivity: 'high' },
    { id: 'bike', name: 'Bike Infrastructure', category: 'urban', enabled: false, dataSource: 'OSM', zoneSensitivity: 'medium' },
    { id: 'parking', name: 'Parking Availability', category: 'urban', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'low' },
    
    // Social indicators
    { id: 'schools', name: 'Educational Institutions', category: 'social', enabled: true, dataSource: 'OSM', zoneSensitivity: 'medium' },
    { id: 'healthcare', name: 'Healthcare Facilities', category: 'social', enabled: true, dataSource: 'OSM', zoneSensitivity: 'high' },
    { id: 'community', name: 'Community Centers', category: 'social', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'medium' },
    { id: 'sports', name: 'Sports & Recreation', category: 'social', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'low' },
    
    // Economic indicators
    { id: 'commercial', name: 'Commercial Density', category: 'economic', enabled: true, dataSource: 'OSM', zoneSensitivity: 'medium' },
    { id: 'retail', name: 'Retail & Shopping', category: 'economic', enabled: true, dataSource: 'OSM', zoneSensitivity: 'high' },
    { id: 'employment', name: 'Employment Centers', category: 'economic', enabled: false, dataSource: 'Census', zoneSensitivity: 'low' },
    { id: 'prices', name: 'Real Estate Prices', category: 'economic', enabled: false, dataSource: 'Nadlan', zoneSensitivity: 'low' },
    
    // Historical indicators
    { id: 'heritage', name: 'Heritage Sites', category: 'historical', enabled: true, dataSource: 'Municipal', zoneSensitivity: 'low' },
    { id: 'monuments', name: 'Monuments & Landmarks', category: 'historical', enabled: true, dataSource: 'OSM', zoneSensitivity: 'low' },
    { id: 'conservation', name: 'Conservation Areas', category: 'historical', enabled: false, dataSource: 'Municipal', zoneSensitivity: 'medium' }
];

// Category colors for visualization
export const CATEGORY_COLORS = {
    urban: '#3b82f6',
    social: '#22c55e',
    economic: '#f97316',
    historical: '#a855f7'
};

// Default category weights (0-100, must sum to 100)
export const DEFAULT_WEIGHTS = {
    urban: 25,
    social: 25,
    economic: 25,
    historical: 25
};
