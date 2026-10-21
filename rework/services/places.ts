// Destination search (Photon → Nominatim → device geocoder → popular list) and reverse geocoding.
import * as Location from 'expo-location';
import type { Coordinate, Place, PoiCategory } from '../types';
import { distanceMeters } from '../lib/geo';
import { fetchJson } from '../lib/http';

export const POPULAR_PLACES: Place[] = [
  {
    id: 'popular-centraal-station',
    name: 'Centraal Station',
    subtitle: 'Stationsplein 1, Amsterdam',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.3791, longitude: 4.9003 },
    poiCategory: 'transit',
  },
  {
    id: 'popular-dam-square',
    name: 'Dam Square & Royal Palace',
    subtitle: 'Dam, 1012 JS Amsterdam',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.3731, longitude: 4.8926 },
    poiCategory: 'generic',
  },
  {
    id: 'popular-museumplein',
    name: 'Museumplein / Rijksmuseum',
    subtitle: 'Museumstraat 1, Amsterdam',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.3599, longitude: 4.8852 },
    poiCategory: 'museum',
  },
  {
    id: 'popular-leidseplein',
    name: 'Leidseplein',
    subtitle: 'Leidseplein, 1017 PT Amsterdam',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.3644, longitude: 4.8827 },
    poiCategory: 'generic',
  },
  {
    id: 'popular-vondelpark',
    name: 'Vondelpark',
    subtitle: 'Vondelpark, Amsterdam',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.358, longitude: 4.8686 },
    poiCategory: 'park',
  },
  {
    id: 'popular-schiphol-p3',
    name: 'Schiphol Airport P3',
    subtitle: 'Holiday Valet Parking, Schiphol',
    city: 'Schiphol',
    state: 'Noord-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.3105, longitude: 4.7683 },
    poiCategory: 'parking',
  },
  {
    id: 'popular-rotterdam-centraal',
    name: 'Rotterdam Centraal',
    subtitle: 'Stationsplein 1, 3013 AJ Rotterdam',
    city: 'Rotterdam',
    state: 'Zuid-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 51.9244, longitude: 4.4777 },
    poiCategory: 'transit',
  },
  {
    id: 'popular-markthal',
    name: 'Rotterdam Centrum / Markthal',
    subtitle: 'Ds. Jan Scharpstraat 298, Rotterdam',
    city: 'Rotterdam',
    state: 'Zuid-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 51.9201, longitude: 4.4868 },
    poiCategory: 'shopping',
  },
  {
    id: 'popular-utrecht-centraal',
    name: 'Utrecht Centraal',
    subtitle: 'Stationshal 12, 3511 CE Utrecht',
    city: 'Utrecht',
    state: 'Utrecht',
    country: 'Netherlands',
    coordinate: { latitude: 52.0894, longitude: 5.1102 },
    poiCategory: 'transit',
  },
  {
    id: 'popular-den-haag-centraal',
    name: 'Den Haag Centraal',
    subtitle: 'Koningin Julianaplein 10, Den Haag',
    city: 'Den Haag',
    state: 'Zuid-Holland',
    country: 'Netherlands',
    coordinate: { latitude: 52.0809, longitude: 4.3248 },
    poiCategory: 'transit',
  },
];

// OSM key=value → category; a key alone ('*') covers every value of that key.
const OSM_CATEGORIES: Record<string, Record<string, PoiCategory>> = {
  amenity: {
    cafe: 'cafe',
    restaurant: 'restaurant',
    fast_food: 'restaurant',
    food_court: 'restaurant',
    ice_cream: 'restaurant',
    bar: 'bar',
    pub: 'bar',
    biergarten: 'bar',
    nightclub: 'bar',
    parking: 'parking',
    parking_entrance: 'parking',
    parking_space: 'parking',
    bicycle_parking: 'parking',
    bus_station: 'transit',
    ferry_terminal: 'transit',
    arts_centre: 'museum',
    marketplace: 'shopping',
  },
  shop: { bakery: 'bakery', pastry: 'bakery', confectionery: 'bakery', '*': 'shopping' },
  railway: { '*': 'transit' },
  public_transport: { '*': 'transit' },
  highway: { bus_stop: 'transit' },
  building: { train_station: 'transit', transportation: 'transit' },
  tourism: { museum: 'museum', gallery: 'museum' },
  leisure: { park: 'park', garden: 'park', nature_reserve: 'park' },
  landuse: { forest: 'park', recreation_ground: 'park', retail: 'shopping' },
};

