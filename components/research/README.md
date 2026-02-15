# Research View - Refactored Structure

## Overview
The ResearchView component has been refactored into smaller, more manageable files for better maintainability and code organization.

## New File Structure

```
components/
├── research/
│   ├── index.ts                    # Main export file
│   ├── types.ts                    # TypeScript interfaces and types
│   ├── constants.ts                # Constants and configuration
│   ├── useResearchAnalysis.ts      # Custom hook for analysis logic
│   ├── ResearchHeader.tsx          # Header component with title and actions
│   ├── StageProgress.tsx           # Stage progress display component
│   └── AnalysisTable.tsx           # Analysis results table component
├── ResearchView.refactored.tsx     # New refactored main component
└── ResearchView.tsx                # Original component (preserved)
```

## Components

### 1. **types.ts**
Contains all TypeScript interfaces and type definitions:
- `ResearchViewProps` - Main component props
- `CategoryWeights` - Weight configuration for categories
- `Indicator` - Indicator configuration
- `AnalysisResults` - Analysis results structure
- `StageData` - Stage-by-stage data
- `CategorizedPoints` - Categorized feature points

### 2. **constants.ts**
Contains configuration constants:
- `ZONE_MULTIPLIERS` - Isochrone zone multipliers
- `CITY_COORDINATES` - City center coordinates
- `DEFAULT_INDICATORS` - Default indicators configuration
- `CATEGORY_COLORS` - Category color mapping
- `DEFAULT_WEIGHTS` - Default category weights

### 3. **useResearchAnalysis.ts**
Custom React hook that encapsulates all analysis logic:
- State management for analysis results
- `calculatePointScore()` - Calculate score for a point
- `handleRunResearch()` - Run full research analysis
- `handleIsochroneAreaAnalysis()` - Analyze isochrone areas
- `calculateTransitScore()` - Calculate transit scores from bus data

### 4. **ResearchHeader.tsx**
Header section component with:
- Title and subtitle
- Run Analysis button
- Clear Analysis button
- Loading states

### 5. **StageProgress.tsx**
Stage progress display component showing:
- Current stage indicator
- Stage title and description
- Calculation results (garden area, isochrone area, percentage)
- Final score display

### 6. **AnalysisTable.tsx**
Analysis results table component with:
- Three analysis rows (Isochrone Area, Gardens, Bus Stations)
- Zone-based results (5, 10, 15 minutes)
- Score calculations
- Run action buttons

### 7. **ResearchView.refactored.tsx**
The new main component that:
- Uses all extracted components
- Manages UI state (weights, indicators, city selection)
- Delegates analysis logic to the hook
- Much cleaner and easier to read (~250 lines vs 1841 lines)

## Benefits of Refactoring

### 1. **Separation of Concerns**
- UI components are separated from business logic
- Data types are in their own file
- Constants are centralized

### 2. **Reusability**
- Components can be reused in other parts of the application
- Hook can be used in different components
- Types can be imported wherever needed

### 3. **Maintainability**
- Easier to find and fix bugs
- Smaller files are easier to understand
- Clear responsibility for each file

### 4. **Testability**
- Individual components can be tested in isolation
- Hook logic can be tested separately
- Mock data can be easily provided

### 5. **Performance**
- React can better optimize smaller components
- Easier to implement React.memo() for optimization
- Clearer dependency tracking

## How to Use

### Import the refactored component:
```typescript
import { ResearchView } from './components/ResearchView.refactored';
```

### Or import individual pieces:
```typescript
import { 
    ResearchHeader, 
    StageProgress, 
    AnalysisTable,
    useResearchAnalysis 
} from './components/research';
```

## Migration Path

To switch to the refactored version:

1. **Test the refactored version** alongside the original
2. **Update imports** in App.tsx or parent components
3. **Verify functionality** matches the original
4. **Remove the original** ResearchView.tsx when ready

## Future Enhancements

Potential improvements that are now easier to implement:

1. **Add more sub-components**:
   - WeightSliders component for category weights
   - IndicatorList component for indicator selection
   - ResultsChart component for visualization

2. **Extract more hooks**:
   - `useWeightManager` for weight management
   - `useIndicatorConfig` for indicator configuration
   - `useGardensAnalysis` for garden-specific analysis
   - `useBusAnalysis` for bus station analysis

3. **Add tests**:
   - Unit tests for each component
   - Integration tests for the hook
   - E2E tests for the full workflow

4. **Performance optimization**:
   - Add React.memo() to components
   - Implement useMemo() for expensive calculations
   - Add useCallback() for event handlers

## Notes

- The original `ResearchView.tsx` is preserved for reference
- The refactored version is in `ResearchView.refactored.tsx`
- All new files are in the `components/research/` directory
- No functionality has been removed, only reorganized
