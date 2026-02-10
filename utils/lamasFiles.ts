import { Layer } from '../types';
import { FeatureCollection } from 'geojson';

// Field metadata for MIFKAD 2022 dataset - Census 2022 Statistical Areas
export const MIFKAD_FIELD_METADATA = [
  // Identifiers
  { field: 'OBJECTID', hebrewName: 'מזהה פנימי', category: 'מזהים' },
  { field: 'SHEM_YISHUV_HEB', hebrewName: 'שם יישוב בעברית', category: 'מזהים' },
  { field: 'SHEM_YISHUV_ENG', hebrewName: 'תעתיק באנגלית של שם היישוב', category: 'מזהים' },
  { field: 'SEMEL_YISHUV', hebrewName: 'סמל יישוב', category: 'מזהים' },
  { field: 'YISHUV_STAT_2022', hebrewName: 'מספר אזור סטטיסטי ייחודי ארצי', category: 'מזהים' },
  { field: 'STAT_2022', hebrewName: 'מספר אזור סטטיסטי ביישוב', category: 'מזהים' },
  { field: 'Stat2022_Unite', hebrewName: 'איחוד אזורים סטטיסטיים לצורכי פרסום', category: 'מזהים' },
  { field: 'Stat2022 Ref', hebrewName: 'אזורים סטטיסטיים שנתוניהם מופיעים ב-Stat2022_Unite', category: 'מזהים' },
  { field: 'Main_Function_Code', hebrewName: 'תפקוד עיקרי לאזור סטטיסטי - קוד', category: 'מזהים' },
  { field: 'Main_Function_Txt', hebrewName: 'תפקוד עיקרי לאזור סטטיסטי - תיאור', category: 'מזהים' },
  { field: 'ROVA', hebrewName: 'מספר רובע', category: 'מזהים' },
  { field: 'TAT_ROVA', hebrewName: 'מספר תת-רובע', category: 'מזהים' },
  { field: 'Religion_Stat_Code', hebrewName: 'דת עיקרית לאזור סטטיסטי - קוד', category: 'מזהים' },
  { field: 'Religion_Stat_Txt', hebrewName: 'דת עיקרית לאזור סטטיסטי - תיאור', category: 'מזהים' },
  
  // Population
  { field: 'pop_approx', hebrewName: 'סך הכל אוכלוסייה', category: 'דמוגרפיה' },
  { field: 'change_pcnt', hebrewName: 'אחוז שינוי ממפקד האוכלוסין 2008', category: 'דמוגרפיה' },
  { field: 'pop_density', hebrewName: 'צפיפות אוכלוסייה (קמ"ר)', category: 'דמוגרפיה' },
  { field: 'sexRatio', hebrewName: 'יחס מינים', category: 'דמוגרפיה' },
  { field: 'inst_pcnt', hebrewName: 'אחוז דיירי מוסדות', category: 'דמוגרפיה' },
  { field: 'Foreign_pcnt', hebrewName: 'אחוז זרים', category: 'דמוגרפיה' },
  
  // Age
  { field: 'age0_19_pcnt', hebrewName: 'אחוז בני 0-19', category: 'גילאים' },
  { field: 'age20_64_pcnt', hebrewName: 'אחוז בני 20-64', category: 'גילאים' },
  { field: 'age65_pcnt', hebrewName: 'אחוז בני 65 ומעלה', category: 'גילאים' },
  { field: 'DependencyRatio', hebrewName: 'יחס תלות לאלף נפשות', category: 'גילאים' },
  { field: 'age_median', hebrewName: 'גיל חציוני', category: 'גילאים' },
  { field: 'm_age_median', hebrewName: 'גיל חציוני - זכרים', category: 'גילאים' },
  { field: 'w_age_median', hebrewName: 'גיל חציוני - נקבות', category: 'גילאים' },
  
  // Marriage
  { field: 'married18_34_pcnt', hebrewName: 'אחוז נשואים בני 18-34', category: 'דמוגרפיה' },
  { field: 'married45_54_pcnt', hebrewName: 'אחוז נשואים בני 45-54', category: 'דמוגרפיה' },
  { field: 'MarriageAge_mdn', hebrewName: 'גיל נישואין חציוני', category: 'דמוגרפיה' },
  { field: 'm_MarriageAge_mdn', hebrewName: 'גיל נישואין חציוני - זכרים', category: 'דמוגרפיה' },
  { field: 'w_MarriageAge_mdn', hebrewName: 'גיל נישואין חציוני - נקבות', category: 'דמוגרפיה' },
  { field: 'ChldBorn_avg', hebrewName: 'מספר ילדים ממוצע לאישה', category: 'דמוגרפיה' },
  
  // Origin
  { field: 'j_isr_pcnt', hebrewName: 'יהודים ואחרים ילידי ישראל', category: 'מוצא' },
  { field: 'j_abr_pcnt', hebrewName: 'יהודים ואחרים ילידי חו"ל', category: 'מוצא' },
  { field: 'aliya2002_pcnt', hebrewName: 'אחוז יהודים ואחרים שעלו משנת 2002 ואילך', category: 'מוצא' },
  { field: 'aliya2010_pcnt', hebrewName: 'אחוז יהודים ואחרים שעלו משנת 2010 ואילך', category: 'מוצא' },
  { field: 'israel_pcnt', hebrewName: 'אחוז יהודים ואחרים שיבשת מוצאם ישראל', category: 'מוצא' },
  { field: 'asia_pcnt', hebrewName: 'אחוז יהודים ואחרים שיבשת מוצאם אסיה', category: 'מוצא' },
  { field: 'africa_pcnt', hebrewName: 'אחוז יהודים ואחרים שיבשת מוצאם אפריקה', category: 'מוצא' },
  { field: 'europe_pcnt', hebrewName: 'אחוז יהודים ואחרים שיבשת מוצאם אירופה', category: 'מוצא' },
  { field: 'america_pcnt', hebrewName: 'אחוז יהודים ואחרים שיבשת מוצאם אמריקה ואוקיאניה', category: 'מוצא' },
  { field: 'shem_eretz1', hebrewName: 'שם ארץ מוצא עיקרית', category: 'מוצא' },
  
  // Disability
  { field: 'koshi5_pcnt', hebrewName: 'אחוז בני 5 ומעלה עם קשיים תפקודיים', category: 'מוגבלות' },
  { field: 'koshi65_pcnt', hebrewName: 'אחוז בני 65 ומעלה עם קשיים תפקודיים', category: 'מוגבלות' },
  
  // Education
  { field: 'AcadmCert_pcnt', hebrewName: 'אחוז בני 15 ומעלה בעלי השכלה אקדמית', category: 'חינוך' },
  
  // Employment
  { field: 'WrkY_pcnt', hebrewName: 'אחוז בני 15 ומעלה שעבדו ב-12 החודשים האחרונים', category: 'תעסוקה' },
  { field: 'Empl_pcnt', hebrewName: 'אחוז שכירים', category: 'תעסוקה' },
  { field: 'SelfEmpl_pcnt', hebrewName: 'אחוז עצמאים', category: 'תעסוקה' },
  { field: 'HrsWrkWk_avg', hebrewName: 'ממוצע שעות עבודה', category: 'תעסוקה' },
  { field: 'Wrk_15_17_pcnt', hebrewName: 'אחוז בני 15-17 שעבדו', category: 'תעסוקה' },
  { field: 'WrkOutLoc_pcnt', hebrewName: 'אחוז עובדים מחוץ ליישוב המגורים', category: 'תעסוקה' },
  
  // Income
  { field: 'employeesAnnual_medWage', hebrewName: 'הכנסה חציונית שנתית של שכירים', category: 'כלכלה' },
  { field: 'EmployeesWage_decile9Up', hebrewName: 'אחוז שכירים בעשירוני הכנסה 9-10', category: 'כלכלה' },
  { field: 'SelfEmployedAnnual_medWage', hebrewName: 'הכנסה חציונית שנתית של עצמאים', category: 'כלכלה' },
  { field: 'SelfEmployedWage_decile9Up', hebrewName: 'אחוז עצמאים בני 15 ומעלה לפי עשירוני הכנסה 9-10', category: 'כלכלה' },
  
  // Households
  { field: 'hh_total_approx', hebrewName: 'סך הכל משקי בית', category: 'דיור' },
  { field: 'size_avg', hebrewName: 'ממוצע נפשות במשק הבית', category: 'דיור' },
  { field: 'hh0_5_pcnt', hebrewName: 'אחוז משקי בית עם בני 0-5', category: 'דיור' },
  { field: 'hh18_24_pcnt', hebrewName: 'אחוז משקי בית עם בני 18-24', category: 'דיור' },
  { field: 'hh_MidatDatiyut', hebrewName: 'סמל אורח חיים עיקרי (מידת דתיות)', category: 'דיור' },
  { field: 'hh_MidatDatiyut_Name', hebrewName: 'שם אורח חיים עיקרי (מידת דתיות)', category: 'דיור' },
  { field: 'Computer_avg', hebrewName: 'ממוצע מחשבים במשק הבית', category: 'דיור' },
  { field: 'Vehicle0_pcnt', hebrewName: 'אחוז משקי בית ללא רכב', category: 'תחבורה' },
  { field: 'Vehicle2up_pcnt', hebrewName: 'אחוז משקי בית עם 2 רכבים ויותר', category: 'תחבורה' },
  { field: 'Parking_pcnt', hebrewName: 'אחוז משקי בית עם חנייה', category: 'תחבורה' },
  { field: 'own_pcnt', hebrewName: 'אחוז משקי בית בדירה בבעלות', category: 'דיור' },
  { field: 'rent_pcnt', hebrewName: 'אחוז משקי בית בדירה בשכירות', category: 'דיור' },
  
  // Geometry
  { field: 'Shape_Length', hebrewName: 'היקף במטרים', category: 'גיאומטריה' },
  { field: 'Shape_Area', hebrewName: 'שטח במטרים מרובעים', category: 'גיאומטריה' },
];