// Ordered like the original detector. `bar\b`/`park\b` match "wijnbar"/"Vondelpark" but not "Barentszstraat"/"Parkweg".
const NAME_RULES: [RegExp, PoiCategory][] = [
  [/caf[eé]|coffee|koffie|espresso|roastery/, 'cafe'],
  [/bakker|bakery|patisserie|croissant|koek/, 'bakery'],
  [/bar\b|\bpub\b|brouwerij|brewery|bier|lounge/, 'bar'],
  [/restaurant|bistrot?|brasserie|pancake|pizz|burger|sushi|kitchen|eten|steak/, 'restaurant'],
  [/parking|parkeer|garage|\bp\+r\b/, 'parking'],
  [/station|centraal/, 'transit'],
  [/museum/, 'museum'],
  [/park\b/, 'park'],
];

/** OSM tags win when they map to a category; otherwise keywords in the name decide. */
export function poiCategoryFor(name: string, osmKey?: string, osmValue?: string): PoiCategory {
  const byKey = osmKey ? OSM_CATEGORIES[osmKey] : undefined;
  const fromTags = byKey && ((osmValue && byKey[osmValue]) || byKey['*']);
  if (fromTags) return fromTags;
  const lower = (name || '').toLowerCase();
  return NAME_RULES.find(([re]) => re.test(lower))?.[1] ?? 'generic';
}

const MEME_QUERIES = new Set(['6-7', '6 - 7', '6 7', '67']);
export function isMemeQuery(query: string): boolean {
  return MEME_QUERIES.has(query.trim().toLowerCase());
}

/**
 * Title + subtitle for a geocoder hit. Named POIs get "Street 12, City" underneath; bare addresses
 * and streets become the title themselves, with "City, State, Country" underneath.
 */
function titleAndSubtitle(
  ownName: string,
  street: string,
  houseNumber: string,
  city: string,
  state: string,
  country: string
): { name: string; subtitle: string } {
  const streetLine = [street, houseNumber].filter(Boolean).join(' ');
  const area = [city, state, country].filter(Boolean).join(', ') || 'Location';
  if (ownName && street && ownName !== street) return { name: ownName, subtitle: [streetLine, city].filter(Boolean).join(', ') };
  return { name: ownName || streetLine, subtitle: area };
}

/** Typo-tolerant variants: "apple straat" → "appel straat" → "appelstraat". */
function queryVariants(trimmed: string): string[] {
  const variants = [trimmed];
  const appel = trimmed.replace(/\bapple\b/gi, 'appel');
  if (appel.toLowerCase() !== trimmed.toLowerCase()) variants.push(appel);
  const joined = appel.replace(/\s+(straat|weg|laan|plein|kade|gracht|dijk|singel|pad|steeg|dreef)\b/gi, '$1');
  if (joined.toLowerCase() !== appel.toLowerCase()) variants.push(joined);
  return variants;
}

const textOf = (v: unknown): string => (typeof v === 'string' ? v : '');

interface Ranked {
  place: Place;
  meters: number;
}

function parsePhotonFeature(f: any, near: Coordinate): Ranked | null {
  const p = f?.properties ?? {};
  const [lon, lat] = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const city = textOf(p.city || p.town || p.village || p.municipality || p.district || p.county);
  const state = textOf(p.state);
  const country = textOf(p.country);
  const { name, subtitle } = titleAndSubtitle(textOf(p.name), textOf(p.street), textOf(p.housenumber), city, state, country);
  if (!name) return null;
  const coordinate = { latitude: lat as number, longitude: lon as number };
  return {
    place: {
      id: p.osm_type && p.osm_id != null ? `photon-${p.osm_type}${p.osm_id}` : `photon-${lat}-${lon}`,
      name,
      subtitle,
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
      coordinate,
      poiCategory: poiCategoryFor(name, textOf(p.osm_key) || undefined, textOf(p.osm_value) || undefined),
    },
    meters: distanceMeters(near, coordinate),
  };
}

// Geocoders sometimes return a namesake on another continent; drop those when closer matches exist.
function nearestFirst(results: Ranked[], max: number): Ranked[] {
  const local = results.filter((r) => r.meters < 1_500_000);
  return (local.length > 0 ? local : results).sort((a, b) => a.meters - b.meters).slice(0, max);
}

async function searchPhoton(variants: string[], near: Coordinate): Promise<Ranked[]> {
  const seen = new Set<string>();
  const results: Ranked[] = [];
  // Most-normalized variant first: it's the one most likely to hit a Dutch street name.
  for (const variant of [...variants].reverse()) {
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(variant)}` +
      `&lat=${near.latitude}&lon=${near.longitude}&limit=16`;
    const data = await fetchJson(url, { timeoutMs: 2800 });
    for (const f of Array.isArray(data?.features) ? data.features : []) {
      const r = parsePhotonFeature(f, near);
      if (!r) continue;
      // Same street name in different cities stays as separate results.
      const key = `${r.place.name}|${r.place.city ?? ''}|${r.place.country ?? ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(r);
    }
    if (results.length >= 8) break;
  }
  return nearestFirst(results, 10);
}

