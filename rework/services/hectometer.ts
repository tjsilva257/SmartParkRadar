// Dutch hectometer posts ("A10 Li 14.2"): local anchor interpolation that always works,
// refined with the official PDOK / Rijkswaterstaat NWB hectopunten when online.
import type { Carriageway, Coordinate, HectometerMatch, HectometerPosition } from '../types';
import { distanceMeters } from '../lib/geo';
import { fetchJson } from '../lib/http';

type Anchor = { km: number; coord: Coordinate };
const a = (km: number, latitude: number, longitude: number): Anchor => ({ km, coord: { latitude, longitude } });

// Anchors are points on the road centre line at their real hectometer, taken from PDOK nwbwegen:wegvakken
// (main carriageway, Oct 2026) so that the straight line between two anchors stays within ~150 m of the road.
export const HIGHWAYS: { road: string; name: string; minKm: number; maxKm: number; anchors: Anchor[] }[] = [
  {
    road: 'A10',
    name: 'Ring Amsterdam',
    minKm: 1,
    maxKm: 33,
    anchors: [
      a(1, 52.4235, 4.9005), a(5.6, 52.4004, 4.9561), a(7.5, 52.3858, 4.9703), a(8.5, 52.3771, 4.9740),
      a(10.9, 52.3564, 4.9661), a(12.8, 52.3412, 4.9532), a(15.8, 52.3284, 4.9149), a(16.5, 52.3298, 4.9051),
      a(18.2, 52.3389, 4.8851), a(20.9, 52.3376, 4.8457), a(21.3, 52.3396, 4.8416), a(27.8, 52.3976, 4.8456),
      a(31, 52.4212, 4.8720), a(32, 52.4248, 4.8852), a(33, 52.4238, 4.8996),
    ],
  },
  {
    road: 'A4',
    name: 'Amsterdam – Schiphol – Den Haag – Rotterdam',
    minKm: 0,
    maxKm: 73,
    anchors: [
      a(0, 52.3372, 4.8466), a(2.2, 52.3382, 4.8141), a(4.1, 52.3277, 4.7923), a(6.6, 52.3206, 4.7581),
      a(9.5, 52.2972, 4.7397), a(20.7, 52.2212, 4.6313), a(25.2, 52.1857, 4.6005), a(27.8, 52.1722, 4.5696),
      a(30.1, 52.1571, 4.5469), a(32.7, 52.1446, 4.5150), a(33.9, 52.1362, 4.5042), a(36.6, 52.1208, 4.4742),
      a(39.1, 52.1036, 4.4507), a(43.6, 52.0764, 4.4024), a(45.2, 52.0683, 4.3832), a(47.8, 52.0496, 4.3605),
      a(50.5, 52.0333, 4.3316), a(51.9, 52.0229, 4.3200), a(53.4, 52.0106, 4.3113), a(54.2, 52.0035, 4.3113),
      a(58.5, 51.9696, 4.3413), a(62.4, 51.9371, 4.3626), a(63.5, 51.9273, 4.3652), a(69.9, 51.9271, 4.3653),
      a(73, 51.8997, 4.3712),
    ],
  },
  {
    road: 'A2',
    name: 'Amsterdam – Utrecht – Den Bosch – Eindhoven',
    minKm: 30.6,
    maxKm: 160,
    anchors: [
      a(30.6, 52.3330, 4.9125), a(32.1, 52.3198, 4.9160), a(37.9, 52.2744, 4.9572), a(43.9, 52.2235, 4.9856),
      a(50.7, 52.1626, 4.9894), a(54.7, 52.1298, 5.0130), a(56.3, 52.1197, 5.0292), a(58.8, 52.1067, 5.0584),
      a(61.1, 52.0889, 5.0745), a(62.2, 52.0793, 5.0754), a(65.3, 52.0523, 5.0648), a(68.2, 52.0262, 5.0638),
      a(72.3, 51.9913, 5.0815), a(74.7, 51.9750, 5.1040), a(77.2, 51.9560, 5.1235), a(80.7, 51.9339, 5.1595),
      a(94.2, 51.8283, 5.2558), a(95.5, 51.8172, 5.2603), a(100.1, 51.8163, 5.2605), a(104.6, 51.7763, 5.2589),
      a(105.3, 51.7707, 5.2629), a(106.8, 51.7615, 5.2788), a(110.8, 51.7321, 5.3121), a(113.3, 51.7163, 5.3377),
      a(115.4, 51.6997, 5.3516), a(117.8, 51.6788, 5.3449), a(120.7, 51.6678, 5.3075), a(121.3, 51.6633, 5.3029),
      a(122, 51.6571, 5.3028), a(127, 51.6134, 5.3189), a(131.1, 51.5845, 5.3549), a(134.2, 51.5570, 5.3596),
      a(143.1, 51.4906, 5.4300), a(143.2, 51.4921, 5.4348), a(144, 51.4941, 5.4458), a(154, 51.4897, 5.4298),
      a(155.9, 51.4824, 5.4056), a(156.3, 51.4792, 5.4034), a(158.2, 51.4622, 5.4073), a(159, 51.4561, 5.4133),
      a(160, 51.4507, 5.4247),
    ],
  },
  {
    road: 'A1',
    name: 'Amsterdam – Hilversum – Amersfoort – Apeldoorn',
    minKm: 3.3,
    maxKm: 80,
    anchors: [
      a(3.3, 52.3434, 4.9551), a(4.3, 52.3514, 4.9611), a(4.6, 52.3522, 4.9648), a(7.8, 52.3335, 5.0001),
      a(10.1, 52.3310, 5.0332), a(13.9, 52.3203, 5.0859), a(15.9, 52.3136, 5.1132), a(17.4, 52.3062, 5.1317),
      a(19.7, 52.3044, 5.1649), a(20.4, 52.3002, 5.1725), a(21.8, 52.2892, 5.1824), a(23.2, 52.2771, 5.1861),
      a(25.2, 52.2647, 5.2073), a(27.4, 52.2462, 5.2160), a(30.2, 52.2281, 5.2449), a(31.1, 52.2245, 5.2565),
      a(33.3, 52.2227, 5.2885), a(40, 52.2056, 5.3824), a(41, 52.2003, 5.3941), a(44.7, 52.1751, 5.4293),
      a(46.1, 52.1679, 5.4460), a(51.1, 52.1628, 5.5185), a(57.9, 52.1702, 5.6170), a(59.3, 52.1731, 5.6368),
      a(63.7, 52.1907, 5.6943), a(71.8, 52.2040, 5.8106), a(72.8, 52.2018, 5.8246), a(75.2, 52.1887, 5.8519),
      a(80, 52.1813, 5.9211),
    ],
  },
  {
    road: 'A12',
    name: 'Den Haag – Gouda – Utrecht – Arnhem',
    minKm: 3.3,
    maxKm: 128.5,
    anchors: [
      a(3.3, 52.0756, 4.3379), a(8.3, 52.0540, 4.4011), a(15.4, 52.0456, 4.5034), a(23.3, 52.0197, 4.6103),
      a(25.9, 52.0210, 4.6479), a(28.7, 52.0305, 4.6847), a(30.7, 52.0417, 4.7074), a(33.6, 52.0618, 4.7333),
      a(34.6, 52.0663, 4.7454), a(39.2, 52.0643, 4.8117), a(41.4, 52.0696, 4.8426), a(44.8, 52.0698, 4.8924),
      a(48.2, 52.0804, 4.9382), a(51.9, 52.0802, 4.9920), a(58.6, 52.0620, 5.0851), a(62, 52.0549, 5.1331),
      a(62.9, 52.0557, 5.1463), a(64.8, 52.0619, 5.1720), a(70.4, 52.0580, 5.2530), a(72.5, 52.0650, 5.2810),
      a(77.9, 52.0655, 5.3598), a(81.8, 52.0531, 5.4125), a(85.7, 52.0504, 5.4693), a(90.2, 52.0431, 5.5337),
      a(92.2, 52.0419, 5.5627), a(102.2, 52.0419, 5.5627), a(104.1, 52.0354, 5.5880), a(107.9, 52.0175, 5.6351),
      a(110.7, 52.0125, 5.6750), a(112.3, 52.0137, 5.6981), a(114.4, 52.0222, 5.7250), a(119.3, 52.0222, 5.7961),
      a(123, 52.0288, 5.8489), a(124.2, 52.0274, 5.8662), a(126.2, 52.0206, 5.8932), a(128.5, 52.0156, 5.9257),
    ],
  },
  {
    road: 'A13',
    name: 'Den Haag – Delft – Rotterdam',
    minKm: 3,
    maxKm: 19.8,
    anchors: [
      a(3, 52.0589, 4.3720), a(5.2, 52.0435, 4.3533), a(6.4, 52.0329, 4.3537), a(10.2, 52.0048, 4.3852),
      a(14.1, 51.9712, 4.3999), a(16.5, 51.9516, 4.4152), a(19.3, 51.9312, 4.4389), a(19.8, 51.9295, 4.4454),
    ],
  },
  {
    road: 'A20',
    name: 'Gouda – Rotterdam – Hoek van Holland',
    minKm: 10.5,
    maxKm: 48.9,
    anchors: [
      a(10.5, 51.9692, 4.2188), a(11.9, 51.9585, 4.2298), a(13.2, 51.9474, 4.2353), a(15.8, 51.9290, 4.2585),
      a(16.7, 51.9246, 4.2696), a(20.6, 51.9175, 4.3252), a(23.4, 51.9255, 4.3633), a(25.8, 51.9270, 4.3981),
      a(27.2, 51.9227, 4.4167), a(31, 51.9395, 4.4644), a(38.6, 51.9582, 4.5700), a(42.9, 51.9810, 4.6204),
      a(45.8, 51.9994, 4.6501), a(47.1, 52.0104, 4.6560), a(48.2, 52.0199, 4.6530), a(48.9, 52.0238, 4.6611),
    ],
  },
  {
    road: 'N201',
    name: 'Zandvoort – Haarlem – Hoofddorp – Hilversum',
    minKm: 20.7,
    maxKm: 77.4,
    anchors: [
      a(20.7, 52.3421, 4.6327), a(21.6, 52.3351, 4.6386), a(24.7, 52.3166, 4.6727), a(26.1, 52.3174, 4.6925),
      a(28, 52.3062, 4.7135), a(29.1, 52.2971, 4.7094), a(30.2, 52.2901, 4.7202), a(30.8, 52.2861, 4.7145),
      a(32.5, 52.2761, 4.7330), a(32.9, 52.2762, 4.7386), a(34.8, 52.2870, 4.7596), a(35.3, 52.2875, 4.7665),
      a(36.2, 52.2820, 4.7761), a(38.9, 52.2611, 4.7964), a(41.7, 52.2524, 4.8339), a(43.4, 52.2425, 4.8518),
      a(49, 52.2419, 4.8524), a(49.6, 52.2370, 4.8554), a(50.6, 52.2312, 4.8446), a(50.9, 52.2286, 4.8442),
      a(53, 52.2197, 4.8709), a(53.5, 52.2160, 4.8718), a(57.4, 52.2163, 4.9293), a(58.3, 52.2192, 4.9414),
      a(60.5, 52.2210, 4.9735), a(62.3, 52.2264, 4.9981), a(63.4, 52.2249, 5.0141), a(65.4, 52.2301, 5.0419),
      a(70.1, 52.2302, 5.0419), a(71.5, 52.2350, 5.0605), a(73.8, 52.2243, 5.0892), a(76, 52.2196, 5.1206),
      a(77.4, 52.2205, 5.1408),
    ],
  },
];

