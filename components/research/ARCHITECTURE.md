# Research Analysis Architecture

## 📁 File Structure

```
components/research/
├── types.ts                    # TypeScript interfaces
├── constants.ts                # Configuration values
├── useResearchAnalysis.ts      # Main hook (87 lines) ✅
├── AnalysisTable.tsx          # Results display table
├── index.ts                   # Barrel exports
└── analyses/                  # Individual analysis functions
    ├── index.ts               # Analysis exports
    ├── isochroneAreaAnalysis.ts    (97 lines)
    ├── gardensAnalysis.ts          (176 lines)
    ├── busStationsAnalysis.ts      (139 lines)
    └── TEMPLATE_newAnalysis.ts     # Copy this to add new analyses
```

## ✅ Benefits of This Structure

1. **Maintainable**: Each analysis is in its own file (~100-200 lines)
2. **Scalable**: Easy to add 10+ more analyses without clutter
3. **Testable**: Each analysis can be tested independently
4. **Readable**: Clear separation of concerns
5. **Reusable**: Analysis functions can be used elsewhere if needed

## 🚀 Adding New Analyses (Quick Guide)

### 1. Create Analysis File
```bash
# Copy the template
cp analyses/TEMPLATE_newAnalysis.ts analyses/schoolsAnalysis.ts
```

### 2. Update Types (types.ts)
```typescript
export interface AnalysisResults {
    // Existing
    isochroneArea: { zone5: number | null; zone10: number | null; zone15: number | null };
    gardens: { zone5: number | null; zone10: number | null; zone15: number | null };
    
    // Add yours
    schools: { zone5: number | null; zone10: number | null; zone15: number | null };
    schoolScores: { zone5: number | null; zone10: number | null; zone15: number | null };
}
```

### 3. Export Analysis (analyses/index.ts)
```typescript
export { runIsochroneAreaAnalysis } from './isochroneAreaAnalysis';
export { runGardensAnalysis } from './gardensAnalysis';
export { runBusStationsAnalysis } from './busStationsAnalysis';
export { runSchoolsAnalysis } from './schoolsAnalysis';  // Add this
```

### 4. Add Hook Wrapper (useResearchAnalysis.ts)
```typescript
import { 
    runIsochroneAreaAnalysis, 
    runGardensAnalysis, 
    runBusStationsAnalysis,
    runSchoolsAnalysis  // Add import
} from './analyses';

// In the hook:
const handleSchoolsAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
    await runSchoolsAnalysis({
        samplePointLocation,
        storedIsochrones,
        onAddLayer,
        setAnalysisResults,
        setRunningAnalysis
    });
};

// In return:
return {
    analysisResults,
    runningAnalysis,
    calculateTransitScore,
    handleIsochroneAreaAnalysis,
    handleGardensAnalysis,
    handleBusStationsAnalysis,
    handleSchoolsAnalysis  // Add this
};
```

### 5. Initialize State (useResearchAnalysis.ts)
```typescript
const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({
    isochroneArea: { zone5: null, zone10: null, zone15: null },
    gardens: { zone5: null, zone10: null, zone15: null },
    gardenScores: { zone5: null, zone10: null, zone15: null },
    busStations: { zone5: null, zone10: null, zone15: null },
    busStationScores: { zone5: null, zone10: null, zone15: null },
    schools: { zone5: null, zone10: null, zone15: null },  // Add
    schoolScores: { zone5: null, zone10: null, zone15: null }  // Add
});
```

### 6. Add Table Row (AnalysisTable.tsx)
Copy an existing row and modify it for your new analysis.

## 📊 Analysis Template Pattern

Every analysis follows this pattern:

```typescript
export const runYourAnalysis = async ({
    samplePointLocation,
    storedIsochrones,
    onAddLayer,
    setAnalysisResults,
    setRunningAnalysis
}: YourAnalysisParams) => {
    // 1. Validate inputs
    if (!samplePointLocation || !storedIsochrones) return;
    
    setRunningAnalysis('yourAnalysis');
    
    try {
        // 2. Fetch data
        const data = await fetch('GIS_URL').then(r => r.json());
        
        // 3. Separate isochrone zones
        const [zone5, zone10, zone15] = separateIsochroneLayers(storedIsochrones);
        
        // 4. Clip data to zones
        const clipped5 = clip(data.features, zone5.features[0]);
        const clipped10 = clip(data.features, zone10.features[0]);
        const clipped15 = clip(data.features, zone15.features[0]);
        
        // 5. Calculate metrics
        const results = {
            zone5: calculateMetric(clipped5),
            zone10: calculateMetric(clipped10),
            zone15: calculateMetric(clipped15)
        };
        
        // 6. Calculate scores
        const scores = {
            zone5: calculateScore(results.zone5),
            zone10: calculateScore(results.zone10),
            zone15: calculateScore(results.zone15)
        };
        
        // 7. Add layers to map (optional)
        if (onAddLayer) {
            onAddLayer(createLayer(clipped5, 'Zone 5'));
        }
        
        // 8. Update state
        setAnalysisResults(prev => ({
            ...prev,
            yourAnalysis: results,
            yourAnalysisScores: scores
        }));
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to run analysis');
    } finally {
        setRunningAnalysis(null);
    }
};
```

## 🎯 10 Suggested Analyses to Add

Based on Tel Aviv GIS layers, here are ideas:

1. **Schools** - Educational facilities proximity
2. **Kindergartens** - Early childhood education access
3. **Supermarkets** - Food accessibility
4. **Pharmacies** - Healthcare access
5. **Cultural Centers** - Community facilities
6. **Sports Facilities** - Recreation access
7. **Cafes/Restaurants** - Urban vibrancy indicator
8. **Parks** - Additional green space metrics
9. **Bike Lanes** - Cycling infrastructure
10. **Parking** - Car accessibility

Each can follow the same pattern: fetch layer → clip to zones → calculate metrics → display results.

## 🔧 Utility Functions Available

From `utils/gisToolbox.ts`:
- `generateWalkingIsochrones()` - Create walking distance polygons
- `separateIsochroneLayers()` - Split into 5/10/15 min zones
- `clip()` - Clip features by polygon
- `difference()` - Get unique features in rings
- `calculateArea()` - Calculate polygon area in m²
- `duplicateLayer()` - Deep copy layer data

## 📝 Notes

- All areas calculated in m², displayed as km² (divide by 1,000,000)
- Scores typically on 1-5 scale
- Zone multipliers: 5min = 1.0, 10min = 0.6-0.7, 15min = 0.3
- Use square root for diminishing returns: `Math.sqrt(count)`
- Always include try-catch with user-friendly error messages
- Console.log with emojis for easy debugging 🎯 ✅ ❌

## 🎉 You're Ready!

The architecture is now clean and scalable. Adding 10 more analyses will be straightforward - just follow the template!
