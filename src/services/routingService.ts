import { Coordinate, TurnManeuver } from '../types/parking';
import { generateRouteWaypoints, getDistanceInMeters } from '../utils/distance';

export interface RouteResult {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  distanceFormatted: string;
  durationMinutes: number;
  maneuvers: TurnManeuver[];
}

function getManeuverIcon(type: string, modifier?: string): string {
  if (type === 'arrive') return '🏁';
  if (type === 'depart') return '🚗';
  if (modifier) {
    if (modifier.includes('right')) return '↱';
    if (modifier.includes('left')) return '↰';
    if (modifier.includes('straight')) return '⬆️';
    if (modifier.includes('uturn')) return '↩️';
  }
  return '⬆️';
}

function formatManeuverText(step: any): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier || '';
  const street = step.name || 'road';

  if (type === 'depart') {
    return `Head onto ${street}`;
  }
  if (type === 'arrive') {
    return `Arrive at parking destination`;
  }
  if (type === 'roundabout') {
    return `Take roundabout onto ${street}`;
  }
  if (type === 'fork') {
    return `Take the ${modifier} fork onto ${street}`;
  }
  if (type === 'on ramp') {
    return `Take highway on-ramp onto ${street}`;
  }
  if (type === 'off ramp') {
    return `Take highway exit onto ${street}`;
  }
  if (type === 'turn') {
    return `Turn ${modifier} onto ${street}`;
  }
  if (type === 'new name') {
    return `Continue onto ${street}`;
  }

  return `Continue straight onto ${street}`;
}

/**
 * Fetches real road-following route coordinates using Open Source Routing Machine (OSRM).
 * Follows actual streets, highways, junctions and turns with turn-by-turn directions.
 */
export async function fetchRoadRoute(
  start: Coordinate,
  end: Coordinate,
  mode: 'driving' | 'walking' = 'driving'
): Promise<RouteResult> {
  const osrmUrl = `https://router.project-osrm.org/route/v1/${mode}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const rawCoords: [number, number][] = route.geometry.coordinates;

        // Convert [lon, lat] GeoJSON to { latitude, longitude }
        const coordinates: Coordinate[] = rawCoords.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        const distanceMeters = Math.round(route.distance);
        const durationSeconds = Math.round(route.duration);
        const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
        const distanceKm = (distanceMeters / 1000).toFixed(1);
        const distanceFormatted = distanceMeters > 1000 ? `${distanceKm} km` : `${distanceMeters} m`;

        // Extract real turn-by-turn steps
        const maneuvers: TurnManeuver[] = [];
        if (route.legs && route.legs[0]?.steps) {
          for (const step of route.legs[0].steps) {
            const stepDist = Math.round(step.distance);
            const distText = stepDist > 1000 ? `${(stepDist / 1000).toFixed(1)} km` : `${stepDist} m`;
            maneuvers.push({
              instruction: formatManeuverText(step),
              street: step.name || 'Destination approach',
              distanceText: distText,
              icon: getManeuverIcon(step.maneuver?.type, step.maneuver?.modifier),
            });
          }
        }

        return {
          coordinates,
          distanceMeters,
          durationSeconds,
          distanceFormatted,
          durationMinutes,
          maneuvers: maneuvers.length > 0 ? maneuvers : [
            {
              instruction: `Follow road to destination`,
              street: 'Main route',
              distanceText: distanceFormatted,
              icon: '🚗',
            }
          ],
        };
      }
    }
  } catch (error) {
    // Network offline / timeout fallback to geometric calculation
  }

  // Graceful Fallback if OSRM is unreachable
  const fallbackCoords = generateRouteWaypoints(start, end, 16);
  const estMeters = getDistanceInMeters(start.latitude, start.longitude, end.latitude, end.longitude);
  const estMinutes = Math.max(2, Math.round(estMeters / (mode === 'driving' ? 500 : 75)));
  const estKm = (estMeters / 1000).toFixed(1);

  return {
    coordinates: fallbackCoords,
    distanceMeters: estMeters,
    durationSeconds: estMinutes * 60,
    distanceFormatted: estMeters > 1000 ? `${estKm} km` : `${estMeters} m`,
    durationMinutes: estMinutes,
    maneuvers: [
      {
        instruction: `Head towards parking space`,
        street: 'Route road',
        distanceText: `${estKm} km`,
        icon: '🚗',
      },
    ],
  };
}
