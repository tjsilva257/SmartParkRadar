import AsyncStorage from '@react-native-async-storage/async-storage';
import { RoadHazard, HazardCategory, HectometerPosition, Coordinate } from '../types/parking';

const STORAGE_KEY_HAZARDS = '@smartpark_hazards_v1';

export const INITIAL_COMMUNITY_HAZARDS: RoadHazard[] = [
  {
    id: 'hazard-a10-mob-1',
    category: 'mobile_camera',
    title: 'Mobiele Flitser (Laser)',
    roadName: 'A10 Li 14.2',
    hectometerPost: {
      road: 'A10',
      hectometer: 14.2,
      carriageway: 'Li',
      description: 'A10 Ring Noord',
    },
    coordinate: { latitude: 52.4080, longitude: 4.9220 },
    reportedAt: Date.now() - 1000 * 60 * 12, // 12 mins ago
    reporterLabel: 'Driver #2841',
    confirmations: 4,
    note: 'Staat verdekt opgesteld achter viaduct',
  },
  {
    id: 'hazard-ams-scan-1',
    category: 'parking_warden',
    title: 'Scan-auto Handhaving',
    roadName: 'Overtoom / Vondelpark',
    coordinate: { latitude: 52.3610, longitude: 4.8720 },
    reportedAt: Date.now() - 1000 * 60 * 8, // 8 mins ago
    reporterLabel: 'Buurtbewoner',
    confirmations: 3,
    note: 'Rijdt richting Leidseplein, controleert blauwe zone',
  },
  {
    id: 'hazard-a4-work-1',
    category: 'road_work',
    title: 'Spoedreparatie Asfalt',
    roadName: 'A4 Re 17.8',
    hectometerPost: {
      road: 'A4',
      hectometer: 17.8,
      carriageway: 'Re',
      description: 'A4 Richting Schiphol',
    },
    coordinate: { latitude: 52.2720, longitude: 4.7150 },
    reportedAt: Date.now() - 1000 * 60 * 25,
    reporterLabel: 'Waze/Flitsmeister Feed',
    confirmations: 7,
    note: 'Rechterrijstrook afgekruist met rood kruis',
  },
];

/**
 * In-memory cache for live fetched roadworks and closures
 */
const liveBlockadesCache = new Map<string, RoadHazard[]>();

/**
 * Fetches real-time road construction, roadworks, and physical road blockades
 * from OpenStreetMap Overpass API within a radius around the driver.
 */
export async function fetchLiveRoadBlockades(
  center: Coordinate,
  radiusKm: number = 8
): Promise<RoadHazard[]> {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));

  const minLat = (center.latitude - latDelta).toFixed(3);
  const maxLat = (center.latitude + latDelta).toFixed(3);
  const minLon = (center.longitude - lonDelta).toFixed(3);
  const maxLon = (center.longitude + lonDelta).toFixed(3);

  const cacheKey = `${minLat}_${minLon}_${maxLat}_${maxLon}`;
  if (liveBlockadesCache.has(cacheKey)) {
    return liveBlockadesCache.get(cacheKey)!;
  }

  const query = `[out:json][timeout:10];
(
  way["highway"="construction"](${minLat},${minLon},${maxLat},${maxLon});
  way["construction"](${minLat},${minLon},${maxLat},${maxLon});
  node["barrier"="road_block"](${minLat},${minLon},${maxLat},${maxLon});
);
out center 35;`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query.trim()),
      headers: {
        'User-Agent': 'SmartParkRadar/1.0 (road-safety-feed)',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (!data.elements || !Array.isArray(data.elements)) {
      return [];
    }

    const liveHazards: RoadHazard[] = [];

    for (const el of data.elements) {
      const lat = el.lat || el.center?.lat;
      const lon = el.lon || el.center?.lon;
      if (!lat || !lon) continue;

      const tags = el.tags || {};
      const isBlockade = tags.barrier === 'road_block' || tags.access === 'no';
      const category: HazardCategory = isBlockade ? 'road_block' : 'road_work';

      const streetName = tags.name || tags.description || tags['ref'] || 'Lokale rijbaan';
      const title = isBlockade
        ? `Wegafsluiting: ${streetName}`
        : `Werkzaamheden: ${streetName}`;

      liveHazards.push({
        id: `osm-blockade-${el.id}`,
        category,
        title,
        roadName: streetName,
        coordinate: { latitude: lat, longitude: lon },
        reportedAt: Date.now() - 1000 * 60 * 30, // active live feed
        reporterLabel: 'OpenStreetMap Live',
        confirmations: 8,
        note: tags.description || tags.construction || 'Actueel gemeld op wegennet',
      });
    }

    liveBlockadesCache.set(cacheKey, liveHazards);
    return liveHazards;
  } catch (error) {
    // Graceful offline fallback
    return [];
  }
}

