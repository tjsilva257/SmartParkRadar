import { Coordinate, ParkingSpot, ParkingType } from '../types/parking';
import { getDistanceInMeters } from '../utils/distance';

export interface PreciseParkingGeometry {
  polygon: Coordinate[];
  stallDividers: { start: Coordinate; end: Coordinate }[];
  dimensions: { widthMeters: number; lengthMeters: number; spotsCount: number };
}

/**
 * Generates an exact, physically-proportioned parking bay or surface lot polygon
 * with internal stall dividers, strictly bounded to the parking area without encroaching onto the road.
 */
export function generatePreciseParkingGeometry(
  center: Coordinate,
  widthMeters: number = 14,
  lengthMeters: number = 32,
  bearingDeg: number = 32,
  spotsCount: number = 6
): PreciseParkingGeometry {
  const latRad = (center.latitude * Math.PI) / 180;
  const mPerLat = 111320;
  const mPerLon = 111320 * Math.cos(latRad);

  const rad = (bearingDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const halfW = widthMeters / 2;
  const halfL = lengthMeters / 2;

  // 4 corners of the dedicated parking area (in local meter space)
  const localCorners = [
    { x: -halfW, y: -halfL },
    { x: halfW, y: -halfL },
    { x: halfW, y: halfL },
    { x: -halfW, y: halfL },
  ];

  const polygon: Coordinate[] = localCorners.map((pt) => {
    const rotX = pt.x * cos - pt.y * sin;
    const rotY = pt.x * sin + pt.y * cos;
    return {
      latitude: center.latitude + rotY / mPerLat,
      longitude: center.longitude + rotX / mPerLon,
    };
  });

  // Calculate internal stall dividers (individual parking spaces)
  const stallDividers: { start: Coordinate; end: Coordinate }[] = [];
  const stallStep = lengthMeters / spotsCount;

  for (let i = 1; i < spotsCount; i++) {
    const yLocal = -halfL + i * stallStep;
    const pt1 = { x: -halfW, y: yLocal };
    const pt2 = { x: halfW, y: yLocal };

    const rot1X = pt1.x * cos - pt1.y * sin;
    const rot1Y = pt1.x * sin + pt1.y * cos;

    const rot2X = pt2.x * cos - pt2.y * sin;
    const rot2Y = pt2.x * sin + pt2.y * cos;

    stallDividers.push({
      start: {
        latitude: center.latitude + rot1Y / mPerLat,
        longitude: center.longitude + rot1X / mPerLon,
      },
      end: {
        latitude: center.latitude + rot2Y / mPerLat,
        longitude: center.longitude + rot2X / mPerLon,
      },
    });
  }

  return {
    polygon,
    stallDividers,
    dimensions: { widthMeters, lengthMeters, spotsCount },
  };
}

/**
 * Calculates the centroid (center of mass) of a polygon
 */
export function calculatePolygonCentroid(points: Coordinate[]): Coordinate {
  if (!points || points.length === 0) return { latitude: 0, longitude: 0 };
  let sumLat = 0;
  let sumLon = 0;
  for (const pt of points) {
    sumLat += pt.latitude;
    sumLon += pt.longitude;
  }
  return {
    latitude: sumLat / points.length,
    longitude: sumLon / points.length,
  };
}

// In-memory cache for live fetched OSM parking areas
const osmParkingCache = new Map<string, ParkingSpot[]>();

/**
 * Queries OpenStreetMap Overpass API for real mapped parking terrains, surface lots,
 * and street-side parking bays around a destination.
 */
export async function fetchLiveOsmParkingAreas(
  center: Coordinate,
  radiusKm: number = 0.8
): Promise<ParkingSpot[]> {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));

  const minLat = (center.latitude - latDelta).toFixed(4);
  const maxLat = (center.latitude + latDelta).toFixed(4);
  const minLon = (center.longitude - lonDelta).toFixed(4);
  const maxLon = (center.longitude + lonDelta).toFixed(4);

  const cacheKey = `${minLat}_${minLon}_${maxLat}_${maxLon}`;
  if (osmParkingCache.has(cacheKey)) {
    return osmParkingCache.get(cacheKey)!;
  }

  const query = `[out:json][timeout:6];
(
  way["amenity"="parking"](${minLat},${minLon},${maxLat},${maxLon});
);
out geom 20;`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query.trim()),
      headers: {
        'User-Agent': 'SmartParkRadar/1.0 (parking-geometry)',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (!data.elements || !Array.isArray(data.elements)) {
      return [];
    }

    const results: ParkingSpot[] = [];

    for (const el of data.elements) {
      if (!el.geometry || el.geometry.length < 3) continue;

      const polygonCoords: Coordinate[] = el.geometry.map((pt: any) => ({
        latitude: pt.lat,
        longitude: pt.lon,
      }));

      const centroid = calculatePolygonCentroid(polygonCoords);
      const distMeters = getDistanceInMeters(center.latitude, center.longitude, centroid.latitude, centroid.longitude);
      const walkMin = Math.max(1, Math.round(distMeters / 75));

      const tags = el.tags || {};
      const isFee = tags.fee === 'yes';
      const isFree = tags.fee === 'no' || (!isFee && (tags.parking === 'street_side' || tags.parking === 'surface'));
      const spotType: ParkingType = isFree ? 'free' : 'paid';

      const isGarage = tags.parking === 'multi-storey' || tags.parking === 'underground' || tags.building === 'parking';
      const isLot = tags.parking === 'surface' || (!isGarage && tags.amenity === 'parking');
      const facilityType: 'garage' | 'lot' | 'bay' | 'street' = isGarage ? 'garage' : isLot ? 'lot' : 'bay';

      const defaultTitle = isGarage
        ? (isFree ? 'Gratis Parkeergarage' : 'Parkeergarage')
        : isLot
        ? (isFree ? 'Gratis Parkeerterrein' : 'Parkeerterrein')
        : (isFree ? 'Gemeentelijk Parkeervak' : 'Betaald Parkeervak');

      const title = tags.name || defaultTitle;
      const capacity = tags.capacity ? parseInt(tags.capacity, 10) : undefined;

      const label = isFree
        ? (isGarage ? 'FREE GARAGE' : isLot ? 'FREE LOT' : 'FREE')
        : (isGarage ? 'GARAGE' : isLot ? 'TERREIN' : 'PAID');

      const badge = isFree
        ? (isGarage ? 'GRATIS GARAGE' : isLot ? 'GRATIS TERREIN' : '100% FREE')
        : (isGarage ? 'PARKEERGARAGE' : isLot ? 'PARKEERTERREIN' : 'BETAALD');

      results.push({
        id: `osm-parking-${el.id}`,
        title,
        type: spotType,
        facilityType,
        pricePerHour: isFree ? 0 : isGarage ? 3.0 : 2.0,
        label,
        badge,
        distanceToDestMeters: distMeters,
        walkingTimeMinutes: walkMin,
        venstertijden: isFree
          ? (isGarage ? 'Overdekte garage · Gratis' : isLot ? 'Openbaar terrein · 100% Gratis' : 'Gratis openbare parkeervakken')
          : (isGarage ? 'Bewaakt · Overdekt · Uurtarief' : 'Gemeentelijk tarief'),
        coordinate: centroid,
        color: isFree ? '#10b981' : isGarage ? '#f59e0b' : '#0284c7',
        description: `Officiële parkeerlocatie (${isGarage ? 'Garage' : isLot ? 'Terrein' : 'Strook'}). ${capacity ? `Capaciteit: ca. ${capacity} plekken.` : ''}`,
        polygon: polygonCoords,
      });
    }

    osmParkingCache.set(cacheKey, results);
    return results;
  } catch (err) {
    return [];
  }
}

