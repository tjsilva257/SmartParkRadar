// Shared domain types for the Apple Maps-style rework.
// Field names of persisted shapes (Place, SavedPlace, RoadHazard, MapIconFilters)
// match the original app so data already in AsyncStorage keeps loading.
import type { Feature, MultiPolygon, Polygon } from 'geojson';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

// ---------- Places ----------

export type PoiCategory =
  | 'cafe'
  | 'restaurant'
  | 'bakery'
  | 'bar'
  | 'parking'
  | 'transit'
  | 'museum'
  | 'park'
  | 'shopping'
  | 'home'
  | 'work'
  | 'generic';

export interface Place {
  id: string;
  name: string;
  subtitle: string;
  coordinate: Coordinate;
  city?: string;
  state?: string;
  country?: string;
  poiCategory?: PoiCategory;
}

export type SavedCategory = 'home' | 'work' | 'favorite' | 'recent';

export interface SavedPlace extends Place {
  category: SavedCategory;
  customLabel?: string;
  savedAt?: number;
}

// ---------- Parking ----------

export type ParkingType = 'free' | 'blue' | 'cheap' | 'paid';
export type FacilityType = 'garage' | 'lot' | 'bay' | 'street';

export interface ParkingSpot {
  id: string;
  title: string;
  type: ParkingType;
  facility: FacilityType;
  pricePerHour: number; // 0 for free / blue-disc
  priceLabel: string; // "Free", "€1.50/h", "2 h disc"
  rules: string; // opening hours / payment rules, one line
  description: string;
  coordinate: Coordinate;
  distanceToDestMeters: number;
  walkMinutes: number;
  polygon?: Coordinate[];
  stallLines?: [Coordinate, Coordinate][];
  capacity?: number;
  source: 'rdw' | 'osm';
}

export interface ParkingScan {
  spots: ParkingSpot[];
  best: ParkingSpot | null;
  /**
   * Nearest free parking when the best spot isn't free and the free one is beyond the max walk.
   * `walkMeters` is the max-walk option that reaches it; null when no option walks farther.
   */
  freeHint: { spot: ParkingSpot; walkMeters: number | null } | null;
}

// ---------- Routing ----------

export type ManeuverKind =
  | 'depart'
  | 'arrive'
  | 'straight'
  | 'slight-left'
  | 'left'
  | 'sharp-left'
  | 'slight-right'
  | 'right'
  | 'sharp-right'
  | 'uturn'
  | 'roundabout'
  | 'merge'
  | 'ramp'
  | 'fork-left'
  | 'fork-right'
  | 'walk';

export interface Maneuver {
  kind: ManeuverKind;
  instruction: string; // "Turn left onto Weesperstraat"
  street: string; // "Weesperstraat" (may be '' when unnamed)
  roadRef?: string; // "A10", "S112"
  atMeters: number; // distance from route start where this maneuver happens
  lengthMeters: number; // distance driven after this maneuver until the next one
  speedLimit: number; // km/h for the stretch after this maneuver
}

export interface RouteOption {
  id: string;
  summary: string; // "via A10, A4"
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: Maneuver[];
  isFastest: boolean;
  delaySeconds: number; // vs. fastest; 0 for fastest
  isFallback: boolean; // true when OSRM was unreachable and this is a straight-ish estimate
}

/** The walk from the parking spot to the destination. */
export interface WalkRoute {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
}

export type TravelPhase = 'driving' | 'walking';

// ---------- Speed cameras ----------

export type CameraType = 'fixed' | 'average' | 'red_light' | 'mobile' | 'police';

export interface SpeedCamera {
  id: string;
  name: string;
  road: string;
  type: CameraType;
  speedLimit: number;
  coordinate: Coordinate;
  description?: string;
  source: 'builtin' | 'osm';
}

export interface CameraWarning {
  camera: SpeedCamera;
  distanceMeters: number;
  isUrgent: boolean; // <= 450 m
}

export interface SpeedAlert {
  speed: number;
  limit: number;
  overBy: number; // km/h above limit, 0 when within
  fineEur: number; // estimated CJIB fine, 0 within margin
  level: 'ok' | 'over' | 'fine'; // over: 1-7 over, fine: >= 8 over
}

export type CameraDisplayMode = 'always' | 'trip_only' | 'off';

// ---------- Hazards ----------

export type HazardCategory =
  | 'mobile_camera'
  | 'parking_warden'
  | 'accident'
  | 'road_work'
  | 'road_block'
  | 'debris'
  | 'traffic_jam';

export type Carriageway = 'Li' | 'Re' | 'all';

export interface HectometerPosition {
  road: string;
  hectometer: number;
  carriageway: Carriageway;
  description?: string;
}

export interface RoadHazard {
  id: string;
  category: HazardCategory;
  title: string;
  roadName: string;
  hectometerPost?: HectometerPosition;
  coordinate: Coordinate;
  reportedAt: number;
  reporterLabel?: string;
  confirmations: number;
  note?: string;
}

export interface NewHazardReport {
  category: HazardCategory;
  title: string;
  roadName: string;
  coordinate: Coordinate;
  hectometerPost?: HectometerPosition;
  note?: string;
}

export interface HectometerMatch {
  road: string;
  hectometer: number;
  carriageway: Carriageway;
  distanceMeters: number;
  roadName: string;
}

// ---------- Map settings ----------

export interface MapIconFilters {
  showSpeedCameras: boolean;
  showPolice: boolean;
  showWardens: boolean;
  showRoadworks: boolean;
  showHazards: boolean;
  showParking: boolean;
  showPois: boolean;
}

export const DEFAULT_ICON_FILTERS: MapIconFilters = {
  showSpeedCameras: true,
  showPolice: true,
  showWardens: true,
  showRoadworks: true,
  showHazards: true,
  showParking: true,
  showPois: true,
};

// Apple Maps "Choose Map" modes.
export type MapMode = 'explore' | 'driving' | 'satellite';

export interface MapSettings {
  mode: MapMode;
  showTraffic: boolean;
  showScratchMap: boolean;
  cameraDisplay: CameraDisplayMode;
  voiceMuted: boolean;
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  mode: 'explore',
  showTraffic: true,
  showScratchMap: false,
  cameraDisplay: 'always',
  voiceMuted: false,
};

export interface SavedState {
  home: SavedPlace | null;
  work: SavedPlace | null;
  favorites: SavedPlace[];
  recents: SavedPlace[];
}

// ---------- Scratch map ----------

export type ExploredGeometry = Feature<Polygon> | Feature<MultiPolygon> | null;

// ---------- Trip simulation ----------

export interface TripState {
  phase: TravelPhase | 'arrived';
  position: Coordinate;
  heading: number;
  traveledMeters: number; // within current phase
  remainingMeters: number; // within current phase
  remainingSeconds: number; // whole trip: remaining drive + walk
  nextManeuver: Maneuver;
  thenManeuver: Maneuver | null; // only when within 400 m after nextManeuver
  distanceToManeuver: number;
  speed: number; // km/h (walking: 5)
  speedLimit: number; // km/h (walking: 0)
  cameraWarning: CameraWarning | null;
  alert: SpeedAlert;
}