/**
 * Returns merged hazards: local community/user reports + live Overpass blockades
 */
export async function getMergedHazards(center?: Coordinate): Promise<RoadHazard[]> {
  const local = await getReportedHazards();
  if (!center) return local;

  try {
    const live = await fetchLiveRoadBlockades(center);
    // Deduplicate by ID
    const localIds = new Set(local.map((h) => h.id));
    const uniqueLive = live.filter((h) => !localIds.has(h.id));
    return [...local, ...uniqueLive];
  } catch {
    return local;
  }
}

/**
 * Loads all active community and user reported road hazards
 */
export async function getReportedHazards(): Promise<RoadHazard[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HAZARDS);
    if (!raw) {
      // Initialize with seed hazards
      await AsyncStorage.setItem(STORAGE_KEY_HAZARDS, JSON.stringify(INITIAL_COMMUNITY_HAZARDS));
      return INITIAL_COMMUNITY_HAZARDS;
    }
    const parsed = JSON.parse(raw) as RoadHazard[];
    return parsed;
  } catch (error) {
    console.warn('[hazardService] Failed to load hazards:', error);
    return INITIAL_COMMUNITY_HAZARDS;
  }
}

/**
 * Adds a new hazard report to storage
 */
export async function addReportedHazard(
  data: {
    category: HazardCategory;
    title: string;
    roadName: string;
    coordinate: Coordinate;
    hectometerPost?: HectometerPosition;
    note?: string;
  }
): Promise<RoadHazard> {
  const newHazard: RoadHazard = {
    id: `hazard_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    category: data.category,
    title: data.title,
    roadName: data.roadName,
    hectometerPost: data.hectometerPost,
    coordinate: data.coordinate,
    reportedAt: Date.now(),
    reporterLabel: 'Jij (Zojuist gemeld)',
    confirmations: 1,
    note: data.note,
  };

  try {
    const current = await getReportedHazards();
    const updated = [newHazard, ...current];
    await AsyncStorage.setItem(STORAGE_KEY_HAZARDS, JSON.stringify(updated));
  } catch (error) {
    console.warn('[hazardService] Failed to save new hazard:', error);
  }

  return newHazard;
}

/**
 * Confirms / upvotes an existing hazard
 */
export async function confirmHazard(id: string): Promise<RoadHazard[]> {
  try {
    const current = await getReportedHazards();
    const updated = current.map((h) => (h.id === id ? { ...h, confirmations: h.confirmations + 1 } : h));
    await AsyncStorage.setItem(STORAGE_KEY_HAZARDS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('[hazardService] Failed to confirm hazard:', error);
    return [];
  }
}

/**
 * Removes or marks hazard as resolved
 */
export async function removeHazard(id: string): Promise<RoadHazard[]> {
  try {
    const current = await getReportedHazards();
    const updated = current.filter((h) => h.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY_HAZARDS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('[hazardService] Failed to remove hazard:', error);
    return [];
  }
}


