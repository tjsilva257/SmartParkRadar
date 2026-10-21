// Fog-of-war "scratch map": the union of 120 m circles around every place the user has been.
import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import type { Coordinate, ExploredGeometry } from '../types';
import { KEYS, loadStrict, save } from '../lib/store';

const TASK = 'SCRATCH_MAP_BACKGROUND_TASK';
const RADIUS_KM = 0.12;

let current: ExploredGeometry = null;
let loaded = false;

// Every read-modify-write goes through this chain so rapid location fixes can't race the union.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}

const isRing = (r: unknown): r is Position[] =>
  Array.isArray(r) && r.length >= 4 && r.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));

/** Rejects anything that isn't a sane Polygon/MultiPolygon feature so turf never sees garbage. */
function parseGeometry(raw: any): ExploredGeometry {
  const g = raw?.type === 'Feature' ? raw.geometry : null;
  if (g?.type === 'Polygon' && Array.isArray(g.coordinates) && g.coordinates.every(isRing)) {
    return raw as Feature<Polygon>;
  }
  if (
    g?.type === 'MultiPolygon' &&
    Array.isArray(g.coordinates) &&
    g.coordinates.every((poly: unknown) => Array.isArray(poly) && poly.every(isRing))
  ) {
    return raw as Feature<MultiPolygon>;
  }
  return null;
}

export async function loadExplored(): Promise<ExploredGeometry> {
  if (!loaded) {
    // A failed read throws and leaves `loaded` false, so the next add retries instead of saving one circle over the map.
    current = parseGeometry(await loadStrict<unknown>(KEYS.scratchMap));
    loaded = true;
  }
  return current;
}

async function addNow({ latitude, longitude }: Coordinate): Promise<ExploredGeometry> {
  const prev = await loadExplored();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return prev;
  const point = turf.point([longitude, latitude]);
  // Fast path: most fixes land inside an area that is already revealed.
  if (prev) {
    try {
      if (turf.booleanPointInPolygon(point, prev.geometry)) return prev;
    } catch {
      // Fall through to the union.
    }
  }
  const circle = turf.circle([longitude, latitude], RADIUS_KM, { steps: 16, units: 'kilometers' });
  let next: ExploredGeometry = circle;
  if (prev) {
    try {
      const union = turf.union(turf.featureCollection<Polygon | MultiPolygon>([prev, circle]));
      if (!union) return prev;
      // ~1.5 m tolerance drops the redundant vertices each union adds.
      next = turf.simplify(union, { tolerance: 0.000015, highQuality: false, mutate: true }) as ExploredGeometry;
    } catch {
      return prev;
    }
  }
  current = next;
  await save(KEYS.scratchMap, next);
  return next;
}

/** Reveals a 120 m circle around `c`. Returns the same object when nothing changed. */
export function addExplored(c: Coordinate): Promise<ExploredGeometry> {
  return serial(() => addNow(c));
}

export function clearExplored(): Promise<void> {
  return serial(async () => {
    current = null;
    loaded = true;
    await save(KEYS.scratchMap, null);
  });
}

/** Outer rings of the explored area, as holes for the world-mask fog polygon. */
export function exploredHoles(g: ExploredGeometry): Coordinate[][] {
  if (!g?.geometry) return [];
  const polygons: Position[][][] = g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates;
  return polygons
    .map((poly) => poly[0])
    .filter((ring) => Array.isArray(ring) && ring.length >= 3)
    .map((ring) => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
}

// Must be defined at module scope so the OS can wake the app straight into it.
try {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const latest = data.locations[data.locations.length - 1];
    if (latest?.coords) await addExplored(latest.coords);
  });
} catch {
  // Not supported on this platform (e.g. web) or already defined after a fast refresh.
}

/** Asks for background location and starts tracking. Only call when the user turns Scratch Map on. */
export async function startBackgroundScratch(): Promise<boolean> {
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== Location.PermissionStatus.GRANTED) return false;
    if (!(await Location.hasStartedLocationUpdatesAsync(TASK))) {
      await Location.startLocationUpdatesAsync(TASK, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 50, // battery: a fix every 50 m is plenty for 120 m circles
        deferredUpdatesInterval: 15000,
        pausesUpdatesAutomatically: true,
        activityType: Location.ActivityType.AutomotiveNavigation,
        foregroundService: {
          notificationTitle: 'Scratch Map is on',
          notificationBody: 'Revealing the places you visit as you travel.',
          notificationColor: '#007AFF',
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundScratch(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch {
    // Task was never registered on this device; nothing to stop.
  }
}
