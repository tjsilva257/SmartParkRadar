import AsyncStorage from '@react-native-async-storage/async-storage';
import { DestinationTarget, SavedLocation, SavedLocationCategory } from '../types/parking';

const STORAGE_KEY_HOME = '@smartpark_home_v1';
const STORAGE_KEY_FAVORITES = '@smartpark_favorites_v1';
const STORAGE_KEY_RECENTS = '@smartpark_recents_v1';

/**
 * Loads the user's saved Home location
 */
export async function getHomeLocation(): Promise<SavedLocation | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_HOME);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLocation;
  } catch (error) {
    console.warn('[favoritesService] Failed to load Home location:', error);
    return null;
  }
}

/**
 * Sets or updates the user's Home location
 */
export async function setHomeLocation(dest: DestinationTarget): Promise<SavedLocation> {
  const home: SavedLocation = {
    ...dest,
    id: 'home_location',
    category: 'home',
    customLabel: 'Home',
    savedAt: Date.now(),
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY_HOME, JSON.stringify(home));
  } catch (error) {
    console.warn('[favoritesService] Failed to save Home location:', error);
  }

  return home;
}

/**
 * Clears the saved Home location
 */
export async function removeHomeLocation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_HOME);
  } catch (error) {
    console.warn('[favoritesService] Failed to remove Home location:', error);
  }
}

/**
 * Loads all saved favorite locations
 */
export async function getFavorites(): Promise<SavedLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FAVORITES);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as SavedLocation[];
  } catch (error) {
    console.warn('[favoritesService] Failed to load favorites:', error);
    return [];
  }
}

/**
 * Adds a destination to favorites
 */
export async function addFavorite(
  dest: DestinationTarget,
  customLabel?: string,
  category: SavedLocationCategory = 'favorite'
): Promise<SavedLocation[]> {
  try {
    const current = await getFavorites();
    const id = dest.id || `fav_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Check if already in favorites by coordinates or name
    const existingIndex = current.findIndex(
      (f) =>
        f.id === dest.id ||
        (Math.abs(f.coordinate.latitude - dest.coordinate.latitude) < 0.0001 &&
          Math.abs(f.coordinate.longitude - dest.coordinate.longitude) < 0.0001)
    );

    const newFav: SavedLocation = {
      ...dest,
      id,
      category,
      customLabel: customLabel || dest.name,
      savedAt: Date.now(),
    };

    let updated: SavedLocation[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = newFav;
    } else {
      updated = [newFav, ...current];
    }

    await AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('[favoritesService] Failed to add favorite:', error);
    return [];
  }
}

/**
 * Removes a location from favorites
 */
export async function removeFavorite(idOrName: string): Promise<SavedLocation[]> {
  try {
    const current = await getFavorites();
    const updated = current.filter((f) => f.id !== idOrName && f.name !== idOrName);
    await AsyncStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('[favoritesService] Failed to remove favorite:', error);
    return [];
  }
}

/**
 * Check if a destination is currently saved as a favorite
 */
export function isFavorite(dest: DestinationTarget, favorites: SavedLocation[]): boolean {
  return favorites.some(
    (f) =>
      f.id === dest.id ||
      (Math.abs(f.coordinate.latitude - dest.coordinate.latitude) < 0.0001 &&
        Math.abs(f.coordinate.longitude - dest.coordinate.longitude) < 0.0001)
  );
}

/**
 * Loads recent searches
 */
export async function getRecents(): Promise<SavedLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_RECENTS);
    if (!raw) return [];
    return JSON.parse(raw) as SavedLocation[];
  } catch (error) {
    console.warn('[favoritesService] Failed to load recents:', error);
    return [];
  }
}

/**
 * Adds a destination to recent searches (keeps max 10 most recent)
 */
export async function addRecent(dest: DestinationTarget): Promise<SavedLocation[]> {
  try {
    const current = await getRecents();
    const id = dest.id || `recent_${Date.now()}`;
    const recentItem: SavedLocation = {
      ...dest,
      id,
      category: 'recent',
      savedAt: Date.now(),
    };

    // Filter out existing duplicates with same name or coordinates
    const filtered = current.filter(
      (r) =>
        r.name !== dest.name &&
        !(
          Math.abs(r.coordinate.latitude - dest.coordinate.latitude) < 0.0005 &&
          Math.abs(r.coordinate.longitude - dest.coordinate.longitude) < 0.0005
        )
    );

    const updated = [recentItem, ...filtered].slice(0, 10);
    await AsyncStorage.setItem(STORAGE_KEY_RECENTS, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('[favoritesService] Failed to add recent search:', error);
    return [];
  }
}

/**
 * Clears all recent searches
 */
export async function clearRecents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_RECENTS);
  } catch (error) {
    console.warn('[favoritesService] Failed to clear recents:', error);
  }
}

