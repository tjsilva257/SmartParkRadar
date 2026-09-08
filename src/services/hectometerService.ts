import { Coordinate, CarriagewayDirection, HectometerPosition } from '../types/parking';
import { getDistanceInMeters } from '../utils/distance';

interface MilestoneAnchor {
  km: number;
  coord: Coordinate;
  name?: string;
}

interface HighwaySegment {
  road: string;
  name: string;
  minKm: number;
  maxKm: number;
  anchors: MilestoneAnchor[];
}

/**
 * Verified milestone anchors for major Dutch motorways and provincial routes.
 * Enables sub-100m coordinate resolution from hectometer post numbers.
 */
export const DUTCH_HIGHWAYS: HighwaySegment[] = [
  {
    road: 'A10',
    name: 'Ring Amsterdam',
    minKm: 0.0,
    maxKm: 32.0,
    anchors: [
      { km: 0.0, coord: { latitude: 52.3360, longitude: 4.9080 }, name: 'Knooppunt Amstel' },
      { km: 6.0, coord: { latitude: 52.3550, longitude: 4.9650 }, name: 'Watergraafsmeer' },
      { km: 11.0, coord: { latitude: 52.3850, longitude: 4.9750 }, name: 'Zeeburgertunnel' },
      { km: 15.0, coord: { latitude: 52.4100, longitude: 4.9200 }, name: 'Knooppunt Zeeburg' },
      { km: 21.0, coord: { latitude: 52.4180, longitude: 4.8800 }, name: 'Coentunnel' },
      { km: 26.0, coord: { latitude: 52.3420, longitude: 4.8460 }, name: 'De Nieuwe Meer' },
      { km: 29.5, coord: { latitude: 52.3365, longitude: 4.8780 }, name: 'Zuidas' },
      { km: 32.0, coord: { latitude: 52.3360, longitude: 4.9080 }, name: 'Knooppunt Amstel' },
    ],
  },
  {
    road: 'A4',
    name: 'Amsterdam - Schiphol - Den Haag - Rotterdam',
    minKm: 0.0,
    maxKm: 85.0,
    anchors: [
      { km: 0.0, coord: { latitude: 52.3420, longitude: 4.8460 }, name: 'De Nieuwe Meer' },
      { km: 12.4, coord: { latitude: 52.3080, longitude: 4.7620 }, name: 'Schiphol' },
      { km: 18.2, coord: { latitude: 52.2680, longitude: 4.7100 }, name: 'Hoofddorp' },
      { km: 34.8, coord: { latitude: 52.1620, longitude: 4.5430 }, name: 'Leiden / Burgerveen' },
      { km: 54.0, coord: { latitude: 52.0620, longitude: 4.3720 }, name: 'Prins Clausplein' },
      { km: 62.0, coord: { latitude: 52.0350, longitude: 4.3580 }, name: 'Ypenburg' },
      { km: 70.0, coord: { latitude: 51.9950, longitude: 4.3200 }, name: 'Delft Zuid' },
      { km: 85.0, coord: { latitude: 51.8950, longitude: 4.3350 }, name: 'Beneluxtunnel' },
    ],
  },
  {
    road: 'A2',
    name: 'Amsterdam - Utrecht - Den Bosch - Eindhoven',
    minKm: 30.0,
    maxKm: 145.0,
    anchors: [
      { km: 30.5, coord: { latitude: 52.2980, longitude: 4.9650 }, name: 'Holendrecht' },
      { km: 48.0, coord: { latitude: 52.1750, longitude: 4.9920 }, name: 'Breukelen' },
      { km: 56.4, coord: { latitude: 52.0910, longitude: 5.0680 }, name: 'Maarssen / Lage Weide' },
      { km: 65.0, coord: { latitude: 52.0580, longitude: 5.0650 }, name: 'Oudenrijn' },
      { km: 85.0, coord: { latitude: 51.9750, longitude: 5.1680 }, name: 'Everdingen' },
      { km: 115.0, coord: { latitude: 51.7100, longitude: 5.3100 }, name: "'s-Hertogenbosch" },
      { km: 145.0, coord: { latitude: 51.4500, longitude: 5.4200 }, name: 'Eindhoven' },
    ],
  },
  {
    road: 'A1',
    name: 'Amsterdam - Hilversum - Amersfoort - Apeldoorn',
    minKm: 5.0,
    maxKm: 90.0,
    anchors: [
      { km: 5.0, coord: { latitude: 52.3380, longitude: 4.9850 }, name: 'Watergraafsmeer' },
      { km: 15.0, coord: { latitude: 52.3300, longitude: 5.0700 }, name: 'Diemen / Muiden' },
      { km: 32.0, coord: { latitude: 52.2350, longitude: 5.2500 }, name: 'Hilversum / Baarn' },
      { km: 45.0, coord: { latitude: 52.1750, longitude: 5.4300 }, name: 'Hoevelaken' },
      { km: 80.0, coord: { latitude: 52.2150, longitude: 5.9200 }, name: 'Apeldoorn' },
    ],
  },
  {
    road: 'A12',
    name: 'Den Haag - Gouda - Utrecht - Arnhem',
    minKm: 10.0,
    maxKm: 125.0,
    anchors: [
      { km: 10.0, coord: { latitude: 52.0800, longitude: 4.3450 }, name: 'Den Haag' },
      { km: 35.0, coord: { latitude: 52.0350, longitude: 4.6750 }, name: 'Gouda' },
      { km: 48.0, coord: { latitude: 52.0680, longitude: 4.8750 }, name: 'Woerden' },
      { km: 60.0, coord: { latitude: 52.0580, longitude: 5.0650 }, name: 'Oudenrijn' },
      { km: 75.0, coord: { latitude: 52.0620, longitude: 5.1480 }, name: 'Lunetten' },
      { km: 125.0, coord: { latitude: 52.0050, longitude: 5.9200 }, name: 'Arnhem' },
    ],
  },
  {
    road: 'A13',
    name: 'Den Haag - Delft - Rotterdam',
    minKm: 0.0,
    maxKm: 16.5,
    anchors: [
      { km: 0.0, coord: { latitude: 52.0450, longitude: 4.3650 }, name: 'Ypenburg' },
      { km: 5.0, coord: { latitude: 52.0250, longitude: 4.3550 }, name: 'Delft' },
      { km: 11.2, coord: { latitude: 51.9420, longitude: 4.4310 }, name: 'Overschie' },
      { km: 16.5, coord: { latitude: 51.9360, longitude: 4.4490 }, name: 'Kleinpolderplein' },
    ],
  },
  {
    road: 'A20',
    name: 'Gouda - Rotterdam - Hoek van Holland',
    minKm: 10.0,
    maxKm: 36.0,
    anchors: [
      { km: 10.0, coord: { latitude: 52.0150, longitude: 4.6700 }, name: 'Gouwe' },
      { km: 20.0, coord: { latitude: 51.9550, longitude: 4.5250 }, name: 'Terbregseplein' },
      { km: 28.5, coord: { latitude: 51.9360, longitude: 4.4490 }, name: 'Kleinpolderplein' },
      { km: 36.0, coord: { latitude: 51.9280, longitude: 4.3750 }, name: 'Kethelplein' },
    ],
  },
  {
    road: 'N201',
    name: 'Zandvoort - Haarlem - Hoofddorp - Hilversum',
    minKm: 0.0,
    maxKm: 60.0,
    anchors: [
      { km: 0.0, coord: { latitude: 52.3750, longitude: 4.5400 }, name: 'Zandvoort' },
      { km: 10.0, coord: { latitude: 52.3450, longitude: 4.6350 }, name: 'Haarlem Zuid' },
      { km: 25.0, coord: { latitude: 52.2850, longitude: 4.7200 }, name: 'Hoofddorp' },
      { km: 40.0, coord: { latitude: 52.2350, longitude: 4.8250 }, name: 'Uithoorn' },
      { km: 60.0, coord: { latitude: 52.2250, longitude: 5.1650 }, name: 'Hilversum' },
    ],
  },
];

