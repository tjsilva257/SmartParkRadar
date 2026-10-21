// Parking near a destination, from real data only:
//  - the destination's own street, with its paid/permit rules from the RDW registry (rdw.ts),
//  - free kerbside just outside the regulated zone, snapped to a named street by OSRM,
//  - parking lots and garages mapped in OpenStreetMap.
// The original app invented six spots around every destination; that is gone on purpose.
import type { Coordinate, FacilityType, ParkingScan, ParkingSpot, ParkingType } from '../types';
import { bbox, centroid, distanceMeters, estimatedDriveSeconds, walkMinutes } from '../lib/geo';
import { fetchJson, overpass, overpassBox } from '../lib/http';
import { inZone, StreetRules, streetRulesAt, Zone, zonesAround } from './rdw';

/** The max walking distances the user can pick, in meters. */
export const WALK_OPTIONS_METERS = [250, 500, 750, 1200];

// Paid kerbside without a published tariff: ranks between OSM lots (2) and garages (3).
const UNKNOWN_STREET_RATE = 2.5;

function priceLabel(type: ParkingType, pricePerHour: number): string {
  if (type === 'free') return 'Free';
  if (type === 'blue') return 'Blue zone · 2 h';
  return `€${pricePerHour.toFixed(2)}/h`;
}

const byDistance = (a: ParkingSpot, b: ParkingSpot) => a.distanceToDestMeters - b.distanceToDestMeters;

// Garages and lots beat street parking at a similar distance: easier to find, no parallel parking.
const freeScore = (s: ParkingSpot) =>
  s.distanceToDestMeters + (s.facility === 'garage' ? -30 : s.facility === 'lot' ? -15 : 0);

/** Same free-first ranking as the original app, over whatever real options were found. */
export function chooseParking(options: ParkingSpot[], maxWalkMeters: number): ParkingScan {
  const spots = [...options].sort(byDistance);
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

  // Blue zone (pricePerHour 0) counts as free, like the old drawer.
  const bestIsFree = !!best && (best.type === 'free' || best.pricePerHour === 0);
  const freeWalk = nearestFree?.distanceToDestMeters ?? 0;
  // The shortest walk option that reaches the free spot, else the longest one.
  const reach = WALK_OPTIONS_METERS.find((m) => m >= freeWalk) ?? Math.max(...WALK_OPTIONS_METERS);
  const freeHint =
    best && !bestIsFree && nearestFree && freeWalk > maxWalkMeters
      ? { spot: nearestFree, walkMeters: reach > maxWalkMeters ? reach : null }
      : null;

  return { spots, best, freeHint };
}

/** Nearest drivable road to `c`, with its name, via OSRM's nearest service. */
async function nearestStreet(c: Coordinate): Promise<{ coordinate: Coordinate; name: string } | null> {
  const data = await fetchJson<any>(
    `https://router.project-osrm.org/nearest/v1/driving/${c.longitude},${c.latitude}?number=1`,
    { timeoutMs: 5000 }
  );
  const wp = data?.code === 'Ok' ? data.waypoints?.[0] : null;
  const loc = wp?.location;
  if (!Array.isArray(loc) || loc.length < 2) return null;
  return { coordinate: { latitude: loc[1], longitude: loc[0] }, name: typeof wp.name === 'string' ? wp.name : '' };
}

function streetSpot(
  id: string,
  dest: Coordinate,
  at: Coordinate,
  street: string,
  type: ParkingType,
  pricePerHour: number,
  label: string,
  rules: string,
  description: string
): ParkingSpot {
  const distance = Math.round(distanceMeters(dest, at));
  return {
    id,
    title: street ? `Street parking · ${street}` : 'Street parking',
    type,
    facility: 'street',
    pricePerHour,
    priceLabel: label,
    rules,
    description,
    coordinate: at,
    distanceToDestMeters: distance,
    walkMinutes: walkMinutes(distance),
    source: 'rdw',
  };
}

