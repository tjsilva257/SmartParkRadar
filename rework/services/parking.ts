// Parking near a destination: six estimated candidates around any point (works offline),
// plus real parking areas mapped in OpenStreetMap when Overpass answers.
import type { Coordinate, FacilityType, ParkingScan, ParkingSpot, ParkingType } from '../types';
import { bbox, centroid, distanceMeters, parkingRectangle, walkMinutes } from '../lib/geo';
import { overpass, overpassBox } from '../lib/http';

interface Candidate {
  id: string;
  title: string;
  type: ParkingType;
  facility: FacilityType;
  pricePerHour: number;
  rules: string;
  description: string;
  offset: { lat: number; lon: number };
  size: { width: number; length: number; bearing: number; stalls: number };
}

// Offsets and footprints match the original scanner so spots land where users saw them before.
const CANDIDATES: Candidate[] = [
  {
    id: 'spot-garage-free',
    title: 'P+R Central Garage (First 2 h Free)',
    type: 'free',
    facility: 'garage',
    pricePerHour: 0,
    rules: 'Covered · First 2 hours free · Then €1.50/h',
    description: 'Covered parking garage close to your destination with a free parking scheme.',
    offset: { lat: 0.0008, lon: -0.0009 },
    size: { width: 22, length: 30, bearing: 15, stalls: 10 },
  },
  {
    id: 'spot-lot-free',
    title: 'Free Municipal Parking Lot',
    type: 'free',
    facility: 'lot',
    pricePerHour: 0,
    rules: 'Free 24/7 · No meter or parking disc',
    description: 'Spacious public lot off the street, completely free of charge.',
    offset: { lat: -0.0016, lon: 0.0017 },
    size: { width: 26, length: 36, bearing: 60, stalls: 14 },
  },
  {
    id: 'spot-free-strip',
    title: 'Free Roadside Parking',
    type: 'free',
    facility: 'bay',
    pricePerHour: 0,
    rules: 'Free roadside parking, no permit needed',
    description: 'Marked parking strip along a quiet side street.',
    offset: { lat: 0.0031, lon: 0.0026 },
    size: { width: 12, length: 34, bearing: 40, stalls: 6 },
  },
  {
    id: 'spot-garage-paid',
    title: 'Central Parking Garage (At Destination)',
    type: 'paid',
    facility: 'garage',
    pricePerHour: 3.5,
    rules: 'Staffed 24/7 · Covered · Direct lift to the street',
    description: 'Modern staffed parking garage right next to your destination.',
    offset: { lat: 0.0005, lon: 0.0004 },
    size: { width: 20, length: 26, bearing: 0, stalls: 8 },
  },
  {
    id: 'spot-lot-cheap',
    title: 'Low-Cost Neighborhood Lot',
    type: 'cheap',
    facility: 'lot',
    pricePerHour: 1.5,
    rules: '€1.50/h · Free after 19:00 and on Sundays',
    description: 'Local neighborhood lot with a low municipal rate.',
    offset: { lat: -0.001, lon: -0.0011 },
    size: { width: 18, length: 30, bearing: -35, stalls: 8 },
  },
  {
    id: 'spot-blue-1',
    title: 'Blue Zone Parking Bays (2 h)',
    type: 'blue',
    facility: 'bay',
    pricePerHour: 0,
    rules: 'Max 2 hours with a blue parking disc',
    description: 'Blue parking disc required Mon–Sat 09:00–18:00.',
    offset: { lat: 0.0013, lon: -0.0016 },
    size: { width: 12, length: 28, bearing: 115, stalls: 5 },
  },
];

function priceLabel(type: ParkingType, pricePerHour: number): string {
  if (type === 'free') return 'Free';
  if (type === 'blue') return 'Blue zone · 2 h';
  return `€${pricePerHour.toFixed(2)}/h`;
}

const byDistance = (a: ParkingSpot, b: ParkingSpot) => a.distanceToDestMeters - b.distanceToDestMeters;

// Garages and lots beat street bays at a similar distance: easier to find, no parallel parking.
const freeScore = (s: ParkingSpot) =>
  s.distanceToDestMeters + (s.facility === 'garage' ? -30 : s.facility === 'lot' ? -15 : 0);

