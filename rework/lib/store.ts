import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys are shared with the original app on purpose: favorites, home,
// recents, hazards, icon filters and the scratch map carry over.
export const KEYS = {
  home: '@smartpark_home_v1',
  work: '@smartpark_work_v1',
  favorites: '@smartpark_favorites_v1',
  recents: '@smartpark_recents_v1',
  hazards: '@smartpark_hazards_v1',
  iconFilters: '@smartpark_icon_filters_v1',
  scratchMap: '@scratch_map_geojson_v1',
  mapSettings: '@smartpark_map_settings_v2',
} as const;

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * Like load(), but tells a missing/corrupt entry (undefined) apart from a failed
 * read (throws), so callers that seed defaults don't overwrite data they couldn't read.
 */
export async function loadStrict<T>(key: string): Promise<T | undefined> {
  const raw = await AsyncStorage.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the in-memory state still works for this session.
  }
}
