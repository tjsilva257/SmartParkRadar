// Car routes (OSRM demo server, with alternatives and turn-by-turn steps) and the walking leg
// (FOSSGIS foot router). Both fall back to a plausible estimate when offline.
import type { Coordinate, Maneuver, ManeuverKind, RouteOption, WalkRoute } from '../types';
import { bearing, distanceMeters, fallbackPath } from '../lib/geo';
import { fetchJson } from '../lib/http';

interface OsrmStep {
  distance: number;
  duration: number;
  name?: string;
  ref?: string;
  destinations?: string;
  maneuver?: { type?: string; modifier?: string; exit?: number; bearing_after?: number };
}

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry?: { coordinates?: [number, number][] };
  legs?: { summary?: string; steps?: OsrmStep[] }[];
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

/** Dutch road class from the route number, else a guess from how fast traffic actually moves. */
export function speedLimitFor(ref: string | undefined, avgSpeedKmh: number): number {
  const r = (ref ?? '').trim().toUpperCase();
  if (/^A\d/.test(r)) return 100;
  if (/^N\d/.test(r)) return 80;
  if (/^S\d/.test(r)) return 50;
  if (avgSpeedKmh > 85) return 100;
  if (avgSpeedKmh > 60) return 80;
  return 50;
}

const CARDINALS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const cardinal = (deg: number) => CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

const toCoords = (raw: [number, number][]): Coordinate[] => raw.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));

const firstRef = (ref: string | undefined) => ref?.split(/[;,\s]+/).find(Boolean);

/** OSRM signage "RING A10, S111: Utrecht, Rotterdam" -> "Utrecht, Rotterdam" (place names read better than refs). */
function signedDestinations(raw: string | undefined): string {
  if (!raw) return '';
  const names = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw;
  return names
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
}

function byModifier(modifier: string | undefined): ManeuverKind {
  switch (modifier) {
    case 'uturn':
      return 'uturn';
    case 'sharp left':
      return 'sharp-left';
    case 'left':
      return 'left';
    case 'slight left':
      return 'slight-left';
    case 'sharp right':
      return 'sharp-right';
    case 'right':
      return 'right';
    case 'slight right':
      return 'slight-right';
    default:
      return 'straight';
  }
}

function kindFor(type: string, modifier: string | undefined): ManeuverKind {
  switch (type) {
    case 'depart':
      return 'depart';
    case 'arrive':
      return 'arrive';
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return 'roundabout';
    case 'merge':
      return 'merge';
    case 'on ramp':
    case 'off ramp':
      return 'ramp';
    case 'fork':
      return modifier?.includes('left') ? 'fork-left' : 'fork-right';
    default:
      // turn, end of road, continue, new name, notification, exit roundabout, ...
      return byModifier(modifier);
  }
}

function instructionFor(step: OsrmStep, kind: ManeuverKind, street: string, roadRef: string | undefined): string {
  const type = step.maneuver?.type ?? '';
  const onto = street ? ` onto ${street}` : '';
  const destinations = signedDestinations(step.destinations);
  const toward = destinations ? ` toward ${destinations}` : '';
  // Motorways are known by number ("Merge onto A10"), not by their local street name.
  const road = roadRef || street;

  if (type === 'exit roundabout' || type === 'exit rotary') return `Exit the roundabout${onto}`;

  switch (kind) {
    case 'depart':
      return `Head ${cardinal(step.maneuver?.bearing_after ?? 0)}${street ? ` on ${street}` : ''}`;
    case 'arrive':
      return 'Arrive at the parking';
    case 'roundabout': {
      const exit = step.maneuver?.exit;
      return exit ? `At the roundabout, take the ${ordinal(exit)} exit${onto}` : `Enter the roundabout${onto}`;
    }
    case 'merge':
      return road ? `Merge onto ${road}` : 'Merge';
    case 'ramp':
      if (type === 'off ramp') return `Take the exit${toward || onto}`;
      return road ? `Take the ramp onto ${road}` : `Take the ramp${toward}`;
    case 'fork-left':
    case 'fork-right':
      return `Keep ${kind === 'fork-left' ? 'left' : 'right'} at the fork${toward || onto}`;
    case 'uturn':
      return 'Make a U-turn';
    case 'slight-left':
      return `Keep left${onto}`;
    case 'slight-right':
      return `Keep right${onto}`;
    case 'left':
      return `Turn left${onto}`;
    case 'right':
      return `Turn right${onto}`;
    case 'sharp-left':
      return `Make a sharp left${onto}`;
    case 'sharp-right':
      return `Make a sharp right${onto}`;
    default:
      return street ? `Continue onto ${street}` : 'Continue straight';
  }
}