async function searchNominatim(query: string, near: Coordinate): Promise<Ranked[]> {
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=8`,
    { timeoutMs: 4000 }
  );
  const results: Ranked[] = [];
  for (const item of Array.isArray(data) ? data : []) {
    const lat = parseFloat(item?.lat);
    const lon = parseFloat(item?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const addr = item.address ?? {};
    const city = textOf(addr.city || addr.town || addr.village || addr.municipality);
    const state = textOf(addr.state);
    const country = textOf(addr.country);
    const titled = titleAndSubtitle(
      textOf(item.name),
      textOf(addr.road || addr.pedestrian),
      textOf(addr.house_number),
      city,
      state,
      country
    );
    const name = titled.name || textOf(item.display_name).split(',')[0] || query;
    const coordinate = { latitude: lat, longitude: lon };
    results.push({
      place: {
        id: item.osm_type && item.osm_id != null ? `nominatim-${item.osm_type}${item.osm_id}` : `nominatim-${lat}-${lon}`,
        name,
        subtitle: titled.subtitle,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
        coordinate,
        poiCategory: poiCategoryFor(name, textOf(item.class) || undefined, textOf(item.type) || undefined),
      },
      meters: distanceMeters(near, coordinate),
    });
  }
  return nearestFirst(results, 8);
}

async function searchDevice(query: string): Promise<Place[]> {
  try {
    const found = await Location.geocodeAsync(query);
    return found.slice(0, 4).map((g) => ({
      id: `geo-${g.latitude.toFixed(5)}-${g.longitude.toFixed(5)}`,
      name: query,
      subtitle: `${g.latitude.toFixed(4)}, ${g.longitude.toFixed(4)}`,
      coordinate: { latitude: g.latitude, longitude: g.longitude },
      poiCategory: poiCategoryFor(query),
    }));
  } catch {
    return [];
  }
}

/** Results nearest-first. Empty query or nothing found anywhere → []. */
export async function searchPlaces(query: string, near: Coordinate): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const photon = await searchPhoton(queryVariants(trimmed), near);
  if (photon.length > 0) return photon.map((r) => r.place);

  const nominatim = await searchNominatim(trimmed, near);
  if (nominatim.length > 0) return nominatim.map((r) => r.place);

  const device = await searchDevice(trimmed);
  if (device.length > 0) return device;

  const lower = trimmed.toLowerCase();
  return POPULAR_PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.subtitle.toLowerCase().includes(lower) ||
      (p.city ?? '').toLowerCase().includes(lower)
  );
}

const POI_KEYS = new Set(['amenity', 'shop', 'tourism', 'leisure', 'historic', 'office', 'craft']);

// ponytail: fixed 30 m radius regardless of zoom; scale it with the visible region if taps feel off.
/** Named OSM POI within ~30 m of a tap (Apple Maps has no POI tap event); null when there is none. */
export async function poiAt(c: Coordinate): Promise<Place | null> {
  const data = await fetchJson(
    `https://photon.komoot.io/reverse?lat=${c.latitude}&lon=${c.longitude}&radius=0.03&limit=5`,
    { timeoutMs: 2500 }
  );
  const features: any[] = Array.isArray(data?.features) ? data.features : [];
  const f = features.find((x) => textOf(x?.properties?.name) && POI_KEYS.has(textOf(x?.properties?.osm_key)));
  return f ? parsePhotonFeature(f, c)?.place ?? null : null;
}

/** Address for a tapped/dropped point via the device geocoder; null when it has nothing. */
export async function reverseGeocode(coordinate: Coordinate): Promise<Place | null> {
  try {
    const [p] = await Location.reverseGeocodeAsync(coordinate);
    if (!p) return null;
    const name = p.name || p.street || 'Dropped Pin';
    const streetLine = [p.street, p.streetNumber].filter(Boolean).join(' ');
    const subtitle =
      [streetLine, p.city].filter(Boolean).join(', ') ||
      [p.region, p.country].filter(Boolean).join(', ') ||
      `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`;
    return {
      id: `pin-${coordinate.latitude.toFixed(5)}-${coordinate.longitude.toFixed(5)}`,
      name,
      subtitle,
      coordinate,
      city: p.city ?? undefined,
      state: p.region ?? undefined,
      country: p.country ?? undefined,
      poiCategory: poiCategoryFor(name),
    };
  } catch {
    return null;
  }
}
