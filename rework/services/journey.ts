// The journey from picking a destination to arriving: its parking scan, route options, the chosen route
// and whether the trip is running. A pure reducer, so its ordering rules (a late parking or route result
// never lands on another destination or under a running trip) are testable without React; useJourney
// runs the lookups and the trip around it.
import type { ParkingScan, ParkingSpot, Place, RouteOption, WalkRoute } from '../types';
import { coordKey } from '../lib/geo';
import { chooseParking } from './parking';

export type JourneyPhase = 'idle' | 'planning' | 'navigating';

export interface JourneyState {
  phase: JourneyPhase;
  destination: Place | null;
  maxWalk: number; // kept between journeys for the session
  options: ParkingSpot[] | null; // null while the parking lookup is in flight
  routes: { drive: RouteOption[]; walk: WalkRoute | null } | null; // for the chosen spot; null while loading
  selectedRouteId: string | null;
}

export type JourneyAction =
  | { type: 'plan'; destination: Place }
  | { type: 'parkingLoaded'; destination: Place; options: ParkingSpot[] }
  | { type: 'routesLoaded'; key: string; drive: RouteOption[]; walk: WalkRoute | null }
  | { type: 'selectRoute'; id: string }
  | { type: 'setMaxWalk'; meters: number }
  | { type: 'go'; id: string }
  | { type: 'end' };

export interface JourneyView {
  scan: ParkingScan | null;
  parking: ParkingSpot | null;
  /** The parking spot → destination pair whose routes are needed; null when there is nothing to route. */
  routesKey: string | null;
  drive: RouteOption[];
  selectedRoute: RouteOption | null;
  walk: WalkRoute | null;
  loading: boolean;
}

const NO_ROUTES: RouteOption[] = [];

export const initialJourney = (maxWalk = 500): JourneyState => ({
  phase: 'idle',
  destination: null,
  maxWalk,
  options: null,
  routes: null,
  selectedRouteId: null,
});

export function viewOf(s: JourneyState): JourneyView {
  const scan = s.destination && s.options ? chooseParking(s.options, s.maxWalk) : null;
  const parking = scan?.best ?? null;
  const routesKey = s.destination && parking ? `${coordKey(parking.coordinate)}>${coordKey(s.destination.coordinate)}` : null;
  const drive = s.routes?.drive ?? NO_ROUTES;
  return {
    scan,
    parking,
    routesKey,
    drive,
    selectedRoute: drive.find((r) => r.id === s.selectedRouteId) ?? drive[0] ?? null,
    walk: s.routes?.walk ?? null,
    loading: s.phase === 'planning' && (s.options === null || (routesKey !== null && s.routes === null)),
  };
}

/** A different parking spot needs different routes: the old ones never show while the new ones load. */
function routesFor(next: JourneyState, prev: JourneyState): JourneyState {
  return viewOf(next).routesKey === viewOf(prev).routesKey ? next : { ...next, routes: null, selectedRouteId: null };
}

const hasRoute = (s: JourneyState, id: string) => !!s.routes?.drive.some((r) => r.id === id);

export function journeyReducer(s: JourneyState, a: JourneyAction): JourneyState {
  switch (a.type) {
    case 'plan':
      return { ...initialJourney(s.maxWalk), phase: 'planning', destination: a.destination };
    case 'parkingLoaded':
      // Only for the destination being planned: never one left behind, never under a running trip.
      if (s.phase !== 'planning' || s.destination !== a.destination) return s;
      return routesFor({ ...s, options: a.options }, s);
    case 'setMaxWalk':
      if (s.phase === 'navigating' || a.meters === s.maxWalk) return s;
      return routesFor({ ...s, maxWalk: a.meters }, s);
    case 'routesLoaded':
      // Routes for a spot that is no longer the chosen one, or arriving after GO, are dropped.
      if (s.phase !== 'planning' || a.key !== viewOf(s).routesKey) return s;
      return { ...s, routes: { drive: a.drive, walk: a.walk }, selectedRouteId: a.drive[0]?.id ?? null };
    case 'selectRoute':
      return s.phase === 'planning' && hasRoute(s, a.id) ? { ...s, selectedRouteId: a.id } : s;
    case 'go':
      return s.phase === 'planning' && hasRoute(s, a.id) ? { ...s, phase: 'navigating', selectedRouteId: a.id } : s;
    case 'end':
      return initialJourney(s.maxWalk);
  }
}
