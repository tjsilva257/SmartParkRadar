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