/** Parking on the destination's own street, priced by the zone it sits in. */
function destinationStreet(dest: Coordinate, at: Coordinate, street: string, rules: StreetRules | null): ParkingSpot {
  const id = 'street-destination';
  if (!rules) {
    return streetSpot(id, dest, at, street, 'paid', UNKNOWN_STREET_RATE, 'Check signs',
      'Parking rules unavailable right now', 'Could not reach the national parking registry (RDW).');
  }
  if (!rules.regulated) {
    return streetSpot(id, dest, at, street, 'free', 0, 'Free',
      'No paid or permit parking here', 'Not inside any paid or permit zone in the RDW parking registry.');
  }
  const kind = rules.paid ? 'Paid parking' : 'Permit zone';
  if (!rules.activeAt) {
    return streetSpot(id, dest, at, street, 'free', 0, 'Free on arrival',
      `${kind} only ${rules.hours}`, `${kind} (${rules.zone}), but not at your arrival time.`);
  }
  return streetSpot(id, dest, at, street, 'paid', UNKNOWN_STREET_RATE, rules.paid ? 'Paid zone' : 'Permit zone',
    `${rules.paid ? 'Pay at the meter or by app' : 'Visitors pay the visitor rate'} · ${rules.hours}`,
    `${kind} ${rules.zone} in the RDW parking registry.`);
}

/**
 * Free kerbside closest to the destination just outside every zone that applies at `arrival`:
 * nearest points on the zone outlines, nudged 30 m outward, snapped to a named street.
 */
