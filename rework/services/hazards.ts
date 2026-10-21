// Road hazards: community reports kept on the device plus live roadworks/closures from OpenStreetMap.
import type {
  Carriageway,
  Coordinate,
  HazardCategory,
  HectometerPosition,
  NewHazardReport,
  RoadHazard,
} from '../types';
import { HAZARD_CATEGORIES, hazardGlyph } from '../components/glyphs';
import { bbox } from '../lib/geo';
import { overpass, overpassBox } from '../lib/http';
import { KEYS, persisted } from '../lib/store';
import { highwayName, interpolateHectometer } from './hectometer';

const MIN = 60 * 1000;

// Ages are relative to app start, which is when a first run seeds them.
export const SEED_HAZARDS: RoadHazard[] = [
  {
    id: 'hazard-a10-mob-1',
    category: 'mobile_camera',
    title: 'Mobile Speed Check (Laser)',
    roadName: 'A10 Li 14.2',
    hectometerPost: { road: 'A10', hectometer: 14.2, carriageway: 'Li', description: highwayName('A10') },
    // Placed on the real post (the original app's coordinates were ~580 m off the road).
    coordinate: interpolateHectometer('A10', 14.2, 'Li'),
    reportedAt: Date.now() - 12 * MIN,
    reporterLabel: 'Driver #2841',
    confirmations: 4,
    note: 'Hidden behind the overpass',
  },
  {
    id: 'hazard-ams-scan-1',
    category: 'parking_warden',
    title: 'Parking Enforcement Scan Car',
    roadName: 'Overtoom / Vondelpark',
    coordinate: { latitude: 52.361, longitude: 4.872 },
    reportedAt: Date.now() - 8 * MIN,
    reporterLabel: 'Local resident',
    confirmations: 3,
    note: 'Heading toward Leidseplein, checking the blue zone',
  },
  {
    id: 'hazard-a4-work-1',
    category: 'road_work',
    title: 'Emergency Asphalt Repair',
    roadName: 'A4 Re 17.8',
    hectometerPost: { road: 'A4', hectometer: 17.8, carriageway: 'Re', description: highwayName('A4') },
    coordinate: interpolateHectometer('A4', 17.8, 'Re'),
    reportedAt: Date.now() - 25 * MIN,
    reporterLabel: 'Waze/Flitsmeister feed',
    confirmations: 7,
    note: 'Right lane closed with a red X',
  },
];

const SEED_BY_ID = new Map(SEED_HAZARDS.map((h) => [h.id, h]));
const CARRIAGEWAYS: Carriageway[] = ['Li', 'Re', 'all'];
// The original app labelled the user's own reports in Dutch.
const LEGACY_REPORTER: Record<string, string> = { 'Jij (Zojuist gemeld)': 'You' };
// ...and stored the Dutch category label as the title; those get the English label.
const LEGACY_TITLES = new Set([
  'Mobiele Flitser',
  'Politiecontrole / Laser',
  'Handhaving',
  'Ongeval / Pech',
  'Wegafsluiting',
  'Werkzaamheden',
  'Gevaar op de weg',
  'File / Spookfile',
]);

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function parseCoordinate(raw: any): Coordinate | null {
  const latitude = num(raw?.latitude);
  const longitude = num(raw?.longitude);
  return latitude === undefined || longitude === undefined ? null : { latitude, longitude };
}

function parseHectometer(raw: any): HectometerPosition | undefined {
  const road = str(raw?.road);
  const hectometer = num(raw?.hectometer);
  if (!road || hectometer === undefined) return undefined;
  const carriageway: Carriageway = CARRIAGEWAYS.includes(raw.carriageway) ? raw.carriageway : 'all';
  return { road, hectometer, carriageway, description: str(raw.description) };
}

