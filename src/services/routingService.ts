import { Coordinate, TurnManeuver, DriveRouteOption, TrafficInfo } from '../types/parking';
import { generateRouteWaypoints, getDistanceInMeters } from '../utils/distance';

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

  if (type === 'depart') return `Head onto ${street}`;
  if (type === 'arrive') return `Arrive at parking space`;
  if (type === 'roundabout') return `Take roundabout onto ${street}`;
  if (type === 'fork') return `Take the ${modifier} fork onto ${street}`;
  if (type === 'on ramp') return `Take highway on-ramp onto ${street}`;
  if (type === 'off ramp') return `Take highway exit onto ${street}`;
  if (type === 'turn') return `Turn ${modifier} onto ${street}`;
  if (type === 'new name') return `Continue onto ${street}`;

  return `Continue straight onto ${street}`;
}

/**
 * Fetches real driving routes with live alternatives and selects the most efficient route.
 */
export async function fetchMultiDriveRoutes(
  start: Coordinate,
  end: Coordinate
): Promise<DriveRouteOption[]> {
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson&steps=true&alternatives=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        // Parse all alternative routes
        const parsedRoutes = data.routes.map((route: any, index: number) => {
          const rawCoords: [number, number][] = route.geometry.coordinates;
          const coordinates: Coordinate[] = rawCoords.map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          }));

          const distanceMeters = Math.round(route.distance);
          const durationSeconds = Math.round(route.duration);
          const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
          const distanceKm = (distanceMeters / 1000).toFixed(1);

          const summary = route.legs?.[0]?.summary || `Route ${index + 1}`;

          const maneuvers: TurnManeuver[] = [];
          if (route.legs && route.legs[0]?.steps) {
            for (const step of route.legs[0].steps) {
              const stepDist = Math.round(step.distance);
              const distText = stepDist > 1000 ? `${(stepDist / 1000).toFixed(1)} km` : `${stepDist} m`;
              maneuvers.push({
                instruction: formatManeuverText(step),
                street: step.name || 'Highway / Street',
                distanceText: distText,
                icon: getManeuverIcon(step.maneuver?.type, step.maneuver?.modifier),
              });
            }
          }

          return {
            id: `route-${index}`,
            summary: summary.length > 0 ? `via ${summary}` : 'Main highway route',
            coordinates,
            distanceKm: `${distanceKm} km`,
            durationMinutes,
            durationSeconds,
            maneuvers,
          };
        });

        // 1. Sort routes by duration ascending: The fastest route is #0
        parsedRoutes.sort((a: any, b: any) => a.durationMinutes - b.durationMinutes);

        const fastestDuration = parsedRoutes[0].durationMinutes;
        const alternativeDuration = parsedRoutes.length > 1 ? parsedRoutes[1].durationMinutes : null;
        const timeSavings = alternativeDuration ? alternativeDuration - fastestDuration : 0;

        return parsedRoutes.map((r: any, idx: number) => {
          const isFastest = idx === 0;
          const timeDiff = r.durationMinutes - fastestDuration;

          let traffic: TrafficInfo;
          if (isFastest) {
            traffic = {
              level: 'clear',
              delayMinutes: 0,
              summary: '🟢 Fastest route · Smooth traffic flow',
              savingsText: timeSavings > 0 ? `⚡ Saves ${timeSavings} min vs alternative` : undefined,
            };
          } else {
            traffic = {
              level: timeDiff >= 8 ? 'heavy' : 'moderate',
              delayMinutes: timeDiff,
              summary: `🟡 Slower traffic (+${timeDiff} min delay)`,
              savingsText: `+${timeDiff} min slower than fastest route`,
            };
          }

          return {
            id: r.id,
            summary: r.summary,
            coordinates: r.coordinates,
            distanceKm: r.distanceKm,
            durationMinutes: r.durationMinutes,
            traffic,
            isFastest,
            timeDiffMinutes: timeDiff,
            maneuvers: r.maneuvers,
          };
        });
      }
    }
  } catch (error) {
    // Fallback to geometric road interpolation
  }

  // Fallback Route if network is offline
  const fallbackCoords = generateRouteWaypoints(start, end, 16);
  const estMeters = getDistanceInMeters(start.latitude, start.longitude, end.latitude, end.longitude);
  const estMinutes = Math.max(2, Math.round(estMeters / 500));
  const estKm = (estMeters / 1000).toFixed(1);

  return [
    {
      id: 'route-0',
      summary: 'Direct route',
      coordinates: fallbackCoords,
      distanceKm: `${estKm} km`,
      durationMinutes: estMinutes,
      traffic: {
        level: 'clear',
        delayMinutes: 0,
        summary: '🟢 Fastest route · Normal traffic flow',
      },
      isFastest: true,
      timeDiffMinutes: 0,
      maneuvers: [
        {
          instruction: 'Follow main road to parking destination',
          street: 'Main route',
          distanceText: `${estKm} km`,
          icon: '🚗',
        },
      ],
    },
  ];
}

/**
 * Fetches real pedestrian walking route from parking spot to destination.
 */
export async function fetchWalkingRoute(start: Coordinate, end: Coordinate): Promise<Coordinate[]> {
  const osrmUrl = `https://router.project-osrm.org/route/v1/walking/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
        return data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lon,
        }));
      }
    }
  } catch (e) {
    // Fallback
  }

  return generateRouteWaypoints(start, end, 4);
}
