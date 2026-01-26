import { Feature } from 'geojson';

/**
 * Direct REST API for nadlan.gov.il
 * This service provides detailed transaction info including Gush/Chelka.
 */
const NADLAN_GOV_URL = 'https://www.nadlan.gov.il/Nadlan.REST/Main/GetResaults';

interface NadlanGovResult {
  ALL_DEALS: {
    DEAL_AMOUNT: string;
    DEAL_DATE: string;
    GUSH: string;
    CHELKA: string;
    ASSET_TYPE: string;
    ROOMS_NUM: string;
    SQUARE_MEASURES: string;
    BUILD_YEAR: string;
    FULL_ADRESS: string;
    [key: string]: any;
  }[];
}

/**
 * Fetches detailed transactions from the main Nadlan portal.
 */
export const fetchDetailedNadlanTransactions = async (city: string): Promise<Feature[]> => {
  // allorigins 'get' expects a full URL. The main nadlan portal works best with a direct query string.
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(NADLAN_GOV_URL + "?query=" + city + "&type=1")}`;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Connection to Nadlan Portal failed");
    
    const proxyData = await response.json();
    if (!proxyData.contents) return [];
    
    const data: NadlanGovResult = JSON.parse(proxyData.contents);

    if (!data.ALL_DEALS || data.ALL_DEALS.length === 0) {
      return [];
    }

    return data.ALL_DEALS.map((deal, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        // Default location if geocoding is missing, allowing it to show in Data View
        coordinates: [34.8516, 31.0461] 
      },
      properties: {
        id: `portal-${index}-${Date.now()}`,
        name: `${deal.ASSET_TYPE || 'Property'} - ${deal.DEAL_AMOUNT || '0'} ₪`,
        address: deal.FULL_ADRESS || 'Unknown Address',
        amount: `${deal.DEAL_AMOUNT || '0'} ₪`,
        date: deal.DEAL_DATE || 'Unknown',
        gush: deal.GUSH || 'N/A',
        chelka: deal.CHELKA || 'N/A',
        rooms: deal.ROOMS_NUM || '0',
        area: `${deal.SQUARE_MEASURES || '0'} sqm`,
        year: deal.BUILD_YEAR || 'Unknown',
        category: 'Real Estate Transaction (Portal)',
        source: 'nadlan.gov.il'
      }
    }));
  } catch (error) {
    console.warn("Portal fetch failed, falling back to ArcGIS service:", error);
    // Fallback to the more reliable (but sometimes less detailed) GIS service
    return fetchRealEstateTransactions(city);
  }
};

/**
 * ArcGIS REST API Endpoint for Real Estate Sales on Govmap.il
 */
const GOVMAP_NADLAN_URL = 'https://gis.govmap.gov.il/arcgis/rest/services/Nadlan/Nadlan_Sales/MapServer/0/query';

export const fetchRealEstateTransactions = async (city: string, limit: number = 100): Promise<Feature[]> => {
  // Clean city input to avoid syntax issues in 'where' clause
  const cleanCity = city.replace(/['"]/g, '');

  const params = new URLSearchParams({
    // Using a more standard ArcGIS where clause. 
    // LIKE '%...%' is often the cause of 400 if the server is strict or indices are missing.
    where: `SETL_NAME LIKE '%${cleanCity}%'`,
    // Explicitly listing fields is more robust than '*' on many older ArcGIS servers.
    outFields: 'OBJECTID,SETL_NAME,STREET_NAME,HOUSE_NUM,DEAL_AMOUNT,DEAL_DATE,ASSET_TYPE,ROOMS_NUM,SQUARE_MEASURES,BUILD_YEAR,GUSH,CHELKA,BLOCK,PARCEL',
    returnGeometry: 'true',
    f: 'json',
    outSR: '4326',
    resultRecordCount: limit.toString(),
    // REMOVED orderByFields: 'DEAL_DATE DESC' as it's a common source of 400 errors if field is not sortable/indexed.
    _t: Date.now().toString()
  });

  const targetUrl = `${GOVMAP_NADLAN_URL}?${params.toString()}`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  try {
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
        throw new Error(`שגיאת תקשורת (${response.status}). ייתכן ששרתי הממשלה עמוסים או שהשאילתה לא תקינה.`);
    }
    
    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "שגיאה פנימית בשירות הממשלתי");

    const esriFeatures = data.features || [];
    
    return esriFeatures.map((ef: any) => {
      const attr = ef.attributes;
      
      // Formatting date
      let dateStr = 'לא ידוע';
      if (attr.DEAL_DATE) {
          const d = new Date(attr.DEAL_DATE);
          if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('he-IL');
      }
      
      // Amount formatting
      const amountRaw = attr.DEAL_AMOUNT || attr.DEAL_VALUE || 0;
      const amount = amountRaw.toLocaleString();

      // Mapping common Hebrew/English field variations for Gush/Parcel
      const gush = attr.GUSH || attr.GUSH_NUM || attr.BLOCK || 'לא זמין';
      const chelka = attr.CHELKA || attr.PARCEL || attr.PARCEL_NUM || 'לא זמין';

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [ef.geometry.x, ef.geometry.y]
        },
        properties: {
          id: `govmap-${attr.OBJECTID || Math.random()}`,
          name: `${attr.ASSET_TYPE || 'נכס'} - ${amount} ₪`,
          address: `${attr.STREET_NAME || ''} ${attr.HOUSE_NUM || ''}, ${attr.SETL_NAME || ''}`,
          amount: `${amount} ₪`,
          date: dateStr,
          gush: gush,
          chelka: chelka,
          rooms: attr.ROOMS_NUM || attr.ROOMS || '0',
          area: `${attr.SQUARE_MEASURES || attr.AREA || 0} מ"ר`,
          year: attr.BUILD_YEAR || 'לא ידוע',
          category: 'נדל"ן ממשלתי',
          source: 'Govmap.il'
        }
      };
    });
  } catch (error: any) {
    console.error("Nadlan API Error:", error);
    // If the LIKE query fails, try one last attempt with exact match if possible, 
    // or just re-throw to let the user know.
    throw new Error(error.message || "Failed to fetch data. Try a different city name.");
  }
};