export const POPULAR_HIGHWAYS: string[] = ['A10', 'A4', 'A2', 'A1', 'A12', 'A13', 'A20', 'N201'];

const AMSTERDAM: Coordinate = { latitude: 52.3676, longitude: 4.9041 };
const round6 = (n: number) => Number(n.toFixed(6));
const findHighway = (road: string) => HIGHWAYS.find((h) => h.road === road.trim().toUpperCase());

export function highwayName(road: string): string | undefined {
  return findHighway(road)?.name;
}

/** Linear interpolation between the surrounding anchors, shifted ~14 m sideways for the Li/Re carriageway. */
export function interpolateHectometer(
  road: string,
  hectometer: number,
  carriageway: Carriageway = 'Li',
  fallback?: Coordinate
): Coordinate {
  const highway = findHighway(road);
  if (!highway || highway.anchors.length < 2) return fallback ?? AMSTERDAM;

  const km = Math.max(highway.minKm, Math.min(highway.maxKm, hectometer));
  const { anchors } = highway;
  let i = anchors.findIndex((p, idx) => idx < anchors.length - 1 && km >= p.km && km <= anchors[idx + 1].km);
  if (i < 0) i = 0; // km before the first anchor (A2/A1 minKm < first anchor km)
  const p1 = anchors[i];
  const p2 = anchors[i + 1];

  const range = p2.km - p1.km;
  const t = range === 0 ? 0 : (km - p1.km) / range;
  const dLat = p2.coord.latitude - p1.coord.latitude;
  const dLon = p2.coord.longitude - p1.coord.longitude;
  const len = Math.hypot(dLat, dLon) || 1;
  // Li/Re = left/right of the road in the direction of increasing hectometers (same side detectHectometer reports).
  const offset = carriageway === 'Li' ? 0.00012 : carriageway === 'Re' ? -0.00012 : 0;

  return {
    latitude: round6(p1.coord.latitude + dLat * t + (dLon / len) * offset),
    longitude: round6(p1.coord.longitude + dLon * t + (-dLat / len) * offset),
  };
}