/** Validates one stored entry; anything unusable is dropped instead of crashing the map. */
function parseHazard(raw: any): RoadHazard | null {
  const id = str(raw?.id);
  const category = raw?.category as HazardCategory;
  const coordinate = parseCoordinate(raw?.coordinate);
  if (!id || !HAZARD_CATEGORIES.includes(category) || !coordinate) return null;
  const reporter = str(raw.reporterLabel);
  const title = str(raw.title);
  const hazard: RoadHazard = {
    id,
    category,
    title: title && !LEGACY_TITLES.has(title) ? title : hazardGlyph(category).label,
    roadName: str(raw.roadName) ?? '',
    hectometerPost: parseHectometer(raw.hectometerPost),
    coordinate,
    reportedAt: num(raw.reportedAt) ?? Date.now(),
    reporterLabel: reporter ? LEGACY_REPORTER[reporter] ?? reporter : undefined,
    confirmations: Math.max(0, Math.round(num(raw.confirmations) ?? 1)),
    note: str(raw.note),
  };
  // Seeds stored by the original app are in Dutch and misplaced: keep their counts, show the English text and real position.
  const seed = SEED_BY_ID.get(id);
  return seed
    ? { ...hazard, title: seed.title, roadName: seed.roadName, hectometerPost: seed.hectometerPost, coordinate: seed.coordinate, reporterLabel: seed.reporterLabel, note: seed.note }
    : hazard;
}

const stored = persisted(KEYS.hazards, (raw) =>
  Array.isArray(raw) ? raw.map(parseHazard).filter((h): h is RoadHazard => h !== null) : SEED_HAZARDS
);

/** Stored community + user hazards. The first run seeds and persists SEED_HAZARDS. */
export function loadHazards(): Promise<RoadHazard[]> {
  // Persisting a copy of the seeds fixes their ages from this first run; a stored list comes back as is, unwritten.
  return stored.update((list) => (list === SEED_HAZARDS ? [...SEED_HAZARDS] : list));
}

/** Live roadworks and road closures around `center` from OpenStreetMap (empty when offline). */
export async function fetchOsmRoadworks(center: Coordinate, radiusKm = 8): Promise<RoadHazard[]> {
  const box = overpassBox(bbox(center, radiusKm));
  const elements = await overpass(
    `(way["highway"="construction"]${box};way["construction"]${box};node["barrier"="road_block"]${box};);out center 35;`
  );
  const now = Date.now();
  const seen = new Set<string>();
  const hazards: RoadHazard[] = [];
  for (const el of elements) {
    const latitude = el.lat ?? el.center?.lat;
    const longitude = el.lon ?? el.center?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    // Node and way ids live in separate OSM id spaces.
    const id = `osm-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const tags = el.tags ?? {};
    const closed = tags.barrier === 'road_block' || tags.access === 'no';
    const road = tags.name || tags.description || tags.ref || 'Local road';
    hazards.push({
      id,
      category: closed ? 'road_block' : 'road_work',
      title: `${closed ? 'Road Closed' : 'Road Works'}: ${road}`,
      roadName: road,
      coordinate: { latitude: latitude as number, longitude: longitude as number },
      reportedAt: now - 30 * MIN,
      reporterLabel: 'OpenStreetMap',
      confirmations: 8,
      note: tags.description || (tags.construction ? `Construction: ${tags.construction}` : 'Reported on OpenStreetMap'),
    });
  }
  return hazards;
}

/** Local hazards plus live OSM ones that aren't already stored. */
export async function loadAllHazards(center?: Coordinate): Promise<RoadHazard[]> {
  const [local, live] = await Promise.all([loadHazards(), center ? fetchOsmRoadworks(center) : Promise.resolve([])]);
  const ids = new Set(local.map((h) => h.id));
  return [...local, ...live.filter((h) => !ids.has(h.id))];
}

export async function reportHazard(report: NewHazardReport): Promise<RoadHazard> {
  const hazard: RoadHazard = {
    id: `hazard_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category: report.category,
    title: report.title,
    roadName: report.roadName,
    hectometerPost: report.hectometerPost,
    coordinate: report.coordinate,
    reportedAt: Date.now(),
    reporterLabel: 'You',
    confirmations: 1,
    note: report.note?.trim() || undefined,
  };
  await stored.update((list) => [hazard, ...list]);
  return hazard;
}

/** +1 on a stored hazard. Live OSM hazards aren't stored, so confirming them is a no-op here. */
export async function confirmHazard(id: string): Promise<void> {
  if (!id || id.startsWith('osm-')) return;
  await stored.update((list) => list.map((h) => (h.id === id ? { ...h, confirmations: h.confirmations + 1 } : h)));
}

export function isLocalHazard(h: RoadHazard): boolean {
  return !h.id.startsWith('osm-');
}

/** "Just now", "8 min ago", "2 hr ago", "3 days ago". */
export function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / MIN);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
