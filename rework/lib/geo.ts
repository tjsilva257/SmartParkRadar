import { Coordinate } from '../types';

const R = 6371e3;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Haversine distance in meters (unrounded). */
export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Initial compass bearing a -> b in degrees [0, 360). */
export function bearing(a: Coordinate, b: Coordinate): number {
  const φ1 = rad(a.latitude);
  const φ2 = rad(b.latitude);
  const Δλ = rad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Moves `origin` by meters east (dx) and north (dy). Fine for < ~10 km. */
export function offsetMeters(origin: Coordinate, dx: number, dy: number): Coordinate {
  return {
    latitude: origin.latitude + dy / 111320,
    longitude: origin.longitude + dx / (111320 * Math.cos(rad(origin.latitude))),
  };
}

/** Bounding box [minLat, minLon, maxLat, maxLon] of a radius around a point. */
export function bbox(center: Coordinate, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos(rad(center.latitude)));
  return [center.latitude - dLat, center.longitude - dLon, center.latitude + dLat, center.longitude + dLon];
}

export function centroid(points: Coordinate[]): Coordinate {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const sum = points.reduce(
    (s, p) => ({ latitude: s.latitude + p.latitude, longitude: s.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}

/**
 * Gently curved fake road between two points, used only when OSRM is unreachable
 * so the map still shows something plausible.
 */
export function fallbackPath(start: Coordinate, end: Coordinate, steps = 12): Coordinate[] {
  const pts: Coordinate[] = [start];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const bend = Math.sin(t * Math.PI) * 0.0006;
    pts.push({
      latitude: start.latitude + (end.latitude - start.latitude) * t + bend,
      longitude: start.longitude + (end.longitude - start.longitude) * t - bend * 0.6,
    });
  }
  pts.push(end);
  return pts;
}

/** Cumulative distance (m) at each vertex of a polyline; [0, d01, d01+d12, ...]. */
export function cumulativeDistances(path: Coordinate[]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) out.push(out[i - 1] + distanceMeters(path[i - 1], path[i]));
  return out;
}

/**
 * Point and heading at `meters` along a polyline. `cumulative` must come from
 * cumulativeDistances(path). Clamps to the ends.
 */
export function pointAlong(
  path: Coordinate[],
  cumulative: number[],
  meters: number
): { coordinate: Coordinate; heading: number; index: number } {
  if (path.length === 0) return { coordinate: { latitude: 0, longitude: 0 }, heading: 0, index: 0 };
  if (path.length === 1 || meters <= 0) {
    return { coordinate: path[0], heading: path.length > 1 ? bearing(path[0], path[1]) : 0, index: 0 };
  }
  const total = cumulative[cumulative.length - 1];
  if (meters >= total) {
    const n = path.length;
    return { coordinate: path[n - 1], heading: bearing(path[n - 2], path[n - 1]), index: n - 1 };
  }
  // Binary search the segment containing `meters`.
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= meters) lo = mid;
    else hi = mid;
  }
  const segLen = cumulative[hi] - cumulative[lo] || 1;
  const t = (meters - cumulative[lo]) / segLen;
  const a = path[lo];
  const b = path[hi];
  return {
    coordinate: {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    },
    heading: bearing(a, b),
    index: lo,
  };
}

/**
 * Rectangular parking area (width x length meters, rotated by bearingDeg) with
 * evenly spaced stall divider lines across its length.
 */
export function parkingRectangle(
  center: Coordinate,
  widthMeters: number,
  lengthMeters: number,
  bearingDeg: number,
  stalls: number
): { polygon: Coordinate[]; stallLines: [Coordinate, Coordinate][] } {
  const c = Math.cos(rad(bearingDeg));
  const s = Math.sin(rad(bearingDeg));
  const at = (x: number, y: number) => offsetMeters(center, x * c - y * s, x * s + y * c);
  const hw = widthMeters / 2;
  const hl = lengthMeters / 2;
  const polygon = [at(-hw, -hl), at(hw, -hl), at(hw, hl), at(-hw, hl)];
  const stallLines: [Coordinate, Coordinate][] = [];
  for (let i = 1; i < stalls; i++) {
    const y = -hl + (i * lengthMeters) / stalls;
    stallLines.push([at(-hw, y), at(hw, y)]);
  }
  return { polygon, stallLines };
}

/** "350 m", "1.2 km", "12 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    const rounded = meters < 100 ? Math.round(meters / 10) * 10 : Math.round(meters / 50) * 50;
    return `${Math.max(rounded, 10)} m`;
  }
  return meters < 10000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters / 1000)} km`;
}

/** Apple Maps style: "1 min", "12 min", "1 hr 5 min". */
export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Wall-clock arrival "14:32" for a trip of `seconds` starting now. */
export function formatArrival(seconds: number, now = new Date()): string {
  const t = new Date(now.getTime() + seconds * 1000);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Walking time at ~4.8 km/h (80 m/min), at least 1 minute. */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}