export function scanParking(center: Coordinate, maxWalkMeters: number): ParkingScan {
  const spots: ParkingSpot[] = CANDIDATES.map((c) => {
    const coordinate = { latitude: center.latitude + c.offset.lat, longitude: center.longitude + c.offset.lon };
    const distance = Math.round(distanceMeters(center, coordinate));
    const { polygon, stallLines } = parkingRectangle(coordinate, c.size.width, c.size.length, c.size.bearing, c.size.stalls);
    return {
      id: c.id,
      title: c.title,
      type: c.type,
      facility: c.facility,
      pricePerHour: c.pricePerHour,
      priceLabel: priceLabel(c.type, c.pricePerHour),
      rules: c.rules,
      description: c.description,
      coordinate,
      distanceToDestMeters: distance,
      walkMinutes: walkMinutes(distance),
      polygon,
      stallLines,
      capacity: c.size.stalls,
      source: 'estimate' as const,
    };
  }).sort(byDistance);

  const nearestFree = spots.find((s) => s.type === 'free') ?? null;
  const inRange = spots.filter((s) => s.distanceToDestMeters <= maxWalkMeters);

  const best =
    // (A) free parking within walking range
    inRange.filter((s) => s.type === 'free').sort((a, b) => freeScore(a) - freeScore(b))[0] ??
    // (B) blue zone: free stay with a disc
    inRange.find((s) => s.type === 'blue') ??
    // (C) cheapest, then closest
    [...inRange].sort((a, b) => a.pricePerHour - b.pricePerHour || byDistance(a, b))[0] ??
    // Nothing in range: never leave the user without a spot.
    spots[0] ??
    null;

  return { spots, best, nearestFree };
}

export async function fetchOsmParking(center: Coordinate, radiusKm = 0.8): Promise<ParkingSpot[]> {
  const elements = await overpass(`(way["amenity"="parking"]${overpassBox(bbox(center, radiusKm), 4)};);out geom 20;`);
  const spots: ParkingSpot[] = [];

  for (const el of elements) {
    if (!el.geometry || el.geometry.length < 3) continue;
    const polygon = el.geometry.map((p) => ({ latitude: p.lat, longitude: p.lon }));
    const coordinate = centroid(polygon);
    const distance = Math.round(distanceMeters(center, coordinate));
    const tags = el.tags ?? {};

    const isFee = tags.fee === 'yes';
    const free = tags.fee === 'no' || (!isFee && (tags.parking === 'street_side' || tags.parking === 'surface'));
    const garage = tags.parking === 'multi-storey' || tags.parking === 'underground' || tags.building === 'parking';
    const bay = !garage && (tags.parking === 'street_side' || tags.parking === 'lane');
    const facility: FacilityType = garage ? 'garage' : bay ? 'bay' : 'lot';
    const type: ParkingType = free ? 'free' : 'paid';
    const pricePerHour = free ? 0 : garage ? 3 : 2;

    const parsedCapacity = parseInt(tags.capacity ?? '', 10);
    const capacity = Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : undefined;
    const kind = garage ? 'Parking Garage' : bay ? 'Parking Bays' : 'Parking Lot';
    const defaultTitle = free ? `Free ${kind}` : bay ? 'Paid Parking Bays' : kind;

    spots.push({
      id: `osm-parking-${el.id}`,
      title: tags.name || defaultTitle,
      type,
      facility,
      pricePerHour,
      priceLabel: priceLabel(type, pricePerHour),
      rules: free
        ? garage
          ? 'Covered garage · Free'
          : bay
            ? 'Free public parking bays'
            : 'Public lot · Free'
        : garage
          ? 'Staffed · Covered · Hourly rate'
          : 'Municipal rate',
      description: `Mapped ${kind.toLowerCase()} from OpenStreetMap.${capacity ? ` About ${capacity} spaces.` : ''}`,
      coordinate,
      distanceToDestMeters: distance,
      walkMinutes: walkMinutes(distance),
      polygon,
      capacity,
      source: 'osm',
    });
  }

  return spots.sort(byDistance);
}

/** Nearest free mapped area within walking range; the screen prefers it over the estimate. */
export function pickBestOsm(osm: ParkingSpot[], maxWalkMeters: number): ParkingSpot | null {
  let best: ParkingSpot | null = null;
  for (const s of osm) {
    if (s.type !== 'free' || s.distanceToDestMeters > maxWalkMeters || (s.polygon?.length ?? 0) < 3) continue;
    if (!best || s.distanceToDestMeters < best.distanceToDestMeters) best = s;
  }
  return best;
}