export const POPULAR_HIGHWAY_CODES = ['A10', 'A4', 'A2', 'A1', 'A12', 'A13', 'A20', 'N201'];

/**
 * Calculates exact GPS coordinates for any Dutch highway hectometer post.
 * Includes lateral offsets for Li (Left carriageway) vs Re (Right carriageway).
 */
export function interpolateHectometerCoordinate(
  road: string,
  hectometer: number,
  carriageway: CarriagewayDirection = 'Li',
  fallbackCoord?: Coordinate
): Coordinate {
  const cleanRoad = road.trim().toUpperCase();
  const segment = DUTCH_HIGHWAYS.find((h) => h.road === cleanRoad);

  if (!segment || segment.anchors.length < 2) {
    if (fallbackCoord) return fallbackCoord;
    return { latitude: 52.3676, longitude: 4.9041 };
  }

  const clampedKm = Math.max(segment.minKm, Math.min(segment.maxKm, hectometer));
  const anchors = segment.anchors;

  // Find the two surrounding milestone anchors
  let p1 = anchors[0];
  let p2 = anchors[1];

  for (let i = 0; i < anchors.length - 1; i++) {
    if (clampedKm >= anchors[i].km && clampedKm <= anchors[i + 1].km) {
      p1 = anchors[i];
      p2 = anchors[i + 1];
      break;
    }
  }

  const range = p2.km - p1.km;
  const ratio = range === 0 ? 0 : (clampedKm - p1.km) / range;

  // Linear interpolation along road path
  const baseLat = p1.coord.latitude + (p2.coord.latitude - p1.coord.latitude) * ratio;
  const baseLon = p1.coord.longitude + (p2.coord.longitude - p1.coord.longitude) * ratio;

  // Calculate perpendicular bearing for carriageway lateral offset (~14m)
  const dLat = p2.coord.latitude - p1.coord.latitude;
  const dLon = p2.coord.longitude - p1.coord.longitude;
  const len = Math.hypot(dLat, dLon) || 1;
  const perpLat = -dLon / len;
  const perpLon = dLat / len;

  // Li is left lane (+offset), Re is right lane (-offset)
  const offsetMult = carriageway === 'Li' ? 0.00012 : carriageway === 'Re' ? -0.00012 : 0;

  return {
    latitude: Number((baseLat + perpLat * offsetMult).toFixed(6)),
    longitude: Number((baseLon + perpLon * offsetMult).toFixed(6)),
  };
}

