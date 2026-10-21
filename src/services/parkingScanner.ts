import { Coordinate, ParkingSpot } from '../types/parking';
import { getDistanceInMeters } from '../utils/distance';
import { generatePreciseParkingGeometry } from './parkingAreaService';

export function scanNearbyParkingSpots(
  center: Coordinate,
  maxWalkingMeters: number = 500
): {
  spots: ParkingSpot[];
  optimalSpot: ParkingSpot | null;
  nearestFreeSpot: ParkingSpot | null;
} {
  const dLat = center.latitude;
  const dLon = center.longitude;

  const rawCandidates = [
    // 1. FREE PARKING GARAGE (Covered, free 2h or P+R, ~110m away)
    {
      id: 'spot-garage-free',
      title: 'P+R / Centrum Parkeergarage (Gratis 2u)',
      facilityType: 'garage' as const,
      type: 'free' as const,
      pricePerHour: 0,
      label: 'FREE GARAGE',
      badge: 'GRATIS GARAGE',
      venstertijden: 'Overdekt · Eerste 2 uur gratis · Daarna €1.50/h',
      color: '#10b981',
      offset: { lat: 0.0008, lon: -0.0009 },
      dimensions: { width: 22, length: 30, bearing: 15, spotsCount: 10 },
      description: 'Overdekte parkeergarage vlakbij bestemming met gratis parkeerregeling.',
    },
    // 2. FREE SURFACE PARKING LOT (~260m away)
    {
      id: 'spot-lot-free',
      title: 'Gemeentelijk Gratis Parkeerterrein',
      facilityType: 'lot' as const,
      type: 'free' as const,
      pricePerHour: 0,
      label: 'FREE LOT',
      badge: 'GRATIS TERREIN',
      venstertijden: 'Gratis 24/7 · Geen parkeermeter of blauwe schijf',
      color: '#10b981',
      offset: { lat: -0.0016, lon: 0.0017 },
      dimensions: { width: 26, length: 36, bearing: 60, spotsCount: 14 },
      description: 'Ruim openbaar parkeerterrein, 100% kosteloos buiten de openbare weg.',
    },
    // 3. FREE ROADSIDE PARKING STRIP (~480m away)
    {
      id: 'spot-free-strip',
      title: 'Openbare Gratis Parkeerstrook',
      facilityType: 'bay' as const,
      type: 'free' as const,
      pricePerHour: 0,
      label: 'FREE',
      badge: '100% FREE',
      venstertijden: 'Vrij parkeren langs de weg zonder vergunning',
      color: '#10b981',
      offset: { lat: 0.0031, lon: 0.0026 },
      dimensions: { width: 12, length: 34, bearing: 40, spotsCount: 6 },
      description: 'Gemarkeerde parkeerstrook langs rustige zijstraat.',
    },
    // 4. CLOSE PAID PARKING GARAGE (Covered, directly at destination, ~70m away)
    {
      id: 'spot-garage-paid',
      title: 'Centrum Parkeergarage (Direct bij bestemming)',
      facilityType: 'garage' as const,
      type: 'paid' as const,
      pricePerHour: 3.5,
      label: '€3.50/h',
      badge: 'PARKEERGARAGE',
      venstertijden: '24/7 Bewaakt · Overdekt · Directe lift naar straat',
      color: '#f59e0b',
      offset: { lat: 0.0005, lon: 0.0004 },
      dimensions: { width: 20, length: 26, bearing: 0, spotsCount: 8 },
      description: 'Moderne bewaakte parkeergarage direct naast uw bestemming.',
    },
    // 5. CHEAP SURFACE PARKING LOT (~160m away)
    {
      id: 'spot-lot-cheap',
      title: 'Voordelig Buurt Parkeerterrein',
      facilityType: 'lot' as const,
      type: 'cheap' as const,
      pricePerHour: 1.5,
      label: '€1.50/h',
      badge: 'GOEDKOOP TERREIN',
      venstertijden: '€1.50/h · Gratis na 19:00 & alle zondagen',
      color: '#0284c7',
      offset: { lat: -0.0010, lon: -0.0011 },
      dimensions: { width: 18, length: 30, bearing: -35, spotsCount: 8 },
      description: 'Lokaal buurterrein met laag gemeentelijk tarief.',
    },
    // 6. BLUE ZONE DISC PARKING (~220m away)
    {
      id: 'spot-blue-1',
      title: 'Blauwe Zone Parkeerhaven (2u)',
      facilityType: 'bay' as const,
      type: 'blue' as const,
      pricePerHour: 0,
      label: 'BLAUW 2U',
      badge: 'BLAUWE ZONE',
      venstertijden: 'Max 2 uur parkeren met blauwe parkeerschijf',
      color: '#2563eb',
      offset: { lat: 0.0013, lon: -0.0016 },
      dimensions: { width: 12, length: 28, bearing: 115, spotsCount: 5 },
      description: 'Blauwe zone parkeerschijf vereist ma-za 09:00 - 18:00.',
    },
    // 7. ACTIVE WARDEN HAZARD
    {
      id: 'hazard-1',
      title: 'Actieve Parkeerhandhaving / Scan-auto',
      facilityType: 'street' as const,
      type: 'hazard' as const,
      pricePerHour: 0,
      label: '⚠️ WARDEN',
      badge: 'HAZARD',
      venstertijden: 'Scan-auto gerapporteerd door bestuurder 4m geleden',
      color: '#dc2626',
      offset: { lat: -0.0009, lon: 0.0012 },
      dimensions: { width: 10, length: 20, bearing: 0, spotsCount: 3 },
      description: 'Gemeentelijke scan-auto controleert kentekens actief.',
    },
  ];

  const spots: ParkingSpot[] = rawCandidates.map((s) => {
    const spotCoord: Coordinate = {
      latitude: dLat + s.offset.lat,
      longitude: dLon + s.offset.lon,
    };
    const distMeters = getDistanceInMeters(dLat, dLon, spotCoord.latitude, spotCoord.longitude);
    const walkMin = Math.max(1, Math.round(distMeters / 75));

    const geom = generatePreciseParkingGeometry(
      spotCoord,
      s.dimensions.width,
      s.dimensions.length,
      s.dimensions.bearing,
      s.dimensions.spotsCount
    );

    return {
      id: s.id,
      title: s.title,
      type: s.type,
      facilityType: s.facilityType,
      pricePerHour: s.pricePerHour,
      label: s.label,
      badge: s.badge,
      distanceToDestMeters: distMeters,
      walkingTimeMinutes: walkMin,
      venstertijden: s.venstertijden,
      coordinate: spotCoord,
      color: s.color,
      description: s.description,
      polygon: geom.polygon,
      stallDividers: geom.stallDividers,
      areaDimensions: geom.dimensions,
    };
  });

  const validSpots = spots.filter((s) => s.type !== 'hazard');

  // Identify absolute closest free spot regardless of current filter (for UI recommendation)
  const allFreeSpots = validSpots
    .filter((s) => s.type === 'free')
    .sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);
  const nearestFreeSpot = allFreeSpots.length > 0 ? allFreeSpots[0] : null;

  // 1. Filter spots strictly within user's chosen walking distance
  const inRangeCandidates = validSpots.filter(
    (s) => s.distanceToDestMeters <= maxWalkingMeters
  );

  let optimalSpot: ParkingSpot | null = null;

  if (inRangeCandidates.length > 0) {
    // Step A: Is there a free spot (garage, lot, or bay) within the chosen walking distance?
    const freeInRange = inRangeCandidates
      .filter((s) => s.type === 'free')
      .sort((a, b) => {
        // If a garage or lot is free and within walking distance, give it slight preference, then distance
        const aScore = (a.facilityType === 'garage' ? -30 : a.facilityType === 'lot' ? -15 : 0) + a.distanceToDestMeters;
        const bScore = (b.facilityType === 'garage' ? -30 : b.facilityType === 'lot' ? -15 : 0) + b.distanceToDestMeters;
        return aScore - bScore;
      });

    if (freeInRange.length > 0) {
      optimalSpot = freeInRange[0];
    } else {
      // Step B: Free parking is outside the walking range!
      // Check for blue disc zones within range (free stay)
      const blueInRange = inRangeCandidates
        .filter((s) => s.type === 'blue')
        .sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);

      if (blueInRange.length > 0) {
        optimalSpot = blueInRange[0];
      } else {
        // Step C: Choose closest/best parking garage or lot within chosen walking range
        const paidInRange = [...inRangeCandidates].sort((a, b) => {
          // Prefer covered garages & designated lots over street parking if prices are comparable
          if (a.pricePerHour !== b.pricePerHour) return a.pricePerHour - b.pricePerHour;
          return a.distanceToDestMeters - b.distanceToDestMeters;
        });

        optimalSpot = paidInRange[0] || null;
      }
    }
  }

  // Fallback if no candidate is within chosen walking distance
  if (!optimalSpot && validSpots.length > 0) {
    // Pick the closest spot overall to avoid leaving user stranded
    const sortedByDist = [...validSpots].sort(
      (a, b) => a.distanceToDestMeters - b.distanceToDestMeters
    );
    optimalSpot = sortedByDist[0];
  }

  return { spots, optimalSpot, nearestFreeSpot };
}

