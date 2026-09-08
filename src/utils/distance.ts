import { Coordinate } from '../types/parking';

/**
 * Calculates distance in meters between two coordinates using the Haversine formula
 */
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Generates intermediate street-like coordinates between start and end for smooth route rendering
 */
export function generateRouteWaypoints(start: Coordinate, end: Coordinate, steps = 8): Coordinate[] {
  const points: Coordinate[] = [start];
  for (let i = 1; i <= steps; i++) {
    const ratio = i / (steps + 1);
    const latBend = Math.sin(ratio * Math.PI) * 0.0007;
    const lonBend = Math.cos(ratio * Math.PI) * 0.0005;
    points.push({
      latitude: start.latitude + (end.latitude - start.latitude) * ratio + (i % 2 === 0 ? latBend : -latBend * 0.4),
      longitude: start.longitude + (end.longitude - start.longitude) * ratio + (i % 2 === 1 ? lonBend : -lonBend * 0.4),
    });
  }
  points.push(end);
  return points;
}