function toManeuvers(steps: OsrmStep[]): Maneuver[] {
  let atMeters = 0;
  return steps.map((step) => {
    const kind = kindFor(step.maneuver?.type ?? '', step.maneuver?.modifier);
    const street = step.name || step.ref || '';
    const roadRef = firstRef(step.ref);
    const avgKmh = step.duration > 0 ? (step.distance / step.duration) * 3.6 : 0;
    const maneuver: Maneuver = {
      kind,
      instruction: instructionFor(step, kind, street, roadRef),
      street,
      roadRef,
      atMeters,
      lengthMeters: step.distance,
      speedLimit: speedLimitFor(roadRef, avgKmh),
    };
    atMeters += step.distance;
    return maneuver;
  });
}

function fallbackRoute(start: Coordinate, end: Coordinate): RouteOption {
  const distance = Math.round(distanceMeters(start, end) * 1.3);
  const speedLimit = speedLimitFor(undefined, 30);
  return {
    id: 'route-0',
    summary: 'Estimated route',
    coordinates: fallbackPath(start, end),
    distanceMeters: distance,
    durationSeconds: Math.round(distance / (30 / 3.6)),
    maneuvers: [
      {
        kind: 'depart',
        instruction: `Head ${cardinal(bearing(start, end))}`,
        street: '',
        atMeters: 0,
        lengthMeters: distance,
        speedLimit,
      },
      { kind: 'arrive', instruction: 'Arrive at the parking', street: '', atMeters: distance, lengthMeters: 0, speedLimit },
    ],
    isFastest: true,
    delaySeconds: 0,
    isFallback: true,
  };
}

export async function fetchDriveRoutes(start: Coordinate, end: Coordinate): Promise<RouteOption[]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
    '?overview=full&geometries=geojson&steps=true&alternatives=true';
  const data = await fetchJson<OsrmResponse>(url, { timeoutMs: 7000 });

  const parsed: RouteOption[] = [];
  if (data?.code === 'Ok' && Array.isArray(data.routes)) {
    data.routes.forEach((r, index) => {
      const coordinates = toCoords(r.geometry?.coordinates ?? []);
      if (coordinates.length < 2) return;
      const leg = r.legs?.[0];
      parsed.push({
        id: `route-${index}`,
        summary: leg?.summary ? `via ${leg.summary}` : 'Fastest route',
        coordinates,
        distanceMeters: Math.round(r.distance),
        durationSeconds: Math.round(r.duration),
        maneuvers: toManeuvers(leg?.steps ?? []),
        isFastest: false,
        delaySeconds: 0,
        isFallback: false,
      });
    });
  }
  if (parsed.length === 0) return [fallbackRoute(start, end)];

  parsed.sort((a, b) => a.durationSeconds - b.durationSeconds);
  const fastest = parsed[0].durationSeconds;
  return parsed.map((r, i) => ({ ...r, isFastest: i === 0, delaySeconds: r.durationSeconds - fastest }));
}

export async function fetchWalkRoute(start: Coordinate, end: Coordinate): Promise<WalkRoute> {
  // The OSRM demo server only serves the car profile; FOSSGIS runs a real foot profile.
  const url =
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
    '?overview=full&geometries=geojson';
  const data = await fetchJson<OsrmResponse>(url, { timeoutMs: 5000 });
  const route = data?.code === 'Ok' ? data.routes?.[0] : undefined;
  const coordinates = toCoords(route?.geometry?.coordinates ?? []);
  if (route && coordinates.length >= 2) {
    return { coordinates, distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration) };
  }

  const distance = Math.round(distanceMeters(start, end) * 1.25);
  return { coordinates: fallbackPath(start, end, 4), distanceMeters: distance, durationSeconds: Math.round((distance / 80) * 60) };
}
