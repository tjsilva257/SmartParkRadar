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
import { KEYS, persisted } from '../lib/store';

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
  home: { id: 'home_location', label: 'Home' },
  work: { id: 'work_location', label: 'Work' },
} as const;

function asSlot(raw: unknown, slot: 'home' | 'work'): SavedPlace | null {
  const p = parseSaved(raw, slot);
  return p && { ...p, id: SLOT[slot].id, category: slot, customLabel: SLOT[slot].label, poiCategory: slot };
}

const stored = {
  home: persisted(KEYS.home, (raw) => asSlot(raw, 'home')),
  work: persisted(KEYS.work, (raw) => asSlot(raw, 'work')),
  favorites: persisted(KEYS.favorites, (raw) => parseList(raw, 'favorite')),
  recents: persisted(KEYS.recents, (raw) => parseList(raw, 'recent')),
};

export async function loadSaved(): Promise<SavedState> {
  const [home, work, favorites, recents] = await Promise.all([
    stored.home.read(),
    stored.work.read(),
    stored.favorites.read(),
    stored.recents.read(),
  ]);
  return { home, work, favorites, recents };
}

/** Sets (or with null, removes) Home/Work. */
export function setSavedSlot(slot: 'home' | 'work', place: Place | null): Promise<SavedPlace | null> {
  return stored[slot].update(() =>
    place
      ? {
          ...toPlace(place),
          id: SLOT[slot].id,
          category: slot,
          customLabel: SLOT[slot].label,
          poiCategory: slot,
          savedAt: Date.now(),
        }
      : null
  );
}

const near = (a: Place, b: Place, deg: number) =>
  Math.abs(a.coordinate.latitude - b.coordinate.latitude) < deg &&
  Math.abs(a.coordinate.longitude - b.coordinate.longitude) < deg;

export function isFavorite(place: Place, favorites: SavedPlace[]): boolean {
  return favorites.some((f) => f.id === place.id || near(f, place, 0.0001));
}

/** Adds the place (newest first) or removes it if it's already a favorite. Returns the new list. */
export function toggleFavorite(place: Place): Promise<SavedPlace[]> {
  return stored.favorites.update((favorites) =>
    isFavorite(place, favorites)
      ? favorites.filter((f) => f.id !== place.id && !near(f, place, 0.0001))
      : [{ ...toPlace(place), category: 'favorite' as const, customLabel: place.name, savedAt: Date.now() }, ...favorites]
  );
}

/** Moves the place to the top of recents, replacing entries with the same name or nearly the same spot. */
export function addRecent(place: Place): Promise<SavedPlace[]> {
  const item: SavedPlace = { ...toPlace(place), category: 'recent', savedAt: Date.now() };
  return stored.recents.update((recents) =>
    [item, ...recents.filter((r) => r.name !== place.name && !near(r, place, 0.0005))].slice(0, 15)
  );
}

export async function clearRecents(): Promise<void> {
  await stored.recents.update(() => []);
}

/** The fields of `next` that differ from `prev`: saving only those patches what's stored instead of replacing it. */
function changedFields<T extends object>(prev: T, next: T): Partial<T> {
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => prev[k as keyof T] !== v)) as Partial<T>;
}

function parseIconFilters(raw: unknown): MapIconFilters {
  const stored = isRecord(raw) ? raw : {};
  const filters = { ...DEFAULT_ICON_FILTERS };
  for (const key of Object.keys(filters) as (keyof MapIconFilters)[]) {
    const v = stored[key];
    if (typeof v === 'boolean') filters[key] = v;
  }
  return filters;
}

const iconFilters = persisted(KEYS.iconFilters, parseIconFilters);

export function loadIconFilters(): Promise<MapIconFilters> {
  return iconFilters.read();
}

/** Saves what changed from `prev` to `next`. */
export async function saveIconFilters(prev: MapIconFilters, next: MapIconFilters): Promise<void> {
  const change = changedFields(prev, next);
  await iconFilters.update((f) => ({ ...f, ...change }));
}

function parseMapSettings(raw: unknown): MapSettings {
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

const mapSettings = persisted(KEYS.mapSettings, parseMapSettings);

export function loadMapSettings(): Promise<MapSettings> {
  return mapSettings.read();
}

/** Saves what changed from `prev` to `next`. */
export async function saveMapSettings(prev: MapSettings, next: MapSettings): Promise<void> {
  const change = changedFields(prev, next);
  await mapSettings.update((s) => ({ ...s, ...change }));
}
