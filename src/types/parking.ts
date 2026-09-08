export interface Coordinate {
  latitude: number;
  longitude: number;
}

export type ParkingType = 'free' | 'blue' | 'cheap' | 'paid' | 'hazard';

export interface ParkingSpot {
  id: string;
  title: string;
  type: ParkingType;
  pricePerHour: number;
  label: string;
  badge: string;
  distanceToDestMeters: number;
  walkingTimeMinutes: number;
  venstertijden: string;
  coordinate: Coordinate;
  color: string;
  description: string;
}

export interface DestinationTarget {
  id?: string;
  name: string;
  subtitle: string;
  coordinate: Coordinate;
  city?: string;
  state?: string;
  country?: string;
  distanceKm?: string;
}

export type SavedLocationCategory = 'home' | 'work' | 'favorite' | 'recent';

export interface SavedLocation extends DestinationTarget {
  category: SavedLocationCategory;
  customLabel?: string;
  savedAt?: number;
}

export interface TurnManeuver {
  instruction: string;
  street: string;
  distanceText: string;
  icon: string;
}

export type NavPhase = 'driving' | 'walking';

export type TrafficLevel = 'clear' | 'moderate' | 'heavy';

export interface TrafficInfo {
  level: TrafficLevel;
  delayMinutes: number;
  summary: string;
  savingsText?: string;
}

export interface DriveRouteOption {
  id: string;
  summary: string;
  coordinates: Coordinate[];
  distanceKm: string;
  durationMinutes: number;
  traffic: TrafficInfo;
  isFastest: boolean;
  timeDiffMinutes: number;
  maneuvers: TurnManeuver[];
}

export type CameraType = 'fixed' | 'mobile' | 'traject' | 'red_light';

export interface SpeedCamera {
  id: string;
  name: string;
  road: string;
  type: CameraType;
  speedLimit: number;
  coordinate: Coordinate;
  description?: string;
}

export interface SpeedAlert {
  isOverLimit: boolean;
  isWayOverLimit: boolean;
  speedLimit: number;
  currentSpeed: number;
  overBy: number;
  fineEstimateEur: number;
}

export interface CameraWarning {
  camera: SpeedCamera;
  distanceMeters: number;
  isUrgent: boolean;
}

export type CameraDisplayMode = 'always' | 'trip_only' | 'off';

export type HazardCategory =
  | 'mobile_camera'
  | 'parking_warden'
  | 'accident'
  | 'road_work'
  | 'debris'
  | 'traffic_jam';

export type CarriagewayDirection = 'Li' | 'Re' | 'all';

export interface HectometerPosition {
  road: string;
  hectometer: number;
  carriageway: CarriagewayDirection;
  letterCode?: string;
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