/** Nearest point on the anchor lines within range (user projected onto each segment); side from the cross product. */
export function detectHectometer(user: Coordinate, maxDistanceMeters = 850): HectometerMatch | null {
  let best: HectometerMatch | null = null;
  let bestDist = Infinity;

  for (const highway of HIGHWAYS) {
    const { anchors } = highway;
    for (let i = 0; i < anchors.length - 1; i++) {
      const a1 = anchors[i].coord;
      const a2 = anchors[i + 1].coord;
      // Local metres, so the projection isn't skewed by the longitude scale.
      const kx = 111320 * Math.cos((a1.latitude * Math.PI) / 180);
      const ky = 110540;
      const dx = (a2.longitude - a1.longitude) * kx;
      const dy = (a2.latitude - a1.latitude) * ky;
      const ux = (user.longitude - a1.longitude) * kx;
      const uy = (user.latitude - a1.latitude) * ky;
      const t = Math.max(0, Math.min(1, (ux * dx + uy * dy) / (dx * dx + dy * dy) || 0));
      const point = {
        latitude: a1.latitude + (a2.latitude - a1.latitude) * t,
        longitude: a1.longitude + (a2.longitude - a1.longitude) * t,
      };
      const d = distanceMeters(user, point);
      if (d >= maxDistanceMeters || d >= bestDist) continue;
      const cross = dx * uy - dy * ux;
      bestDist = d;
      best = {
        road: highway.road,
        hectometer: Number((anchors[i].km + (anchors[i + 1].km - anchors[i].km) * t).toFixed(1)),
        carriageway: cross > 0 ? 'Li' : 'Re',
        distanceMeters: Math.round(d),
        roadName: highway.name,
      };
    }
  }
  return best;
}

