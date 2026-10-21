import AsyncStorage from '@react-native-async-storage/async-storage';
import { MapIconFilterSettings, DEFAULT_ICON_FILTERS } from '../types/parking';

const STORAGE_KEY_ICON_FILTERS = '@smartpark_icon_filters_v1';

/**
 * Retrieves the persisted map icon filter settings, falling back to all visible by default.
 */
export async function getIconFilters(): Promise<MapIconFilterSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_ICON_FILTERS);
    if (!raw) return DEFAULT_ICON_FILTERS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ICON_FILTERS, ...parsed };
  } catch (error) {
    console.warn('[iconFilterService] Failed to load icon filters:', error);
    return DEFAULT_ICON_FILTERS;
  }
}

/**
 * Persists the user's map icon filter preferences.
 */
export async function saveIconFilters(filters: MapIconFilterSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_ICON_FILTERS, JSON.stringify(filters));
  } catch (error) {
    console.warn('[iconFilterService] Failed to save icon filters:', error);
  }
}
