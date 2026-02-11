# Research Tab - Multi-Criteria Urban Accessibility Model

## Overview

The Research tab implements a sophisticated **Multi-Criteria Urban Accessibility Model** that calculates a weighted quality score (1-5) for any point in a city based on its 15-minute walking environment.

## Core Methodology

### Triple Isochrone Weighted Method

Instead of using simple circular buffers, the system employs three concentric walking-time zones (isochrones):

- **Zone A (0-5 min)**: Immediate proximity. High impact on daily life. **Multiplier: 1.0**
- **Zone B (5-10 min)**: Short walk. Moderate impact. **Multiplier: 0.6**
- **Zone C (10-15 min)**: Edge of accessibility. Lower impact. **Multiplier: 0.3**

### Scoring Formula

The final quality score is calculated using:

```
S_indicator = Σ(Score × ZoneMultiplier) / Σ(ZoneMultipliers)

S_total = (W_urban · S̄_urban) + (W_social · S̄_social) + (W_econ · S̄_econ) + (W_hist · S̄_hist)
```

Where:
- **S_indicator**: Score for a specific indicator (1-5)
- **S_total**: Final weighted quality score
- **W**: User-defined category weight (0-100%)
- **S̄**: Average score of all indicators in a category

## Features

### 1. Sample Point Configuration

- **Single Point Mode**: Analyze a specific location
- **Grid Sampling Mode**: Generate a heatmap across an area (planned)
- **Interactive Map Selection**: Click on the map to select analysis points

### 2. Category Weighting

Adjust the importance of four main pillars:

#### **Urban Infrastructure** (Blue)
- Green Spaces & Parks
- Public Transport Stops
- Bike Infrastructure
- Parking Availability

#### **Social Services** (Green)
- Educational Institutions
- Healthcare Facilities
- Community Centers
- Sports & Recreation

#### **Economic Vitality** (Orange)
- Commercial Density
- Retail & Shopping
- Employment Centers
- Real Estate Prices

#### **Historical & Cultural** (Purple)
- Heritage Sites
- Monuments & Landmarks
- Conservation Areas

### 3. Indicator Selection

- Toggle individual indicators on/off
- Each indicator has:
  - **Zone Sensitivity**: High/Medium/Low (how much distance matters)
  - **Data Source**: OSM, Municipal GIS, Census, etc.
  - **Normalization Function**: How raw data is scored (1-5)

### 4. Real-Time Analysis

The system:
1. Generates isochrone polygons around the selected point
2. Filters all visible layer features by zone
3. Calculates normalized scores for each enabled indicator
4. Computes category averages
5. Applies user-defined weights
6. Returns a final quality score (1-5)

### 5. Visualization

- **Isochrone Layer**: Automatically added to the map showing the three zones
- **Results Dashboard**: Displays:
  - Overall quality score
  - Category breakdown (Urban, Social, Economic, Historical)
  - Feature counts per zone
- **Heatmap** (planned): Visualize quality scores across a grid

## How to Use

### Step 1: Load Data Layers

Before running an analysis, ensure you have relevant data layers loaded:
- Use the **Fetch Data** panel to load urban features (parks, transit, etc.)
- Load municipal GIS layers (Tel Aviv, Jerusalem, Haifa)
- Import your own GeoJSON datasets

### Step 2: Select Analysis Point

1. Click the **"Pick Location on Map"** button
2. Click anywhere on the map to select your research point
3. The coordinates will be displayed

### Step 3: Configure Weights

Adjust the four category sliders to reflect your research priorities:
- For residential analysis: Increase **Social** weight
- For commercial analysis: Increase **Economic** weight
- For urban planning: Balance **Urban** and **Social**
- Total weights should sum to 100%

### Step 4: Enable Indicators

Toggle on/off specific indicators based on:
- Available data in your layers
- Research focus
- Data quality

### Step 5: Run Analysis

Click **"Run Analysis"** button to:
- Generate isochrones
- Calculate scores
- Visualize results
- Add isochrone layer to the map

### Step 6: Interpret Results

Review the results panel:
- **Overall Score**: 1.0 (poor) to 5.0 (excellent)
- **Category Scores**: Identify strengths/weaknesses
- **Feature Counts**: Understand data density by zone

## Normalization Functions

The system uses three types of scoring logic:

### 1. Linear (More is Better)
Used for: parks, transit, schools
- 0-1 features → Score 1-2
- 2-3 features → Score 3
- 3-5 features → Score 4
- 5+ features → Score 5

