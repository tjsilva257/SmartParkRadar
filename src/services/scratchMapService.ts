import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng } from 'react-native-maps';

const STORAGE_KEY = '@scratch_map_geojson_v1';
export const EXPLORE_RADIUS_KM = 0.12; // 120 meters radius for a visible scratch trail

export type ExploredGeometry =
  | Feature<Polygon>
  | Feature<MultiPolygon>
  | null;

// In-memory cache for ultra-fast access
let currentExploredGeometry: ExploredGeometry = null;
let isLoaded = false;

export async function loadExploredGeometry(): Promise<ExploredGeometry> {
  if (isLoaded && currentExploredGeometry) return currentExploredGeometry;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      currentExploredGeometry = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error loading scratch map geometry:', err);
  }
  isLoaded = true;
  return currentExploredGeometry;
}

export async function clearExploredGeometry(): Promise<void> {
  currentExploredGeometry = null;
  isLoaded = true;
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/**
 * Adds a new coordinate, merges it with the explored polygon,
 * and saves to persistent storage.
 */
export async function addExploredCoordinate(
  latitude: number,
  longitude: number
): Promise<ExploredGeometry> {
  if (!isLoaded) {
    await loadExploredGeometry();
  }

  const point = turf.point([longitude, latitude]);

  // 1. FAST PATH: Check if coordinate is already revealed within current explored area
  if (currentExploredGeometry) {
    try {
      const isAlreadyExplored = turf.booleanPointInPolygon(point, currentExploredGeometry.geometry);
      if (isAlreadyExplored) {
        return currentExploredGeometry; // Zero overhead!
      }
    } catch {
      // Fallback to union if test throws
    }
  }

  // 2. Generate circular polygon with optimized vertex count (steps: 16)
  const newCircle = turf.circle([longitude, latitude], EXPLORE_RADIUS_KM, {
    steps: 16,
    units: 'kilometers',
  });

  // 3. Union new circle into existing geometry
  let updatedGeometry: ExploredGeometry = null;

  if (!currentExploredGeometry) {
    updatedGeometry = newCircle;
  } else {
    try {
      const fc = turf.featureCollection([
        currentExploredGeometry as Feature<Polygon | MultiPolygon>,
        newCircle,
      ]);
      const unionResult = turf.union(fc);
      if (unionResult) {
        // Simplify slightly to eliminate redundant collinear points (~1.5m tolerance)
        updatedGeometry = turf.simplify(unionResult, {
          tolerance: 0.000015,
          highQuality: false,
          mutate: true,
        }) as ExploredGeometry;
      } else {
        updatedGeometry = currentExploredGeometry;
      }
    } catch (e) {
      console.warn('Turf union failed, keeping previous geometry:', e);
      updatedGeometry = currentExploredGeometry;
    }
  }

  currentExploredGeometry = updatedGeometry;

  // 4. Async persist without blocking
  if (updatedGeometry) {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedGeometry)).catch((e) =>
      console.warn('Failed to persist scratch map:', e)
    );
  }

  return updatedGeometry;
}

/**
 * Converts GeoJSON Polygon / MultiPolygon into an array of hole rings for react-native-maps.
 */
export function convertGeoJsonToHoles(geometry: ExploredGeometry): LatLng[][] {
  if (!geometry || !geometry.geometry) return [];

  const holes: LatLng[][] = [];
  const { type, coordinates } = geometry.geometry;

  if (type === 'Polygon') {
    // coordinates[0] is the outer ring
    const ring = (coordinates as number[][][])[0];
    if (ring && ring.length >= 3) {
      holes.push(
        ring.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }))
      );
    }
  } else if (type === 'MultiPolygon') {
    // coordinates is Array of Polygons
    (coordinates as number[][][][]).forEach((polygonCoords) => {
      const outerRing = polygonCoords[0];
      if (outerRing && outerRing.length >= 3) {
        holes.push(
          outerRing.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }))
        );
      }
    });
  }

  return holes;
}