interface PdokFeature {
  geometry?: { coordinates?: unknown };
  properties?: { hectomtrng?: number; zijde?: string; wvkId?: number };
}

const PDOK_WFS =
  'https://service.pdok.nl/rws/nwbwegen/wfs/v1_0?request=GetFeature&service=WFS&version=2.0.0&outputFormat=application/json';

/** Box of ±delta degrees around `center`, as a bbox parameter or as an FES filter (`property` = `value` inside it). */
function boxQuery(center: Coordinate, delta: number, property?: string, value?: string | number): string {
  const { longitude: lon, latitude: lat } = center;
  const [minLon, minLat, maxLon, maxLat] = [lon - delta, lat - delta, lon + delta, lat + delta].map((n) => n.toFixed(4));
  if (!property) return `&bbox=${minLon},${minLat},${maxLon},${maxLat},urn:ogc:def:crs:OGC:1.3:CRS84`;
  const filter =
    `<Filter><And><PropertyIsEqualTo><PropertyName>${property}</PropertyName><Literal>${value}</Literal></PropertyIsEqualTo>` +
    '<BBOX><PropertyName>geom</PropertyName><Envelope srsName="urn:ogc:def:crs:OGC:1.3:CRS84">' +
    `<lowerCorner>${minLon} ${minLat}</lowerCorner><upperCorner>${maxLon} ${maxLat}</upperCorner></Envelope></BBOX></And></Filter>`;
  return `&filter=${encodeURIComponent(filter)}`;
}

