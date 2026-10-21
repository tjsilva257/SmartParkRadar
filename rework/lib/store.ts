import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedValue, SavedValue } from './savedValue';

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

/** A value kept in AsyncStorage under `key`, with savedValue's read and write rules. */
export function persisted<T>(key: string, parse: (raw: unknown) => T): SavedValue<T> {
  return savedValue(AsyncStorage, key, parse);
}
