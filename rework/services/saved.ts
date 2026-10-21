// Home / Work / Favorites / Recents, map icon filters and map settings, persisted under the original app's keys.
import type {
  CameraDisplayMode,
  MapIconFilters,
  MapMode,
  MapSettings,
  Place,
  PoiCategory,
  SavedCategory,
  SavedPlace,
  SavedState,
} from '../types';
import { DEFAULT_ICON_FILTERS, DEFAULT_MAP_SETTINGS } from '../types';
import { KEYS, load, save } from '../lib/store';

const POI_CATEGORIES: PoiCategory[] = [
  'cafe', 'restaurant', 'bakery', 'bar', 'parking', 'transit', 'museum', 'park', 'shopping', 'home', 'work', 'generic',
];
const MAP_MODES: MapMode[] = ['explore', 'driving', 'satellite'];
const CAMERA_MODES: CameraDisplayMode[] = ['always', 'trip_only', 'off'];

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Only the Place fields; drops SavedPlace extras and anything legacy (e.g. `distanceKm`). */
function toPlace(p: Place): Place {
  return {
    id: p.id,
    name: p.name,
    subtitle: p.subtitle,
    coordinate: { latitude: p.coordinate.latitude, longitude: p.coordinate.longitude },
    city: p.city,
    state: p.state,
    country: p.country,
    poiCategory: p.poiCategory,
  };
}

/** One stored entry → SavedPlace, or null when it lacks a name or a usable coordinate. */
function parseSaved(raw: unknown, category: SavedCategory): SavedPlace | null {
  if (!isRecord(raw)) return null;
  const name = str(raw.name);
  const c = isRecord(raw.coordinate) ? raw.coordinate : null;
  if (!name || !c || !finite(c.latitude) || !finite(c.longitude)) return null;
  const poi = raw.poiCategory as PoiCategory;
  return {
    id: str(raw.id) ?? name, // the original app saved popular places without ids
    name,
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    coordinate: { latitude: c.latitude, longitude: c.longitude },
    city: str(raw.city),
    state: str(raw.state),
    country: str(raw.country),
    poiCategory: POI_CATEGORIES.includes(poi) ? poi : undefined,
    category, // decided by which list it is stored in
    customLabel: str(raw.customLabel),
    savedAt: finite(raw.savedAt) ? raw.savedAt : undefined,
  };
}

function parseList(raw: unknown, category: SavedCategory): SavedPlace[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => parseSaved(r, category)).filter((p): p is SavedPlace => p !== null);
}

const SLOT = {
  home: { key: KEYS.home, id: 'home_location', label: 'Home' },
  work: { key: KEYS.work, id: 'work_location', label: 'Work' },
} as const;

function asSlot(raw: unknown, slot: 'home' | 'work'): SavedPlace | null {
  const p = parseSaved(raw, slot);
  return p && { ...p, id: SLOT[slot].id, category: slot, customLabel: SLOT[slot].label, poiCategory: slot };
}

export async function loadSaved(): Promise<SavedState> {
  const [home, work, favorites, recents] = await Promise.all([
    load<unknown>(KEYS.home, null),
    load<unknown>(KEYS.work, null),
    load<unknown>(KEYS.favorites, []),
    load<unknown>(KEYS.recents, []),
  ]);
  return {
    home: asSlot(home, 'home'),
    work: asSlot(work, 'work'),
    favorites: parseList(favorites, 'favorite'),
    recents: parseList(recents, 'recent'),
  };
}

/** Sets (or with null, removes) Home/Work. */
export async function setSavedSlot(slot: 'home' | 'work', place: Place | null): Promise<SavedPlace | null> {
  if (!place) {
    await save(SLOT[slot].key, null);
    return null;
  }
  const saved: SavedPlace = {
    ...toPlace(place),
    id: SLOT[slot].id,
    category: slot,
    customLabel: SLOT[slot].label,
    poiCategory: slot,
    savedAt: Date.now(),
  };
  await save(SLOT[slot].key, saved);
  return saved;
}

const near = (a: Place, b: Place, deg: number) =>
  Math.abs(a.coordinate.latitude - b.coordinate.latitude) < deg &&
  Math.abs(a.coordinate.longitude - b.coordinate.longitude) < deg;

export function isFavorite(place: Place, favorites: SavedPlace[]): boolean {
  return favorites.some((f) => f.id === place.id || near(f, place, 0.0001));
}

/** Adds the place (newest first) or removes it if it's already a favorite. Returns the new list. */
export async function toggleFavorite(place: Place, favorites: SavedPlace[]): Promise<SavedPlace[]> {
  const updated = isFavorite(place, favorites)
    ? favorites.filter((f) => f.id !== place.id && !near(f, place, 0.0001))
    : [{ ...toPlace(place), category: 'favorite' as const, customLabel: place.name, savedAt: Date.now() }, ...favorites];
  await save(KEYS.favorites, updated);
  return updated;
}

/** Moves the place to the top of recents, replacing entries with the same name or nearly the same spot. */
export async function addRecent(place: Place, recents: SavedPlace[]): Promise<SavedPlace[]> {
  const item: SavedPlace = { ...toPlace(place), category: 'recent', savedAt: Date.now() };
  const updated = [item, ...recents.filter((r) => r.name !== place.name && !near(r, place, 0.0005))].slice(0, 15);
  await save(KEYS.recents, updated);
  return updated;
}

export async function clearRecents(): Promise<void> {
  await save(KEYS.recents, null);
}

export async function loadIconFilters(): Promise<MapIconFilters> {
  const raw = await load<unknown>(KEYS.iconFilters, null);
  const stored = isRecord(raw) ? raw : {};
  const filters = { ...DEFAULT_ICON_FILTERS };
  for (const key of Object.keys(filters) as (keyof MapIconFilters)[]) {
    const v = stored[key];
    if (typeof v === 'boolean') filters[key] = v;
  }
  return filters;
}

export async function saveIconFilters(f: MapIconFilters): Promise<void> {
  await save(KEYS.iconFilters, f);
}

export async function loadMapSettings(): Promise<MapSettings> {
  const raw = await load<unknown>(KEYS.mapSettings, null);
  const s = isRecord(raw) ? raw : {};
  const d = DEFAULT_MAP_SETTINGS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    mode: MAP_MODES.includes(s.mode as MapMode) ? (s.mode as MapMode) : d.mode,
    showTraffic: bool(s.showTraffic, d.showTraffic),
    showScratchMap: bool(s.showScratchMap, d.showScratchMap),
    cameraDisplay: CAMERA_MODES.includes(s.cameraDisplay as CameraDisplayMode)
      ? (s.cameraDisplay as CameraDisplayMode)
      : d.cameraDisplay,
    voiceMuted: bool(s.voiceMuted, d.voiceMuted),
  };
}

export async function saveMapSettings(s: MapSettings): Promise<void> {
  await save(KEYS.mapSettings, s);
}
