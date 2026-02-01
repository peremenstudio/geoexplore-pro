/**
 * LAMAS API - Central Bureau of Statistics (CBS) Israel
 * Fetches economic and demographic data by geographic regions
 * 
 * API Documentation: https://www.cbs.gov.il/he/cbsNewBrand/Pages/סדרות-עיתיות-באמצעות-API.aspx
 * 
 * Data Catalog: https://data.gov.il/api/3/action/package_search?q=cbs
 */

import { Feature, FeatureCollection, Geometry } from 'geojson';

// Common CBS Table IDs for economic data
export const CBS_TABLES = {
    MUNICIPALITY_STATISTICS: 1639,  // סטטיסטיקות על רשויות מקומיות
    POPULATION_BY_SETTLEMENT: 1679,  // אוכלוסייה לפי יישובים
    ECONOMIC_ACTIVITY: 2837,  // פעילות כלכלית
    INCOME_DISTRIBUTION: 5133,  // התפלגות הכנסות
    EMPLOYMENT: 3119,  // תעסוקה
    EDUCATION: 7801,  // חינוך
    HOUSING: 5520,  // דיור
};

// Variable IDs for specific metrics
export const CBS_VARIABLES = {
    POPULATION: 'מספר תושבים',
    INCOME_PER_CAPITA: 'הכנסה לנפש',
    UNEMPLOYMENT_RATE: 'שיעור אבטלה',
    EMPLOYMENT_RATE: 'שיעור התעסוקה',
    MEDIAN_INCOME: 'הכנסה חציונית',
    POVERTY_RATE: 'שיעור עוני',
};

// Geography levels
export const CBS_GEOGRAPHY = {
    DISTRICT: 'מחוז',
    MUNICIPALITY: 'רשות מקומית',
    SETTLEMENT: 'יישוב',
    STATISTICAL_AREA: 'אזור סטטיסטי',
};

interface CBSDataPoint {
    tableId: number;
    variable: string;
    period: string;
    value: number;
    geography: string;
    geographyLevel: string;
}

interface CBSResponse {
    success: boolean;
    data: {
        rows: any[][];
        columns: {
            name: string;
            type: string;
        }[];
    };
    error?: string;
}

/**
 * Fetch data from LAMAS API
 * Base URL: https://lamas.cbs.gov.il/
 */
const LAMAS_BASE_URL = 'https://lamas.cbs.gov.il';

/**
 * Query CBS data by table ID and optional filters
 */
export async function fetchCBSData(
    tableId: number,
    filters?: {
        year?: number;
        period?: string;
        geography?: string;
        variable?: string;
    }
): Promise<CBSDataPoint[]> {
    try {
        // Build query - LAMAS uses a specific query format
        // Example: /api/1/datastore_search?resource_id=TABLEID&limit=100000
        const url = new URL(`${LAMAS_BASE_URL}/api/1/datastore_search`);
        url.searchParams.append('resource_id', tableId.toString());
        url.searchParams.append('limit', '100000');

        if (filters?.year) {
            url.searchParams.append('filters', JSON.stringify({ year: filters.year }));
        }

        console.log('📊 Fetching CBS data from:', url.toString());

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`CBS API error: ${response.statusText}`);
        }

        const data: CBSResponse = await response.json();

        if (!data.success || !data.data?.rows) {
            throw new Error('Invalid CBS API response format');
        }

        // Parse the response into structured data points
        return parseCBSResponse(data, tableId);
    } catch (error) {
        console.error('❌ Error fetching CBS data:', error);
        throw error;
    }
}

/**
 * Parse CBS API response into structured data points
 */
function parseCBSResponse(response: CBSResponse, tableId: number): CBSDataPoint[] {
    const { rows, columns } = response.data;
    const dataPoints: CBSDataPoint[] = [];

    // Map column names to indices
    const columnIndices = columns.reduce((acc, col, idx) => {
        acc[col.name] = idx;
        return acc;
    }, {} as Record<string, number>);

    // Parse each row
    rows.forEach(row => {
        // Common CBS column names (adjust based on actual table structure)
        const geography = row[columnIndices['גיאוגרפיה'] || columnIndices['שם יישוב'] || 0] || '';
        const period = row[columnIndices['תקופה'] || columnIndices['שנה'] || 1] || '';
        const value = parseFloat(row[columnIndices['ערך'] || columnIndices['מספר'] || 2] || 0);
        const variable = row[columnIndices['משתנה'] || columnIndices['סוג'] || 3] || '';

        if (value && geography) {
            dataPoints.push({
                tableId,
                variable,
                period: period.toString(),
                value,
                geography,
                geographyLevel: determinGeographyLevel(geography),
            });
        }
    });

    return dataPoints;
}

/**
 * Determine geography level (district, municipality, settlement)
 */
function determinGeographyLevel(geography: string): string {
    // Heuristic detection - in production, this should come from the API
    if (geography.length < 5) return CBS_GEOGRAPHY.DISTRICT;
    if (geography.includes('יישוב')) return CBS_GEOGRAPHY.SETTLEMENT;
    if (geography.includes('רשות')) return CBS_GEOGRAPHY.MUNICIPALITY;
    return CBS_GEOGRAPHY.STATISTICAL_AREA;
}

/**
 * Convert CBS data to GeoJSON features
 */