### 2. Optimal Range
Used for: commercial density
- Too few → Low score
- Optimal range → Score 5
- Too many → Score decreases

### 3. Presence Bonus
Used for: healthcare, heritage
- 0 features → Score 1
- 1 feature → Score 4
- 2+ features → Score 5

## Technical Implementation

### Files Created

1. **`components/ResearchView.tsx`**
   - Main UI component
   - Weight management
   - Indicator configuration
   - Results visualization

2. **`utils/researchScoring.ts`**
   - Isochrone generation (using Turf.js)
   - Feature filtering by zone
   - Score calculation engine
   - Normalization functions
   - Grid generation for heatmaps

3. **`types.ts`** (updated)
   - Added 'research' to AppView type

4. **`App.tsx`** (updated)
   - Research tab navigation
   - Map click handling for point selection
   - State management for research mode

### Dependencies

The Research tab uses:
- **@turf/turf**: Geospatial calculations (buffers, centroids, point-in-polygon)
- **@mui/material**: Slider components
- **lucide-react**: Icons

## Future Enhancements

### Planned Features

1. **Grid Sampling Mode**
   - Generate a grid of sample points
   - Calculate scores for each point
   - Create a heatmap layer

2. **Advanced Isochrones**
   - Integration with routing APIs (OpenRouteService, Mapbox)
   - Account for actual street networks
   - Consider barriers (highways, rivers)

3. **Export Capabilities**
   - Export results to CSV
   - Generate PDF reports
   - Compare multiple locations

4. **Custom Indicators**
   - Allow users to define new indicators
   - Specify custom thresholds
   - Create indicator templates

5. **Temporal Analysis**
   - Compare scores over time
   - Analyze changes after urban interventions

6. **Accessibility Profiles**
   - Different mobility modes (cycling, wheelchair)
   - Time-of-day variations
   - Population-specific weights

## Example Use Cases

### 1. Real Estate Investment
- **Objective**: Find the best location for a new apartment
- **Weights**: Economic 40%, Social 30%, Urban 20%, Historical 10%
- **Key Indicators**: Transit, schools, retail, healthcare

### 2. Urban Planning Assessment
- **Objective**: Evaluate service gaps in a neighborhood
- **Weights**: Social 50%, Urban 40%, Economic 5%, Historical 5%
- **Key Indicators**: Community centers, parks, transit, healthcare

### 3. Tourism Research
- **Objective**: Identify best hotel locations
- **Weights**: Historical 40%, Economic 30%, Urban 20%, Social 10%
- **Key Indicators**: Landmarks, retail, restaurants, transit

### 4. Accessibility Audit
- **Objective**: Measure 15-minute city compliance
- **Weights**: Urban 35%, Social 35%, Economic 20%, Historical 10%
- **Key Indicators**: All indicators enabled

## Tips & Best Practices

1. **Load Data First**: The Research tab analyzes features from existing layers. Load relevant data before analysis.

2. **Start Simple**: Begin with a few key indicators, then expand as needed.

3. **Adjust Weights**: Experiment with different weight configurations to understand their impact.

4. **Compare Locations**: Analyze multiple points to identify the best areas.

5. **Consider Context**: A score of 3.5 in a suburban area might be excellent, while the same score downtown might be average.

6. **Validate Results**: Cross-reference scores with local knowledge and on-the-ground reality.

## Technical Notes

### Isochrone Generation
Currently uses simplified circular buffers based on walking speed (5 km/h ≈ 83.3 m/min). For production use, consider integrating with:
- OpenRouteService Isochrone API
- Mapbox Isochrone API
- Local OSRM instance

### Performance
- Analysis is fast for <10,000 features
- Consider filtering layers before analysis for large datasets
- Grid mode will require batching for large areas

### Data Quality
- Results are only as good as the input data
- Ensure layers have proper geometries
- Verify coordinate systems (should be WGS84)

## Troubleshooting

### "No features found in zones"
- Zoom out to ensure layers are visible
- Check that layers are toggled on
- Verify coordinate system compatibility

### Unexpected scores
- Review which indicators are enabled
- Check category weights sum to 100%
- Inspect the isochrone layer for proper coverage

### Performance issues
- Reduce number of visible layers
- Disable unused indicators
- Use smaller analysis radius

## Support & Feedback

This is a research-grade tool for urban analysis. For questions, suggestions, or contributions, refer to the main project documentation.

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Author**: GeoExplore Platform
