// Kerbside parking rules from the Dutch national parking registry (RDW Open Data Parkeren):
// which areas are paid or permit-only, and on which days and hours that applies.
// Municipalities publish one coarse polygon per zone, so "outside every active zone" is
// what we can say for sure is free; streets inside a zone are treated as regulated.
import type { Coordinate } from '../types';
import { fetchJson } from '../lib/http';

const RDW = 'https://opendata.rdw.nl/resource/';

// Kerbside regulations. Off-street facilities (TERREINP, PARKRIDE, GARAGEP...) and
// zero-emission exemptions (ZE_ONTHEF) don't make the street itself paid.
const STREET_USAGE = /^(BETAALD|BEZOEK|BEWON|BEDRIJF|VERGUN)/;

const DAYS: Record<string, number> = { ZONDAG: 0, MAANDAG: 1, DINSDAG: 2, WOENSDAG: 3, DONDERDAG: 4, VRIJDAG: 5, ZATERDAG: 6 };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Frame {
  day: number; // 0 = Sunday
  start: number; // minutes after midnight
  end: number;
}

export interface Zone {
  id: string;
  usage: string; // RDW usage id, e.g. BETAALDP (everyone pays), BEZOEKERP (visitor rate), BEWONERP (residents)
  paid: boolean;
  polygons: Coordinate[][][]; // [polygon][ring][point]; ring 0 is the outline, the rest are holes
  frames: Frame[]; // empty = no hours published, treated as always active
}

export interface StreetRules {
  regulated: boolean; // inside a paid/permit zone at all
  activeAt: boolean; // and the zone applies at the given time
  paid: boolean;
  hours: string; // "Mon–Sat 9:00–24:00 · Sun 12:00–24:00"
  zone: string;
}

/** RDW date strings ("20250207", "2025-02-07T00:00:00.000", "20250207000000") -> comparable "YYYYMMDD". */
const day8 = (s: unknown) => (typeof s === 'string' ? s.replace(/\D/g, '').slice(0, 8) : '');
const today8 = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const live = (end: unknown, now: string) => !day8(end) || day8(end) > now;

function parseWkt(wkt: string): Coordinate[][][] {
  // POLYGON ((x y, ...), (hole)) or MULTIPOLYGON (((...)), ((...))). POINTs yield nothing.
  const polygons: Coordinate[][][] = [];
  for (const poly of wkt.match(/\(\s*\([^()]*\)(?:\s*,\s*\([^()]*\))*\s*\)/g) ?? []) {
    const rings = (poly.match(/\([^()]*\)/g) ?? []).map((ring) =>
      ring
        .slice(1, -1)
        .split(',')
        .map((pair) => {
          const [lon, lat] = pair.trim().split(/\s+/).map(Number);
          return { latitude: lat, longitude: lon };
        })
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    );
    if (rings[0]?.length >= 3) polygons.push(rings);
  }
  return polygons;
}

function inRing(p: Coordinate, ring: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (
      a.latitude > p.latitude !== b.latitude > p.latitude &&
      p.longitude < ((b.longitude - a.longitude) * (p.latitude - a.latitude)) / (b.latitude - a.latitude) + a.longitude
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function inZone(p: Coordinate, zone: Zone): boolean {
  return zone.polygons.some(([outline, ...holes]) => inRing(p, outline) && !holes.some((h) => inRing(p, h)));
}

export function zoneActiveAt(zone: Zone, at: Date): boolean {
  if (zone.frames.length === 0) return true;
  const minutes = at.getHours() * 60 + at.getMinutes();
  return zone.frames.some((f) => f.day === at.getDay() && minutes >= f.start && minutes < f.end);
}

/** "Mon–Sat 9:00–24:00 · Sun 12:00–24:00" */
export function describeHours(frames: Frame[]): string {
  if (frames.length === 0) return 'At all times';
  const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  // Several regulations can cover one zone; show when any of them applies (merged per day).
  const perDay = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const merged: { start: number; end: number }[] = [];
    for (const f of frames.filter((x) => x.day === d).sort((a, b) => a.start - b.start)) {
      const last = merged[merged.length - 1];
      if (last && f.start <= last.end) last.end = Math.max(last.end, f.end);
      else merged.push({ start: f.start, end: f.end });
    }
    return { d, text: merged.map((m) => `${clock(m.start)}–${clock(m.end)}`).join(', ') };
  });
  if (perDay.every((p) => p.text === '0:00–24:00')) return 'At all times';
  const parts: string[] = [];
  for (let i = 0; i < perDay.length; ) {
    let j = i;
    while (j + 1 < perDay.length && perDay[j + 1].text === perDay[i].text) j++;
    if (perDay[i].text) {
      const days = i === j ? DAY_NAMES[perDay[i].d] : `${DAY_NAMES[perDay[i].d]}–${DAY_NAMES[perDay[j].d]}`;
      parts.push(`${days} ${perDay[i].text}`);
    }
    i = j + 1;
  }
  return parts.join(' · ');
}

// ponytail: session cache per ~10 m cell, unbounded; a destination is looked up again on Directions.
const municipalityCache = new Map<string, Promise<string | null>>();

function municipalityOf(c: Coordinate): Promise<string | null> {
  const key = `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`;
  let code = municipalityCache.get(key);
  if (!code) {
    code = lookupMunicipality(c);
    municipalityCache.set(key, code);
    code.then((m) => m ?? municipalityCache.delete(key)).catch(() => municipalityCache.delete(key));
  }
  return code;
}

