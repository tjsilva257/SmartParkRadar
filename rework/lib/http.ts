// One fetch helper for every network source (OSRM, Overpass, Photon, Nominatim, PDOK).
// All callers treat failure as "no data" and fall back locally, so this never throws.

const USER_AGENT = 'SmartParkRadar/2.0 (Expo app)';

export async function fetchJson<T = any>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T | null> {
  const { timeoutMs = 6000, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...(headers as object) },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

// ponytail: unbounded in-memory cache keyed by query text; fine for one session of map use.
const overpassCache = new Map<string, OverpassElement[]>();

// Public instances from the OSM wiki. The main one returns 502/504 when overloaded,
// so retry once on an EU-hosted, no-logging mirror before giving up.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/**
 * Runs an Overpass QL query. `body` is everything after the `[out:json]` header,
 * e.g. `(node["highway"="speed_camera"](52.3,4.8,52.4,4.9););out body 50;`.
 * Results (including empty ones) are cached per query string; network failures are not.
 */
export async function overpass(body: string, timeoutMs = 5000): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:10];${body}`;
  const cached = overpassCache.get(query);
  if (cached) return cached;
  let data: { elements?: OverpassElement[] } | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    data = await fetchJson<{ elements?: OverpassElement[] }>(endpoint, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeoutMs,
    });
    if (data) break;
  }
  if (!data) return [];
  const elements = Array.isArray(data.elements) ? data.elements : [];
  overpassCache.set(query, elements);
  return elements;
}

/** Overpass bbox literal "(s,w,n,e)" with fixed precision so cache keys are stable. */
export function overpassBox([s, w, n, e]: [number, number, number, number], digits = 3): string {
  return `(${s.toFixed(digits)},${w.toFixed(digits)},${n.toFixed(digits)},${e.toFixed(digits)})`;
}
