# Graph Report - SmartParkRadar  (2026-10-21)

## Corpus Check
- 64 files · ~59,613 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 611 nodes · 1940 edges · 28 communities (24 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Map UI Components & Glyphs
- Trip Simulation & Routing
- Legacy Screen Components
- Hectometer Report Sheet
- Rework MapScreen Shell
- Legacy Camera & Parking Feeds
- Saved Data Loading
- Legacy Search & Favorites
- Hazard Store
- Places Search
- Legacy Hazard Reporting
- Legacy MapScreen & Hazards
- Expo App Config
- Runtime Dependencies
- Legacy POI Markers
- Metro & NativeWind Build
- Legacy Scratch Map Overlay
- Rework Scratch Map
- Legacy Icon Filters
- Saved Data Mutations
- Legacy Voice Guidance
- Rework Voice Alerts
- Background Location Tracking
- TypeScript Config
- Dev Dependencies
- Shake Detector Hook
- NativeWind Type Shim

## God Nodes (most connected - your core abstractions)
1. `MapScreen()` - 59 edges
2. `useTheme()` - 50 edges
3. `MapScreen()` - 36 edges
4. `react` - 29 edges
5. `react-native` - 26 edges
6. `ReportForm()` - 26 edges
7. `NavigationView()` - 25 edges
8. `distanceMeters()` - 25 edges
9. `PlaceCard()` - 22 edges
10. `RoutePlanner()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `MapScreen()`  [EXTRACTED]
  App.tsx → rework/MapScreen.tsx
- `MapScreen()` --calls--> `AnimatedPoiMarker()`  [EXTRACTED]
  app/index.tsx → src/components/AnimatedPoiMarker.tsx
- `MapScreen()` --calls--> `AnimatedRadarPill()`  [EXTRACTED]
  app/index.tsx → src/components/AnimatedRadarPill.tsx
- `MapScreen()` --calls--> `HazardReportModal()`  [EXTRACTED]
  app/index.tsx → src/components/HazardReportModal.tsx
- `MapScreen()` --calls--> `MapIconFilterModal()`  [EXTRACTED]
  app/index.tsx → src/components/MapIconFilterModal.tsx

## Import Cycles
- None detected.

## Communities (28 total, 4 thin omitted)

### Community 0 - "Map UI Components & Glyphs"
Cohesion: 0.06
Nodes (115): react-native-safe-area-context, CAMERA, cameraGlyph(), cameraUsesSign(), facilityLabel(), Glyph, HAZARD, hazardGlyph() (+107 more)

### Community 1 - "Trip Simulation & Routing"
Cohesion: 0.06
Nodes (74): announceDriving(), destinationName(), drivingState(), isCoord(), lastPoint(), Line, lowerFirst(), noAlert() (+66 more)

### Community 2 - "Legacy Screen Components"
Cohesion: 0.10
Nodes (32): DEFAULT_COORDS, styles, expo-blur, expo-speech, react, react-native, AnimatedRadarPill(), AnimatedRadarPillProps (+24 more)

### Community 3 - "Hectometer Report Sheet"
Cohesion: 0.10
Nodes (31): CARRIAGEWAYS, HectometerSign(), LOCATION_MODES, LocationMode, parseHecto(), ReportSheet(), ReportSheetProps, round1() (+23 more)

### Community 4 - "Rework MapScreen Shell"
Cohesion: 0.12
Nodes (27): App(), ScratchFog, cameraVisible(), coordKey(), DEFAULT_COORD, EMPTY_SAVED, hazardVisible(), mapBottomInset() (+19 more)

### Community 5 - "Legacy Camera & Parking Feeds"
Cohesion: 0.14
Nodes (23): loadRoadRoute(), calculateSpeedFine(), fetchLiveOverpassCameras(), getNearbyCameras(), getUpcomingCameraWarning(), liveCamerasCache, SPEED_CAMERAS, calculatePolygonCentroid() (+15 more)

### Community 6 - "Saved Data Loading"
Cohesion: 0.13
Nodes (24): load(), asSlot(), CAMERA_MODES, finite(), isRecord(), loadIconFilters(), loadMapSettings(), loadSaved() (+16 more)

### Community 7 - "Legacy Search & Favorites"
Cohesion: 0.17
Nodes (24): PoiPreviewCardProps, EXPANDED_HEIGHT, { height: SCREEN_HEIGHT }, SearchBar(), SearchBarProps, styles, addFavorite(), addRecent() (+16 more)

### Community 8 - "Hazard Store"
Cohesion: 0.13
Nodes (20): @react-native-async-storage/async-storage, HAZARD_CATEGORIES, KEYS, loadStrict(), CARRIAGEWAYS, confirmHazard(), LEGACY_REPORTER, LEGACY_TITLES (+12 more)

### Community 9 - "Places Search"
Cohesion: 0.21
Nodes (19): fetchJson(), MEME_QUERIES, NAME_RULES, nearestFirst(), OSM_CATEGORIES, parsePhotonFeature(), POI_KEYS, poiAt() (+11 more)

### Community 10 - "Legacy Hazard Reporting"
Cohesion: 0.20
Nodes (17): CATEGORIES, HazardReportModal(), HazardReportModalProps, styles, detectNearbyHectometerPost(), detectNearbyHectometerPostWithPDOK(), DUTCH_HIGHWAYS, formatHectometerLabel() (+9 more)

### Community 11 - "Legacy MapScreen & Hazards"
Cohesion: 0.18
Nodes (16): calculateBearing(), MapScreen(), initLocation(), addReportedHazard(), confirmHazard(), fetchLiveRoadBlockades(), getMergedHazards(), getReportedHazards() (+8 more)

### Community 12 - "Expo App Config"
Cohesion: 0.12
Nodes (15): permissions, expo, android, ios, name, orientation, plugins, slug (+7 more)

### Community 13 - "Runtime Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, expo, expo-blur, expo-location, expo-sensors, expo-speech, expo-task-manager, @expo/vector-icons (+7 more)

### Community 14 - "Legacy POI Markers"
Cohesion: 0.26
Nodes (9): react-native-maps, AnimatedPoiMarker(), AnimatedPoiMarkerProps, styles, PoiPreviewCard(), styles, CURATED_PLACES, detectPoiCategory() (+1 more)

### Community 15 - "Metro & NativeWind Build"
Cohesion: 0.20
Nodes (9): config, { getDefaultConfig }, { withNativeWind }, expo, @expo/vector-icons, nativewind, tailwindcss, @types/react (+1 more)

### Community 16 - "Legacy Scratch Map Overlay"
Cohesion: 0.25
Nodes (7): @turf/turf, ScratchMapOverlay, ScratchMapOverlayProps, WORLD_MASK, convertGeoJsonToHoles(), EXPLORE_RADIUS_KM, ExploredGeometry

### Community 17 - "Rework Scratch Map"
Cohesion: 0.29
Nodes (10): addExplored(), addNow(), chain, clearExplored(), isRing(), loadExplored(), parseGeometry(), serial() (+2 more)

### Community 18 - "Legacy Icon Filters"
Cohesion: 0.25
Nodes (9): FilterRowConfig, MapIconFilterModal(), MapIconFilterModalProps, styles, CameraType, DEFAULT_ICON_FILTERS, MapIconFilterSettings, SavedLocationCategory (+1 more)

### Community 19 - "Saved Data Mutations"
Cohesion: 0.29
Nodes (10): save(), addRecent(), clearRecents(), isFavorite(), near(), saveIconFilters(), saveMapSettings(), setSavedSlot() (+2 more)

### Community 21 - "Rework Voice Alerts"
Cohesion: 0.29
Nodes (4): CAMERA_PHRASE, voice, CameraType, CameraWarning

### Community 22 - "Background Location Tracking"
Cohesion: 0.33
Nodes (3): expo-location, expo-task-manager, SCRATCH_MAP_BACKGROUND_TASK

### Community 23 - "TypeScript Config"
Cohesion: 0.33
Nodes (5): expo/tsconfig.base, compilerOptions, jsx, strict, extends

### Community 24 - "Dev Dependencies"
Cohesion: 0.50
Nodes (4): devDependencies, tailwindcss, @types/react, typescript

## Knowledge Gaps
- **4 isolated node(s):** `@types/react`, `tailwindcss`, `typescript`, `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 155 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Legacy Screen Components` to `Map UI Components & Glyphs`, `Trip Simulation & Routing`, `Hectometer Report Sheet`, `Rework MapScreen Shell`, `Legacy Search & Favorites`, `Legacy Hazard Reporting`, `Legacy POI Markers`, `Metro & NativeWind Build`, `Legacy Scratch Map Overlay`, `Legacy Icon Filters`, `Shake Detector Hook`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **What connects `@types/react`, `tailwindcss`, `typescript` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Map UI Components & Glyphs` be split into smaller, more focused modules?**
  _Cohesion score 0.06040846456692913 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `Legacy Screen Components` to `Map UI Components & Glyphs`, `Hectometer Report Sheet`, `Rework MapScreen Shell`, `Legacy Search & Favorites`, `Legacy Hazard Reporting`, `Legacy POI Markers`, `Metro & NativeWind Build`, `Legacy Icon Filters`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Should `Trip Simulation & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.05895061728395062 - nodes in this community are weakly interconnected._
- **Why does `expo-location` connect `Background Location Tracking` to `Legacy Screen Components`, `Rework MapScreen Shell`, `Legacy Search & Favorites`, `Places Search`, `Metro & NativeWind Build`, `Rework Scratch Map`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Legacy Screen Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10384615384615385 - nodes in this community are weakly interconnected._