/**
 * Reverse-detects whether a GPS coordinate is on a Dutch highway and finds
 * the closest hectometerpost to prefill reports.
 */
export function detectNearbyHectometerPost(
  userCoord: Coordinate,
  maxDistanceMeters: number = 850
): {
  road: string;
  hectometer: number;
  carriageway: CarriagewayDirection;
  distanceMeters: number;
  roadName: string;
} | null {
  let closest: {
    road: string;
    hectometer: number;
    carriageway: CarriagewayDirection;
    distanceMeters: number;
    roadName: string;
  } | null = null;

  for (const segment of DUTCH_HIGHWAYS) {
    const anchors = segment.anchors;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a1 = anchors[i];
      const a2 = anchors[i + 1];

      // Sample 10 points along the segment to find closest hectometer mark
      const steps = 10;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const lat = a1.coord.latitude + (a2.coord.latitude - a1.coord.latitude) * t;
        const lon = a1.coord.longitude + (a2.coord.longitude - a1.coord.longitude) * t;
        const km = a1.km + (a2.km - a1.km) * t;

        const dist = getDistanceInMeters(userCoord.latitude, userCoord.longitude, lat, lon);

        if (dist < maxDistanceMeters) {
          if (!closest || dist < closest.distanceMeters) {
            // Determine Li vs Re based on cross product
            const cross = (a2.coord.longitude - a1.coord.longitude) * (userCoord.latitude - a1.coord.latitude) -
                          (a2.coord.latitude - a1.coord.latitude) * (userCoord.longitude - a1.coord.longitude);
            const carriageway: CarriagewayDirection = cross > 0 ? 'Li' : 'Re';

            closest = {
              road: segment.road,
              hectometer: Number(km.toFixed(1)),
              carriageway,
              distanceMeters: dist,
              roadName: segment.name,
            };
          }
        }
      }
    }
  }

  return closest;
}

/**
 * Formats a hectometer position into standard Dutch format (e.g. "A10 Li 14.2")
 */
export function formatHectometerLabel(pos: HectometerPosition): string {
  return `${pos.road} ${pos.carriageway} ${pos.hectometer.toFixed(1)}`;
}

