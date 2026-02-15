// TEMPLATE: Copy this file to create new analyses
// 1. Rename file to match your analysis (e.g., schoolsAnalysis.ts)
// 2. Update the interface name and parameters
// 3. Implement your analysis logic
// 4. Export from analyses/index.ts
// 5. Add wrapper function in useResearchAnalysis.ts
// 6. Add new row in AnalysisTable.tsx

import { Layer } from '../../../types';
import { Feature, Polygon, MultiPolygon } from 'geojson';
import { 
    separateIsochroneLayers, 
    clip, 
    calculateArea 
} from '../../../utils/gisToolbox';
import { AnalysisResults } from '../types';

interface NewAnalysisParams {
    samplePointLocation: { lat: number; lng: number } | null;
    storedIsochrones: any;  // Required if you need the isochrone zones
    analysisResults?: AnalysisResults;  // Optional if you need other analysis data
    onAddLayer?: (layer: Layer) => void;
    setAnalysisResults: React.Dispatch<React.SetStateAction<AnalysisResults>>;
    setRunningAnalysis: (analysis: string | null) => void;
}

export const runNewAnalysis = async ({
    samplePointLocation,
    storedIsochrones,
    analysisResults,
    onAddLayer,
    setAnalysisResults,
    setRunningAnalysis
}: NewAnalysisParams) => {
    // Validation
    if (!samplePointLocation) {
        alert('Please select a point on the map first');
        return;
    }

    if (!storedIsochrones) {
        alert('Please run Isochrone Area analysis first');
        return;
    }

    setRunningAnalysis('newAnalysis');  // Change this ID
    
    try {
        console.log('🎯 Running New Analysis...');
        
        // Example: Fetch data from an API or GIS server
        const dataUrl = 'YOUR_GIS_URL_HERE';
        const response = await fetch(dataUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Fetched data:', data.features.length, 'features');
        
        // Optional: Add original layer to map
        if (onAddLayer) {
            const originalLayer: Layer = {
                id: `new-analysis-original-${Date.now()}`,
                name: `🎯 Your Data (Original)`,
                visible: true,
                data: data,
                color: '#3b82f6',
                opacity: 0.5,
                type: 'polygon',  // or 'point' for point data
                grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                lastUpdated: Date.now()
            };
            onAddLayer(originalLayer);
        }
        
        // Separate isochrone zones
        const separatedZones = separateIsochroneLayers(storedIsochrones);
        const [zone5Layer, zone10Layer, zone15Layer] = separatedZones;
        
        // Get polygons
        const zone5Polygon = zone5Layer.features[0] as Feature<Polygon | MultiPolygon>;
        const zone10Polygon = zone10Layer.features[0] as Feature<Polygon | MultiPolygon>;
        const zone15Polygon = zone15Layer.features[0] as Feature<Polygon | MultiPolygon>;
        
        // Clip data to each zone
        const clippedZone5 = clip(data.features, zone5Polygon);
        const clippedZone10 = clip(data.features, zone10Polygon);
        const clippedZone15 = clip(data.features, zone15Polygon);
        
        // Calculate your metrics (example: area, count, density, etc.)
        const zone5Value = clippedZone5.length;  // Example: count features
        const zone10Value = clippedZone10.length;
        const zone15Value = clippedZone15.length;
        
        // Optional: Add clipped layers to map
        if (onAddLayer) {
            onAddLayer({
                id: `new-analysis-zone5-${Date.now()}`,
                name: `🎯 Zone 5 min`,
                visible: true,
                data: { type: 'FeatureCollection', features: clippedZone5 },
                color: '#22c55e',
                opacity: 0.6,
                type: 'polygon',
                grid: { show: false, showLabels: false, size: 1, opacity: 0.5 },
                lastUpdated: Date.now()
            });
            
            // Add zone10 and zone15 layers similarly...
        }
        
        // Calculate scores (1-5 scale)
        const calculateScore = (value: number): number => {
            // Implement your scoring logic
            // Example: normalize to 1-5 scale
            return Math.min(5, Math.max(1, value / 10));
        };
        
        const scores = {
            zone5: calculateScore(zone5Value),
            zone10: calculateScore(zone10Value),
            zone15: calculateScore(zone15Value)
        };
        
        // Update analysis results
        // NOTE: You need to add these fields to AnalysisResults interface in types.ts first!
        setAnalysisResults(prev => ({
            ...prev,
            newAnalysisData: { zone5: zone5Value, zone10: zone10Value, zone15: zone15Value },
            newAnalysisScores: scores
        }));
        
        console.log('✅ New Analysis completed:', { data: { zone5Value, zone10Value, zone15Value }, scores });

    } catch (error) {
        console.error('❌ Error in new analysis:', error);
        alert(`Failed to run new analysis: ${error}`);
    } finally {
        setRunningAnalysis(null);
    }
};

/*
STEPS TO INTEGRATE THIS ANALYSIS:

1. Add to types.ts - Update AnalysisResults interface:
   export interface AnalysisResults {
       ...existing fields...
       newAnalysisData: { zone5: number | null; zone10: number | null; zone15: number | null };
       newAnalysisScores: { zone5: number | null; zone10: number | null; zone15: number | null };
   }

2. Export from analyses/index.ts:
   export { runNewAnalysis } from './newAnalysis';

3. Add to useResearchAnalysis.ts:
   import { ..., runNewAnalysis } from './analyses';
   
   const handleNewAnalysis = async (samplePointLocation: { lat: number; lng: number } | null) => {
       await runNewAnalysis({
           samplePointLocation,
           storedIsochrones,
           onAddLayer,
           setAnalysisResults,
           setRunningAnalysis
       });
   };
   
   return {
       ...existing returns...,
       handleNewAnalysis
   }

4. Initialize in useResearchAnalysis.ts state:
   const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({
       ...existing fields...,
       newAnalysisData: { zone5: null, zone10: null, zone15: null },
       newAnalysisScores: { zone5: null, zone10: null, zone15: null }
   });

5. Add row to AnalysisTable.tsx:
   <tr>
       <td className="indicator-name">
           <div className="indicator-title">🎯 Your Analysis Name</div>
           <div className="indicator-description">Description of what this measures</div>
       </td>
       <td>
           {analysisResults.newAnalysisData.zone5 !== null 
               ? `${analysisResults.newAnalysisData.zone5.toLocaleString()} units`
               : '-'}
       </td>
       <td>{analysisResults.newAnalysisData.zone10 !== null ? `${analysisResults.newAnalysisData.zone10.toLocaleString()} units` : '-'}</td>
       <td>{analysisResults.newAnalysisData.zone15 !== null ? `${analysisResults.newAnalysisData.zone15.toLocaleString()} units` : '-'}</td>
       <td>
           {analysisResults.newAnalysisScores.zone5 !== null && (
               <Tooltip title="Detailed explanation">
                   <span>⭐ {analysisResults.newAnalysisScores.zone5.toFixed(2)}</span>
               </Tooltip>
           )}
       </td>
       <td>
           <button 
               onClick={() => handleNewAnalysis(samplePointLocation)}
               disabled={runningAnalysis === 'newAnalysis'}
           >
               {runningAnalysis === 'newAnalysis' ? 'Running...' : 'Run'}
           </button>
       </td>
   </tr>
*/