async function freeKerbsideOutside(dest: Coordinate, zones: Zone[], arrival: Date): Promise<ParkingSpot | null> {
  const blocked = (p: Coordinate) => streetRulesAt(p, zones, arrival).activeAt;
  const mPerLon = 111320 * Math.cos((dest.latitude * Math.PI) / 180);
  const toXY = (c: Coordinate) => ({ x: (c.longitude - dest.longitude) * mPerLon, y: (c.latitude - dest.latitude) * 111320 });
  const toCoord = (x: number, y: number) => ({ latitude: dest.latitude + y / 111320, longitude: dest.longitude + x / mPerLon });

  // Nearest point of every outline edge of the zones around the destination.
  const edgePoints: { x: number; y: number; d: number }[] = [];
  for (const zone of zones.filter((z) => inZone(dest, z))) {
    for (const [outline] of zone.polygons) {
      for (let i = 1; i < outline.length; i++) {
        const a = toXY(outline[i - 1]);
        const b = toXY(outline[i]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
        const x = a.x + t * dx;
        const y = a.y + t * dy;
        edgePoints.push({ x, y, d: Math.hypot(x, y) });
      }
    }
  }
  edgePoints.sort((p, q) => p.d - q.d);

  // A handful of well-spread candidates, each just across the boundary and itself unregulated.
  const picks: Coordinate[] = [];
  for (const p of edgePoints) {
    if (picks.length >= 4) break;
    const out = toCoord((p.x / (p.d || 1)) * (p.d + 30), (p.y / (p.d || 1)) * (p.d + 30));
    if (blocked(out) || picks.some((q) => distanceMeters(q, out) < 80)) continue;
    picks.push(out);
  }

  const snapped = await Promise.all(picks.map(nearestStreet));
  const spots = snapped
    .filter((s): s is { coordinate: Coordinate; name: string } => !!s && !!s.name && !blocked(s.coordinate))
    .map((s) =>
      streetSpot(`street-free-${s.coordinate.latitude.toFixed(5)},${s.coordinate.longitude.toFixed(5)}`, dest,
        s.coordinate, s.name, 'free', 0, 'Free', 'Just outside the paid/permit zone · no meter or permit',
        'Outside every paid or permit zone in the RDW parking registry at your arrival time.')
    )
    .sort(byDistance);
  return spots[0] ?? null;
}

/** OSM lots/garages. `feeKnown` is false when the map has no fee tag, so the zone decides. */
async function fetchOsmParking(center: Coordinate, radiusKm = 0.8): Promise<{ spot: ParkingSpot; feeKnown: boolean }[]> {
  const elements = await overpass(`(way["amenity"="parking"]${overpassBox(bbox(center, radiusKm), 4)};);out geom 20;`);
  const out: { spot: ParkingSpot; feeKnown: boolean }[] = [];

  for (const el of elements) {
    if (!el.geometry || el.geometry.length < 3) continue;
    const tags = el.tags ?? {};
    // Private/customer lots aren't public parking.
    if (tags.access === 'private' || tags.access === 'customers' || tags.access === 'no') continue;
    const polygon = el.geometry.map((p) => ({ latitude: p.lat, longitude: p.lon }));
    const coordinate = centroid(polygon);
    const distance = Math.round(distanceMeters(center, coordinate));

    const feeKnown = tags.fee === 'yes' || tags.fee === 'no';
    const free = tags.fee === 'no';
    const garage = tags.parking === 'multi-storey' || tags.parking === 'underground' || tags.building === 'parking';
    const bay = !garage && (tags.parking === 'street_side' || tags.parking === 'lane');
    const facility: FacilityType = garage ? 'garage' : bay ? 'bay' : 'lot';
    const type: ParkingType = free ? 'free' : 'paid';
    const pricePerHour = free ? 0 : garage ? 3 : 2;

    const parsedCapacity = parseInt(tags.capacity ?? '', 10);
    const capacity = Number.isFinite(parsedCapacity) && parsedCapacity > 0 ? parsedCapacity : undefined;
    const kind = garage ? 'Parking Garage' : bay ? 'Parking Bays' : 'Parking Lot';

    out.push({
      feeKnown,
      spot: {
        id: `osm-parking-${el.id}`,
        title: tags.name || (free ? `Free ${kind}` : kind),
        type,
        facility,
        pricePerHour,
        priceLabel: priceLabel(type, pricePerHour),
        rules: free ? (garage ? 'Covered garage · Free' : 'Public parking · Free') : garage ? 'Covered · Hourly rate' : 'Hourly rate',
        description: `Mapped ${kind.toLowerCase()} from OpenStreetMap.${capacity ? ` About ${capacity} spaces.` : ''}`,
        coordinate,
        distanceToDestMeters: distance,
        walkMinutes: walkMinutes(distance),
        polygon,
        capacity,
        source: 'osm',
      },
    });
  }
  return out;
}

const QUARTER_HOUR_MS = 15 * 60 * 1000;
const MEMO_LIMIT = 20;
// ponytail: session memo per destination (~10 m) and quarter hour of arrival; oldest dropped past MEMO_LIMIT.
const memo = new Map<string, Promise<ParkingSpot[]>>();

/**
 * Every real parking option around `dest` for a car leaving `from` now, with zone hours checked at
 * the estimated arrival. Never rejects; always includes at least the destination's own street.
 * The same destination and quarter hour of arrival reuse one lookup, so the place card and
 * Directions see the same options.
 */
export function loadParkingOptions(dest: Coordinate, from: Coordinate): Promise<ParkingSpot[]> {
  const arrival = new Date(Date.now() + estimatedDriveSeconds(from, dest) * 1000);
  const slot = Math.floor(arrival.getTime() / QUARTER_HOUR_MS);
  const key = `${dest.latitude.toFixed(4)},${dest.longitude.toFixed(4)}@${slot}`;
  let options = memo.get(key);
  if (!options) {
    const scan = scanParking(dest, arrival);
    options = scan.then((s) => s.options);
    memo.set(key, options);
    if (memo.size > MEMO_LIMIT) memo.delete(memo.keys().next().value!);
    // A lookup that couldn't reach the parking registry isn't kept; the next one retries.
    scan.then((s) => s.complete || memo.delete(key));
  }
  return options;
}

async function scanParking(dest: Coordinate, arrival: Date): Promise<{ options: ParkingSpot[]; complete: boolean }> {
  // Public Overpass is often overloaded; the street rules alone answer "where can I park free",
  // so mapped lots get 4 s and are skipped after that (the query stays cached for next time).
  let osmTimer: ReturnType<typeof setTimeout> | undefined;
  const osmWithin4s = Promise.race([
    fetchOsmParking(dest).catch(() => []),
    new Promise<[]>((resolve) => {
      osmTimer = setTimeout(() => resolve([]), 4000);
    }),
  ]).finally(() => clearTimeout(osmTimer));
  const [zones, street, osm] = await Promise.all([
    zonesAround(dest).catch(() => null),
    nearestStreet(dest).catch(() => null),
    osmWithin4s,
  ]);

  const rules = zones ? streetRulesAt(dest, zones, arrival) : null;
  const options: ParkingSpot[] = [destinationStreet(dest, street?.coordinate ?? dest, street?.name ?? '', rules)];

  if (zones && rules?.activeAt) {
    const outside = await freeKerbsideOutside(dest, zones, arrival).catch(() => null);
    if (outside) options.push(outside);
  }

  for (const { spot, feeKnown } of osm) {
    // Untagged lots follow the zone they're in: unregulated means free, like the street around them.
    if (!feeKnown && zones && !streetRulesAt(spot.coordinate, zones, arrival).activeAt) {
      options.push({ ...spot, type: 'free', pricePerHour: 0, priceLabel: 'Free', rules: 'Public parking · outside any paid zone' });
    } else {
      options.push(spot);
    }
  }
  return { options: options.sort(byDistance), complete: zones !== null };
}