/** CBS municipality code ("0513" -> "513"), which RDW uses as area manager id. */
async function lookupMunicipality(c: Coordinate): Promise<string | null> {
  const data = await fetchJson<any>(
    `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${c.latitude}&lon=${c.longitude}&rows=1&fl=gemeentecode`,
    { timeoutMs: 5000 }
  );
  const code = data?.response?.docs?.[0]?.gemeentecode;
  return typeof code === 'string' && /^\d+$/.test(code) ? String(parseInt(code, 10)) : null;
}

const rows = (dataset: string, manager: string, select: string, where = '') =>
  fetchJson<any[]>(
    `${RDW}${dataset}.json?$select=${select}&$where=${encodeURIComponent(`areamanagerid='${manager}'${where}`)}&$limit=50000`,
    { timeoutMs: 15000 }
  );

async function loadManagerZones(manager: string, now: Date): Promise<Zone[] | null> {
  const [usages, geometries, links, frames] = await Promise.all([
    rows('mz4f-59fw', manager, 'areaid,usageid'),
    rows('nsk3-v9n7', manager, 'areaid,enddatearea,areageometryastext'),
    rows('qtex-qwd8', manager, 'areaid,regulationid,enddatearearegulation'),
    rows('ixf8-gtwq', manager, 'regulationid,daytimeframe,starttimetimeframe,endtimetimeframe,startdatetimeframe,enddatetimeframe'),
  ]);
  if (!usages || !geometries) return null;
  const today = today8(now);

  const usageOf = new Map<string, string>();
  for (const u of usages) if (u?.areaid && u?.usageid) usageOf.set(u.areaid, u.usageid);

  const regsOf = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    if (!l?.areaid || !l?.regulationid || !live(l.enddatearearegulation, today)) continue;
    if (!regsOf.has(l.areaid)) regsOf.set(l.areaid, new Set());
    regsOf.get(l.areaid)!.add(l.regulationid);
  }

  // RDW keeps superseded versions of a regulation's hours with open end dates, so per
  // regulation and weekday only the newest version that has started counts.
  const framesOf = new Map<string, Frame[]>();
  const versionOf = new Map<string, string>();
  for (const f of frames ?? []) {
    const day = DAYS[f?.daytimeframe];
    const since = day8(f?.startdatetimeframe);
    if (day === undefined || !f?.regulationid || since > today || !live(f.enddatetimeframe, today)) continue; // FEESTDAG etc.
    const key = `${f.regulationid}|${day}`;
    const current = versionOf.get(key);
    if (current !== undefined && since < current) continue;
    if (current !== undefined && since > current) {
      framesOf.set(f.regulationid, (framesOf.get(f.regulationid) ?? []).filter((x) => x.day !== day));
    }
    versionOf.set(key, since);
    const hm = (v: unknown) => {
      const n = parseInt(String(v ?? ''), 10);
      return Number.isFinite(n) ? Math.floor(n / 100) * 60 + (n % 100) : NaN;
    };
    const start = hm(f.starttimetimeframe);
    const end = hm(f.endtimetimeframe);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (!framesOf.has(f.regulationid)) framesOf.set(f.regulationid, []);
    framesOf.get(f.regulationid)!.push({ day, start, end });
  }

  const zones: Zone[] = [];
  for (const g of geometries) {
    const usage = usageOf.get(g?.areaid) ?? '';
    if (!STREET_USAGE.test(usage) || !live(g.enddatearea, today) || typeof g.areageometryastext !== 'string') continue;
    const polygons = parseWkt(g.areageometryastext);
    if (polygons.length === 0) continue;
    const zoneFrames = [...(regsOf.get(g.areaid) ?? [])].flatMap((r) => framesOf.get(r) ?? []);
    zones.push({ id: g.areaid, usage, paid: usage.startsWith('BETAALD'), polygons, frames: zoneFrames });
  }
  return zones;
}

// ponytail: per-municipality cache for the session; Amsterdam is ~1.7 MB of polygons, others far less.
const zoneCache = new Map<string, Promise<Zone[] | null>>();

/** Regulated kerbside zones of the municipality containing `c`; null when RDW/PDOK can't be reached. */
export async function zonesAround(c: Coordinate): Promise<Zone[] | null> {
  const manager = await municipalityOf(c);
  if (!manager) return null;
  let zones = zoneCache.get(manager);
  if (!zones) {
    zones = loadManagerZones(manager, new Date());
    zoneCache.set(manager, zones);
    // Don't keep a failed download around; the next destination retries.
    zones.then((z) => z ?? zoneCache.delete(manager)).catch(() => zoneCache.delete(manager));
  }
  return zones;
}

export function streetRulesAt(p: Coordinate, zones: Zone[], at: Date): StreetRules {
  const here = zones.filter((z) => inZone(p, z));
  if (here.length === 0) return { regulated: false, activeAt: false, paid: false, hours: '', zone: '' };
  // A visiting driver is bound by the paid / visitor regime; resident and business permit hours
  // only matter when a zone has no visitor regime at all.
  const visitor = here.filter((z) => z.paid || z.usage.startsWith('BEZOEK'));
  const governing = visitor.length ? visitor : here;
  const lead = governing.find((z) => z.paid) ?? governing.find((z) => z.frames.length) ?? governing[0];
  return {
    regulated: true,
    activeAt: governing.some((z) => zoneActiveAt(z, at)),
    paid: here.some((z) => z.paid),
    hours: describeHours(lead.frames),
    zone: lead.id,
  };
}
