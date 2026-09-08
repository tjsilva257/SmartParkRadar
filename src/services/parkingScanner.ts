import { Coordinate, ParkingSpot } from '../types/parking';
import { getDistanceInMeters } from '../utils/distance';

export function scanNearbyParkingSpots(center: Coordinate): {
  spots: ParkingSpot[];
  optimalSpot: ParkingSpot | null;
} {
  const dLat = center.latitude;
  const dLon = center.longitude;

  const rawCandidates = [
    {
      id: 'spot-free-1',
      title: 'Municipal Free Parking Strip',
      type: 'free' as const,
      pricePerHour: 0,
      label: 'FREE',
      badge: '100% FREE',
      venstertijden: 'Free 24/7 · No municipal tariff or disc needed',
      color: '#10b981',
      offset: { lat: 0.0016, lon: 0.0012 },
      description: 'Roadside municipal non-permit parking segment. 3 free spots usually open.',
    },
    {
      id: 'spot-blue-1',
      title: 'Canal Ring Blue Zone',
      type: 'blue' as const,
      pricePerHour: 0,
      label: 'BLUE 2H',
      badge: 'BLUE ZONE',
      venstertijden: 'Max 2h stay with disc · Free after 18:00 & Sundays',
      color: '#2563eb',
      offset: { lat: -0.0022, lon: 0.0021 },
      description: 'Blue zone parking disc required between 09:00 and 18:00.',
    },
    {
      id: 'spot-cheap-1',
      title: 'Low-Tariff Outer Strip',
      type: 'cheap' as const,
      pricePerHour: 1.5,
      label: '€1.50/h',
      badge: 'CHEAPEST PAID',
      venstertijden: '€1.50/h · 100% Free after 19:00 & all Sunday',
      color: '#0284c7',
      offset: { lat: 0.0031, lon: -0.0018 },
      description: 'Municipal perimeter tariff zone. Saves up to €5.50/h vs inner core.',
    },
    {
      id: 'spot-garage-1',
      title: 'City Center Secured Garage',
      type: 'paid' as const,
      pricePerHour: 4.5,
      label: '€4.50/h',
      badge: 'COVERED GARAGE',
      venstertijden: 'Open 24/7 · Covered · EV Charging bays',
      color: '#f59e0b',
      offset: { lat: 0.0011, lon: -0.0032 },
      description: 'Underground video-monitored facility with charging stations.',
    },
    {
      id: 'hazard-1',
      title: 'Active Parking Enforcement / Warden',
      type: 'hazard' as const,
      pricePerHour: 0,
      label: '⚠️ WARDEN',
      badge: 'HAZARD',
      venstertijden: 'Scan-car reported patrolling by driver 4m ago',
      color: '#dc2626',
      offset: { lat: -0.0011, lon: 0.0015 },
      description: 'Municipal license plate scanner car actively checking vehicles on this road.',
    },
  ];

  const spots: ParkingSpot[] = rawCandidates.map((s) => {
    const spotCoord: Coordinate = {
      latitude: dLat + s.offset.lat,
      longitude: dLon + s.offset.lon,
    };
    const distMeters = getDistanceInMeters(dLat, dLon, spotCoord.latitude, spotCoord.longitude);
    const walkMin = Math.max(1, Math.round(distMeters / 75));

    return {
      id: s.id,
      title: s.title,
      type: s.type,
      pricePerHour: s.pricePerHour,
      label: s.label,
      badge: s.badge,
      distanceToDestMeters: distMeters,
      walkingTimeMinutes: walkMin,
      venstertijden: s.venstertijden,
      coordinate: spotCoord,
      color: s.color,
      description: s.description,
    };
  });

  // Core Priority Algorithm:
  // 1. Free spots (100% free), lowest walking distance
  // 2. Blue zones, lowest walking distance
  // 3. Paid spots, lowest hourly price, then distance
  const candidates = spots.filter((s) => s.type !== 'hazard' && s.distanceToDestMeters <= 750);

  let optimalSpot: ParkingSpot | null = null;
  const freeSpots = candidates
    .filter((s) => s.type === 'free')
    .sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);

  if (freeSpots.length > 0) {
    optimalSpot = freeSpots[0];
  } else {
    const blueSpots = candidates
      .filter((s) => s.type === 'blue')
      .sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);

    if (blueSpots.length > 0) {
      optimalSpot = blueSpots[0];
    } else {
      const paidSpots = [...candidates].sort((a, b) => {
        if (a.pricePerHour !== b.pricePerHour) return a.pricePerHour - b.pricePerHour;
        return a.distanceToDestMeters - b.distanceToDestMeters;
      });
      optimalSpot = paidSpots[0] || null;
    }
  }

  return { spots, optimalSpot };
}
