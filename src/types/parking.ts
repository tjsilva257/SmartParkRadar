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
}

export interface TurnManeuver {
  instruction: string;
  street: string;
  distanceText: string;
  icon: string;
}

export type NavPhase = 'driving' | 'walking';
