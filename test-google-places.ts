import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
function loadEnv(): Record<string, string> {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const env: Record<string, string> = {};
    
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return env;
  } catch (error) {
    console.error('❌ Error loading .env.local:', error);
    return {};
  }
}

const env = loadEnv();
const GOOGLE_PLACES_API_KEY = env.GOOGLE_PLACES_API || '';

console.log('\n🧪 Testing Google Places API Connection\n');
console.log(`API Key loaded: ${GOOGLE_PLACES_API_KEY ? '✓ Yes' : '✗ No'}`);
console.log(`API Key value: ${GOOGLE_PLACES_API_KEY.substring(0, 30)}...`);

if (!GOOGLE_PLACES_API_KEY) {
  console.error('\n❌ ERROR: Google Places API key not found in .env.local');
  console.error('Make sure you have: GOOGLE_PLACES_API=your_key_here');
  process.exit(1);
}

// Use real coordinates: Tel Aviv, Israel (32.0853, 34.7818)
const lat = 32.0853;
const lng = 34.7818;
const radius = 1000;
const type = 'restaurant';

const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_PLACES_API_KEY}`;

console.log(`\n📍 Testing with coordinates: ${lat}, ${lng}`);
console.log(`🔍 Search type: ${type}`);
console.log(`📏 Radius: ${radius}m`);

console.log(`\n🔗 Making request to Google Places API...\n`);

fetch(url)
  .then(async (response) => {
    console.log(`Response status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    
    const text = await response.text();
    console.log(`\nResponse length: ${text.length} bytes`);
    console.log(`First 200 chars: ${text.substring(0, 200)}`);
    
    if (!text) {
      console.error('\n❌ ERROR: Empty response from Google Places API');
      console.error('This might mean:');
      console.error('  - API key is invalid');
      console.error('  - API is not enabled');
      console.error('  - Network/firewall issue');
      process.exit(1);
    }
    
    try {
      const data = JSON.parse(text);
      console.log(`\n✅ SUCCESS! Got valid JSON response`);
      console.log(`Status: ${data.status}`);
      console.log(`Results found: ${data.results?.length || 0}`);
      
      if (data.results && data.results.length > 0) {
        console.log(`\nFirst result:`);
        const first = data.results[0];
        console.log(`  Name: ${first.name}`);
        console.log(`  Address: ${first.vicinity}`);
        console.log(`  Lat/Lng: ${first.geometry.location.lat}, ${first.geometry.location.lng}`);
      }
      
      if (data.error_message) {
        console.error(`\n⚠️  API Error: ${data.error_message}`);
      }
    } catch (parseError) {
      console.error('\n❌ ERROR: Response is not valid JSON');
      console.error(`Parse error: ${parseError}`);
      console.error(`Full response: ${text}`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error(`\n❌ ERROR: Failed to reach Google Places API`);
    console.error(`Error: ${error.message}`);
    console.error('\nThis might mean:');
    console.error('  - Network connection issue');
    console.error('  - DNS resolution problem');
    console.error('  - Firewall blocking the request');
    process.exit(1);
  });
