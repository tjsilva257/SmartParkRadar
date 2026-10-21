# Graph Report - SmartParkRadar  (2026-10-20)

## Corpus Check
- Corpus is ~28,401 words - fits in a single context window. You may not need a graph.

## Summary
- 241 nodes · 581 edges · 13 communities (10 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Expo App Config
- Map Screen Core
- Navigation HUD & Overlays
- POI Markers & Preview
- Search & Favorites
- Routing, Cameras & Parking
- Map Tools & Scratch Map
- Hazards & Hectometer Posts
- App Manifest
- Voice Guidance
- TypeScript Config
- NativeWind Types

## God Nodes (most connected - your core abstractions)
1. `MapScreen()` - 38 edges
2. `Coordinate` - 21 edges
3. `react` - 16 edges
4. `DestinationTarget` - 16 edges
5. `getDistanceInMeters()` - 15 edges
6. `SearchBar()` - 14 edges
7. `react-native` - 13 edges
8. `ParkingSpot` - 10 edges
9. `expo` - 9 edges
10. `CameraWarning` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `MapScreen()`  [EXTRACTED]
  App.tsx → app/index.tsx
- `MapScreen()` --calls--> `AnimatedPoiMarker()`  [EXTRACTED]
  app/index.tsx → src/components/AnimatedPoiMarker.tsx
- `MapScreen()` --calls--> `AnimatedRadarPill()`  [EXTRACTED]
  app/index.tsx → src/components/AnimatedRadarPill.tsx
- `MapScreen()` --calls--> `HazardReportModal()`  [EXTRACTED]
  app/index.tsx → src/components/HazardReportModal.tsx
- `MapScreen()` --calls--> `MapToolsMenu()`  [EXTRACTED]
  app/index.tsx → src/components/MapToolsMenu.tsx

## Import Cycles
- None detected.

## Communities (13 total, 3 thin omitted)

### Community 0 - "Expo App Config"
Cohesion: 0.05
Nodes (34): App(), config, { getDefaultConfig }, { withNativeWind }, dependencies, expo, expo-blur, expo-location (+26 more)

### Community 1 - "Map Screen Core"
Cohesion: 0.11
Nodes (30): calculateBearing(), DEFAULT_COORDS, MapScreen(), initLocation(), styles, expo-location, expo-task-manager, @react-native-async-storage/async-storage (+22 more)

### Community 2 - "Navigation HUD & Overlays"
Cohesion: 0.14
Nodes (20): AnimatedRadarPill(), AnimatedRadarPillProps, styles, NavigationHUDProps, styles, ParkingAreaOverlay(), ParkingAreaOverlayProps, styles (+12 more)

### Community 3 - "POI Markers & Preview"
Cohesion: 0.14
Nodes (20): expo-blur, AnimatedPoiMarker(), AnimatedPoiMarkerProps, styles, PoiPreviewCard(), PoiPreviewCardProps, styles, SearchBarProps (+12 more)

### Community 4 - "Search & Favorites"
Cohesion: 0.19
Nodes (21): EXPANDED_HEIGHT, { height: SCREEN_HEIGHT }, SearchBar(), styles, addFavorite(), addRecent(), clearRecents(), getFavorites() (+13 more)

### Community 5 - "Routing, Cameras & Parking"
Cohesion: 0.17
Nodes (17): loadRoadRoute(), calculateSpeedFine(), fetchLiveOverpassCameras(), getNearbyCameras(), getUpcomingCameraWarning(), liveCamerasCache, SPEED_CAMERAS, generatePreciseParkingGeometry() (+9 more)

### Community 6 - "Map Tools & Scratch Map"
Cohesion: 0.16
Nodes (12): react-native-maps, @turf/turf, MapToolsMenu(), MapToolsMenuProps, styles, ScratchMapOverlay, ScratchMapOverlayProps, WORLD_MASK (+4 more)

### Community 7 - "Hazards & Hectometer Posts"
Cohesion: 0.24
Nodes (15): CATEGORIES, HazardReportModal(), HazardReportModalProps, styles, detectNearbyHectometerPost(), detectNearbyHectometerPostWithPDOK(), DUTCH_HIGHWAYS, formatHectometerLabel() (+7 more)

### Community 8 - "App Manifest"
Cohesion: 0.12
Nodes (15): permissions, expo, android, ios, name, orientation, plugins, slug (+7 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.33
Nodes (5): expo/tsconfig.base, compilerOptions, jsx, strict, extends

## Knowledge Gaps
- **4 isolated node(s):** `@types/react`, `tailwindcss`, `typescript`, `expo/tsconfig.base`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 76 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Expo App Config` to `Map Screen Core`, `Navigation HUD & Overlays`, `POI Markers & Preview`, `Search & Favorites`, `Map Tools & Scratch Map`, `Hazards & Hectometer Posts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **What connects `@types/react`, `tailwindcss`, `typescript` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Expo App Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05365853658536585 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `Expo App Config` to `Map Screen Core`, `Navigation HUD & Overlays`, `POI Markers & Preview`, `Search & Favorites`, `Map Tools & Scratch Map`, `Hazards & Hectometer Posts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `Map Screen Core` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `Navigation HUD & Overlays` be split into smaller, more focused modules?**
  _Cohesion score 0.13846153846153847 - nodes in this community are weakly interconnected._
- **Should `POI Markers & Preview` be split into smaller, more focused modules?**
  _Cohesion score 0.14130434782608695 - nodes in this community are weakly interconnected._