// Main function codes lookup - תפקוד עיקרי לאזור סטטיסטי
export const MAIN_FUNCTION_CODES: Record<number, string> = {
  1: 'מגורים',
  2: 'תעשיה',
  4: 'שטח פתוח',
  5: 'מוסדי',
  6: 'מתחם ציבורי'
};

// Religion codes lookup - נתוני דת
export const RELIGION_CODES: Record<number, string> = {
  1: 'יהודי',
  2: 'מוסלמי',
  3: 'נוצרי',
  5: 'דרוזי',
  6: 'דת אחרת'
};

// Available LAMAS files
export const AVAILABLE_LAMAS_FILES = [
  {
    id: 'mifkad2022',
    name: 'מפקד 2022 - נתוני אוכלוסין',
    filename: 'mifkad2022.geojson',
    description: 'נתוני מפקד האוכלוסין 2022 ברמת אזור סטטיסטי',
    year: 2022,
    fieldMetadata: MIFKAD_FIELD_METADATA
  }
];

/**
 * Load LAMAS file from local or external source
 */
export async function loadLamasFile(
  fileId: string,
  externalUrl?: string
): Promise<FeatureCollection> {
  const fileInfo = AVAILABLE_LAMAS_FILES.find(f => f.id === fileId);
  
  if (!fileInfo) {
    throw new Error(`LAMAS file not found: ${fileId}`);
  }

  try {
    // Try external URL first if provided
    if (externalUrl) {
      const response = await fetch(externalUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from external URL: ${response.statusText}`);
      }
      return await response.json();
    }

    // Otherwise, load from local public folder
    const localPath = `/data/lamas/${fileInfo.filename}`;
    const response = await fetch(localPath);
    
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Validate GeoJSON structure
    if (!data.type || data.type !== 'FeatureCollection') {
      throw new Error('Invalid GeoJSON: missing or incorrect type');
    }
    
    if (!Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON: features is not an array');
    }

    return data as FeatureCollection;
  } catch (error) {
    console.error('Error loading LAMAS file:', error);
    throw error;
  }
}

/**
 * Filter features by municipality
 */
export function filterByMunicipality(
  geojson: FeatureCollection,
  municipalityName: string
): FeatureCollection {
  const filtered = {
    ...geojson,
    features: geojson.features.filter(feature => {
      const props = feature.properties || {};
      return (
        props.SHEM_YISHUV === municipalityName ||
        props.MUNICIPAL_NAME === municipalityName ||
        props.municipality === municipalityName
      );
    })
  };

  return filtered;
}

/**
 * Get unique municipalities from a GeoJSON dataset
 */
export function getUniqueMunicipalities(geojson: FeatureCollection): string[] {
  const municipalitySet = new Set<string>();

  geojson.features.forEach(feature => {
    const props = feature.properties || {};
    const municipality = props.SHEM_YISHUV || props.MUNICIPAL_NAME || props.municipality;
    
    if (municipality && typeof municipality === 'string') {
      municipalitySet.add(municipality);
    }
  });

  return Array.from(municipalitySet).sort((a, b) => a.localeCompare(b, 'he'));
}

/**
 * Get unique localities from SHEM_YISHUV_ENG field (English names)
 */
export function getUniqueLocalities(geojson: FeatureCollection): string[] {
  const localitySet = new Set<string>();

  geojson.features.forEach(feature => {
    const props = feature.properties || {};
    const locality = props.SHEM_YISHUV_ENG;
    
    if (locality && typeof locality === 'string') {
      localitySet.add(locality);
    }
  });

  return Array.from(localitySet).sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * Filter features by locality (SHEM_YISHUV_ENG)
 */
export function filterByLocality(
  geojson: FeatureCollection,
  localityName: string
): FeatureCollection {
  if (localityName === 'All') {
    return geojson;
  }

  const filtered = {
    ...geojson,
    features: geojson.features.filter(feature => {
      const props = feature.properties || {};
      return props.SHEM_YISHUV_ENG === localityName;
    })
  };

  return filtered;
}

/**
 * Get Hebrew name for a field from MIFKAD metadata
 * Returns the Hebrew name if found, otherwise returns the original field name
 */
export function getFieldHebrewName(fieldName: string): string {
  const metadata = MIFKAD_FIELD_METADATA.find(m => m.field === fieldName);
  return metadata?.hebrewName || fieldName;
}
