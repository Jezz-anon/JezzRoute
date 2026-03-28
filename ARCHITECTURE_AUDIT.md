# JezzRoute Motorcycle Planner - Architectural Audit

## Current State
- **Framework**: React 19.2.3 + TypeScript + Vite 7.2.4
- **Map**: Leaflet + React Leaflet 4.2.3
- **Routing**: Mapbox Directions API
- **POIs**: Overpass API (OpenStreetMap)
- **Storage**: Browser localStorage
- **Build**: Single-file output (vite-plugin-singlefile)

## Known Issues to Fix

### 1. Curviness Slider Not Working Properly
**Symptom**: Slider shows changing percentages in console (0% → 28% → 60% → 100%) but routes don't visually change enough to be noticeable. Routes remain 172.0 km for most variations.

**Current Logic** (src/utils/routing.ts:144-180):
- 0-40%: Direct mode (uses 2-point routing, no motorway exclusion)
- 40%+: Scenic mode (requests alternative routes from Mapbox)
- Curviness threshold appears arbitrary

**Problem**: 
- 2-waypoint routing doesn't produce varied alternatives
- All alternatives return same ~172km distance
- Exclude parameters not working (avoidHighways, avoidTolls, etc.)

### 2. POI Emoji Rendering Inconsistent
**Symptom**: Emojis flash, disappear on zoom, don't render after route changes

**Current Implementation** (src/components/RouteMap.tsx:272-285):
- Uses L.divIcon with inline styles and font-family stack
- className set to empty string to avoid Leaflet defaults
- POI filtering to 1.5km corridor

**Problems**:
- Effect triggering too many times despite debouncing
- POIs cached but not always re-filtered after route changes
- Font rendering not reliable across zoom levels

### 3. Preferences Not Updating Routes
**Symptom**: Toggling "Avoid Highways" etc. doesn't change route

**Current Mechanism** (src/App.tsx:60-110):
- RoutePreferencesPanel calls `onChange` handler
- Handler updates `route.preferences` via `setRoute`
- Effect watches `[route.waypoints, route.preferences]` and calls `calculateRoute`

**Problem**: 
- Debouncing in RoutePreferencesPanel delays preference updates
- Preference changes aren't triggering route recalculation reliably
- handleUpdatePreferences uses object spread but may have state batching issues

### 4. POI Layer Toggles Not Functional
**Symptom**: Toggling layers in MapPOILayers doesn't change displayed POIs

**Current State** (src/App.tsx:31-39):
```typescript
const [poiLayers, setPoiLayers] = useState<POILayerState>({
  fuelStations: true,
  speedCameras: true,
  accommodations: false,
  restaurants: false,
  parkingAreas: false,
});
```

**Problem**:
- poiLayers state defined but toggles not wired to update it
- MapPOILayers component doesn't have onChange handler
- No communication between toggle UI and POI fetching

## Data Flow Issues

### Current (Broken) Flow:
```
User drags slider 
  → RoutePreferencesPanel.handleCurvinessChange (300ms debounce)
  → onChange() called after debounce
  → App.handleUpdatePreferences updates route.preferences
  → useEffect watches route.preferences
  → calculateRoute called
  → setRouteCoordinates updates
  → MapController re-filters POIs
  → BUT: Leaflet divIcons not re-rendering visually
```

### Problems:
1. **Multiple debounces**: Slider debounces 300ms, POI fetch debounces 500ms
2. **Stale closures**: Refs used but effect dependencies unclear
3. **POI re-rendering**: All POIs re-fetched on route change despite having them cached
4. **No visual feedback**: Route changes not obvious to user

## Components Needing Redesign

### 1. RoutePreferencesPanel.tsx
- Debounce interferes with feedback
- Should update immediately with visual response
- Separate UI update from route calculation

### 2. MapController (nested in RouteMap.tsx)
- Effect dependencies confusing (waypoints.length vs waypoints)
- POI fetch and filter logic tangled
- Refs for bounds tracking work but feel hacky

### 3. App.tsx Route Calculation Logic
- Mixed concerns: state updates, route calculation, voice alerts
- handleUpdatePreferences too simple for complex preference logic

### 4. MapPOILayers.tsx
- No onChange handler
- Not integrated with App state

## Recommendations for Opus

1. **Separate concerns clearly**:
   - Preference UI updates (immediate feedback)
   - Route calculation (debounced, async)
   - POI fetching (debounced differently from route)
   - POI rendering (instant, uses cached data)

2. **Fix preference pipeline**:
   - Make slider immediate UI update
   - Debounce route calculation only (not preference update)
   - Ensure all preferences bubble up correctly

3. **Optimize POI system**:
   - Fetch full POI data once
   - Filter by layer toggles in memory
   - Only re-fetch if bounds significantly change

4. **Add visual feedback**:
   - Show route quality/distance clearly
   - Highlight that route changed
   - Display which alternatives were considered

5. **Fix data dependencies**:
   - Clear effect dependencies
   - No stale closures
   - Predictable re-renders

## Test Cases to Validate

- [ ] Drag curviness 0→50→100: Route visibly changes
- [ ] Toggle "Avoid Highways": Route recalculates immediately
- [ ] Click MapPOILayers toggle: POIs appear/disappear instantly
- [ ] Create 3-point route: Curviness produces varied alternatives
- [ ] Click emoji on map: Tooltip shows POI details
- [ ] Refresh page: Saved route loads with correct POIs

## Files to Review/Redesign

```
src/
├── App.tsx (main orchestration)
├── components/
│   ├── RouteMap.tsx (MapController effect logic)
│   ├── RoutePreferencesPanel.tsx (debounce logic)
│   ├── MapPOILayers.tsx (toggles not wired)
│   └── RouteInput.tsx
├── utils/
│   ├── routing.ts (curviness logic, POI filtering)
│   ├── poiUtils.ts (Overpass API calls)
│   └── routeStorage.ts
└── types/
    └── index.ts
```

## Build/Run Commands
```bash
npm run build  # ~466KB single file output
npm run preview  # Local preview at localhost:5179
```