/** Features of an NWB layer; null when PDOK can't be reached. */
async function fetchPdok<T>(layer: 'hectopunten' | 'wegvakken', query: string): Promise<T[] | null> {
  const data = await fetchJson<{ features?: T[] }>(`${PDOK_WFS}&typeName=nwbwegen:${layer}&srsName=EPSG:4326${query}`, {
    timeoutMs: 3500,
  });
  return Array.isArray(data?.features) ? data.features : null;
}

/** PDOK returns MultiPoint [[lon, lat]] (older services: Point [lon, lat]). */
function pointOf(f: PdokFeature): Coordinate | null {
  const raw = f.geometry?.coordinates;
  const pair = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0] : raw;
  if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') return null;
  return { latitude: round6(pair[1]), longitude: round6(pair[0]) };
}

const sideOf = (f: PdokFeature): Carriageway | null =>
  f.properties?.zijde === 'Li' || f.properties?.zijde === 'Re' ? f.properties.zijde : null;

/** Exact post position from PDOK when it has that hectometer number nearby, else the local estimate. */
export async function resolveHectometer(
  road: string,
  hectometer: number,
  carriageway: Carriageway = 'Li',
  fallback?: Coordinate
): Promise<Coordinate> {
  const estimate = interpolateHectometer(road, hectometer, carriageway, fallback);
  const target = Math.round(hectometer * 10);
  let best: Coordinate | null = null;
  let bestScore = Infinity;
  // Only posts with that number, so the ~1.5 km box can't overflow the result count.
  for (const f of (await fetchPdok<PdokFeature>('hectopunten', boxQuery(estimate, 0.015, 'hectomtrng', target))) ?? []) {
    const p = f.properties?.hectomtrng === target ? pointOf(f) : null;
    if (!p) continue;
    // Both carriageways (and sometimes a local road) carry the same number: prefer the requested side, then the nearest.
    const score = distanceMeters(estimate, p) + (sideOf(f) === carriageway || carriageway === 'all' ? 0 : 1e6);
    if (score < bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best ?? estimate;
}

/** Local detection, with the hectometer number (and side) taken from the nearest real PDOK post on that road. */
export async function detectHectometerLive(user: Coordinate, maxDistanceMeters = 850): Promise<HectometerMatch | null> {
  const local = detectHectometer(user, maxDistanceMeters);
  if (!local) return null;

  // Posts carry no road number, their wegvak does, so fetch both for a box that reaches the roadside posts.
  // PDOK returns posts in bbox order, not nearest first: the box is kept small and the count large.
  const [posts, wegvakken] = await Promise.all([
    fetchPdok<PdokFeature>('hectopunten', `${boxQuery(user, 0.003)}&count=100`),
    fetchPdok<PdokFeature>('wegvakken', `&propertyName=wvkId${boxQuery(user, 0.004, 'wegnrHmp', local.road)}`),
  ]);
  const ids = wegvakken && new Set(wegvakken.map((w) => w.properties?.wvkId));

  let closest: { hm: number; side: Carriageway | null; dist: number } | null = null;
  for (const f of posts ?? []) {
    const p = pointOf(f);
    const hm = Number(((f.properties?.hectomtrng ?? NaN) / 10).toFixed(1));
    if (!p || !Number.isFinite(hm)) continue;
    // Without the wegvakken (PDOK unreachable) the nearest post is taken as is.
    if (ids && !ids.has(f.properties?.wvkId)) continue;
    const dist = distanceMeters(user, p);
    if (dist <= maxDistanceMeters && (!closest || dist < closest.dist)) closest = { hm, side: sideOf(f), dist };
  }
  if (!closest) return local;

  return {
    road: local.road,
    hectometer: closest.hm,
    carriageway: closest.side ?? local.carriageway,
    distanceMeters: Math.round(closest.dist),
    roadName: local.roadName,
  };
}

/** "A10 Li 14.2"; the side is omitted for 'all'. */
export function formatHectometer(pos: HectometerPosition): string {
  const side = pos.carriageway === 'all' ? '' : ` ${pos.carriageway}`;
  return `${pos.road}${side} ${pos.hectometer.toFixed(1)}`;
}
