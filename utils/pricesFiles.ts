import { FeatureCollection } from 'geojson';
import { processFile } from './fileProcessor';

export const PRICES_CITIES = [
  'תל אביב -יפו',
  'אשדוד',
  'אשקלון',
  'באר שבע',
  'בית שמש',
  'בני ברק',
  'בת ים',
  'הרצלייה',
  'חדרה',
  'חולון',
  'חיפה',
  'ירושלים',
  'כפר סבא',
  'מודיעין-מכבים-רעות',
  'נתניה',
  'פתח תקווה',
  'ראשון לציון',
  'רחובות',
  'רמת גן',
  'רעננה'
];

export const PRICES_YEAR_START = 1998;
export const PRICES_YEAR_END = 2025;

export const getPricesYears = (): number[] => {
  const years: number[] = [];
  for (let year = PRICES_YEAR_START; year <= PRICES_YEAR_END; year += 1) {
    years.push(year);
  }
  return years;
};

export const getPricesCities = (): string[] => PRICES_CITIES;

const buildSalesRecordsUrl = (city: string, year: number): string => {
  const citySegment = encodeURIComponent(city);
  const fileName = encodeURIComponent(`${city}_${year}_deals.csv`);
  return `/data/prices/${citySegment}/${year}/${fileName}`;
};

export const loadSalesRecordsCsv = async (
  city: string,
  year: number
): Promise<FeatureCollection> => {
  const url = buildSalesRecordsUrl(city, year);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const fileName = `${city}_${year}_deals.csv`;
  const file = new File([blob], fileName, { type: 'text/csv' });

  return processFile(file);
};