export async function convertCBSToGeoJSON(
    cbsDataPoints: CBSDataPoint[],
    geographyGeoJSON: FeatureCollection
): Promise<FeatureCollection> {
    // Create a map of geography names to GeoJSON features
    const geoMap = new Map<string, Feature>();
    geographyGeoJSON.features.forEach(feature => {
        const name = (feature.properties?.name || feature.properties?.שם || '') as string;
        geoMap.set(name.toLowerCase(), feature);
    });

    // Enrich features with CBS data
    const enrichedFeatures: Feature[] = geographyGeoJSON.features.map(feature => {
        const geoName = (feature.properties?.name || feature.properties?.שם || '') as string;
        const matchingData = cbsDataPoints.filter(
            dp => dp.geography.toLowerCase() === geoName.toLowerCase()
        );

        return {
            ...feature,
            properties: {
                ...feature.properties,
                cbsData: matchingData,
                economicIndicators: aggregateCBSMetrics(matchingData),
            },
        };
    });

    return {
        type: 'FeatureCollection',
        features: enrichedFeatures,
    };
}

/**
 * Aggregate CBS metrics for a geography
 */
function aggregateCBSMetrics(dataPoints: CBSDataPoint[]): Record<string, number | string> {
    const metrics: Record<string, number | string> = {};

    dataPoints.forEach(dp => {
        const key = `${dp.variable}_${dp.period}`;
        metrics[key] = dp.value;
    });

    return metrics;
}

/**
 * Fetch economic data by municipality with GeoJSON
 */
export async function fetchEconomicDataByMunicipality(
    municipalityGeoJSON: FeatureCollection,
    year?: number
): Promise<FeatureCollection> {
    try {
        console.log('💰 Fetching economic data for municipalities...');

        // Fetch population data
        const populationData = await fetchCBSData(CBS_TABLES.MUNICIPALITY_STATISTICS, {
            year: year || new Date().getFullYear() - 1,
        });

        // Convert to GeoJSON
        const enrichedGeoJSON = await convertCBSToGeoJSON(
            populationData,
            municipalityGeoJSON
        );

        console.log(
            `✅ Successfully enriched ${enrichedGeoJSON.features.length} features with economic data`
        );

        return enrichedGeoJSON;
    } catch (error) {
        console.error('❌ Error fetching economic data:', error);
        throw error;
    }
}

/**
 * Get specific metric across all geographies
 */
export function filterDataByMetric(
    features: FeatureCollection,
    metricKey: string
): Feature[] {
    return features.features.filter(feature => {
        const indicators = (feature.properties?.economicIndicators as Record<string, any>) || {};
        return metricKey in indicators;
    });
}

/**
 * Calculate statistics for a metric across all geographies
 */
export function calculateMetricStatistics(
    features: FeatureCollection,
    metricKey: string
): {
    min: number;
    max: number;
    avg: number;
    median: number;
    count: number;
} {
    const values = features.features
        .map(f => {
            const indicators = (f.properties?.economicIndicators as Record<string, any>) || {};
            return indicators[metricKey];
        })
        .filter((v): v is number => typeof v === 'number')
        .sort((a, b) => a - b);

    if (values.length === 0) {
        return { min: 0, max: 0, avg: 0, median: 0, count: 0 };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

    return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: sum / values.length,
        median,
        count: values.length,
    };
}

/**
 * Create a color scale based on metric values for visualization
 */
export function createMetricColorScale(
    features: FeatureCollection,
    metricKey: string,
    colorScheme: string[] = ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d']
): Map<string, string> {
    const stats = calculateMetricStatistics(features, metricKey);
    const colorMap = new Map<string, string>();

    const { min, max } = stats;
    const range = max - min || 1;

    features.features.forEach(feature => {
        const indicators = (feature.properties?.economicIndicators as Record<string, any>) || {};
        const value = indicators[metricKey] as number;

        if (value !== undefined && typeof value === 'number') {
            // Normalize to 0-1
            const normalized = (value - min) / range;
            // Map to color index
            const colorIndex = Math.floor(normalized * (colorScheme.length - 1));
            const color = colorScheme[colorIndex];

            const featureId = feature.properties?.id || feature.properties?.name || '';
            colorMap.set(featureId.toString(), color);
        }
    });

    return colorMap;
}

/**
 * Example usage and data structure documentation
 */
export const LAMAS_API_DOCUMENTATION = {
    description: 'Israel Central Bureau of Statistics (CBS) LAMAS API',
    baseUrl: 'https://lamas.cbs.gov.il',
    dataFormat: {
        example: {
            tableId: 1639,
            variable: 'אוכלוסייה',
            period: '2023',
            value: 50000,
            geography: 'תל אביב',
            geographyLevel: 'רשות מקומית',
        },
    },
    availableTables: CBS_TABLES,
    variables: CBS_VARIABLES,
    geographyLevels: CBS_GEOGRAPHY,
    notes: {
        api: 'LAMAS API - סדרות עיתיות - Time Series API',
        documentation: 'https://www.cbs.gov.il/he/cbsNewBrand/Pages/סדרות-עיתיות-באמצעות-API.aspx',
        dataCatalog: 'https://data.gov.il/api/3/action/package_search?q=cbs',
        dataAvailability: 'Most recent year data available with 3-6 month delay',
    },
};
