// Speed cameras ("flitsers"): a built-in Dutch set that always works, live OSM cameras on top,
// the "camera ahead" radar and the CJIB fine estimate.
import type { CameraWarning, Coordinate, SpeedAlert, SpeedCamera } from '../types';
import { bbox, bearing, distanceMeters } from '../lib/geo';
import { overpass, overpassBox } from '../lib/http';

const cam = (
  id: string,
  name: string,
  road: string,
  type: SpeedCamera['type'],
  speedLimit: number,
  latitude: number,
  longitude: number,
  description: string
): SpeedCamera => ({ id, name, road, type, speedLimit, coordinate: { latitude, longitude }, description, source: 'builtin' });

export const BUILTIN_CAMERAS: SpeedCamera[] = [
  // Amsterdam & A10 ring
  cam('cam-a10w-1', 'A10 West – De Nieuwe Meer', 'A10 West Ring', 'fixed', 100, 52.3412, 4.845, 'Fixed speed camera past the De Nieuwe Meer interchange'),
  cam('cam-a10z-1', 'A10 South Average Speed Check', 'A10 Zuid (Zuidas)', 'average', 100, 52.3365, 4.878, 'Average speed check on both carriageways at Zuidas'),
  cam('cam-a10n-1', 'A10 North – Coentunnel', 'A10 Noord', 'fixed', 100, 52.412, 4.885, 'Speed camera inside the Coentunnel'),
  cam('cam-ams-stadhouderskade', 'Stadhouderskade Camera', 'Stadhouderskade (Rijksmuseum)', 'red_light', 50, 52.3585, 4.889, 'Speed and red light camera at the Hobbemastraat junction'),
  cam('cam-ams-wibaut', 'Wibautstraat Speed Camera', 'Wibautstraat', 'fixed', 50, 52.354, 4.9125, 'Fixed speed camera toward Amstel station'),
  cam('cam-ams-cs', 'De Ruijterkade Camera', 'De Ruijterkade (Centraal)', 'fixed', 50, 52.3795, 4.9015, 'Behind Amsterdam Central Station'),
  cam('cam-ams-west-mob', 'Jan van Galenstraat Laser Check', 'Jan van Galenstraat', 'mobile', 50, 52.3735, 4.856, 'Mobile laser check reported by the community'),
  // A4 Amsterdam – Schiphol – The Hague – Rotterdam
  cam('cam-a4-schiphol', 'A4 Average Speed Check Schiphol', 'A4 km 12.4', 'average', 100, 52.308, 4.762, 'Average speed check from Schiphol-Oost to Hoofddorp'),
  cam('cam-a4-hoofddorp', 'A4 Mobile Speed Check Hoofddorp', 'A4 Li km 18.2', 'mobile', 100, 52.268, 4.71, 'Police radar on the overpass'),
  cam('cam-a4-leiden', 'A4 Speed Camera Leiden Interchange', 'A4 km 34.8', 'fixed', 100, 52.162, 4.543, 'Fixed speed camera at the Burgerveen interchange'),
  // A13 & Rotterdam
  cam('cam-a13-overschie', 'A13 Average Speed Check Overschie', 'A13 km 11.2 (Overschie)', 'average', 80, 51.942, 4.431, 'Strictly enforced 80 km/h low-emission zone'),
  cam('cam-a20-rot', 'A20 Kleinpolderplein', 'A20 km 28.5', 'fixed', 100, 51.936, 4.449, 'Speed camera where the A13 and A20 split'),
  cam('cam-rot-coolsingel', 'Coolsingel Camera', 'Coolsingel Rotterdam', 'red_light', 50, 51.9215, 4.479, 'Speed and red light camera by City Hall'),
  cam('cam-rot-maas', 'Maasboulevard Speed Camera', 'Maasboulevard', 'fixed', 50, 51.918, 4.502, 'Fixed speed camera toward the Erasmus Bridge'),
  // A2 Amsterdam – Utrecht
  cam('cam-a2-traject', 'A2 Average Speed Check Breukelen', 'A2 km 48.0', 'average', 100, 52.175, 4.992, 'Average speed check across all five lanes at Breukelen'),
  cam('cam-utr-ring', 'A2 Utrecht Ring West', 'A2 km 56.4', 'fixed', 100, 52.091, 5.068, 'Fixed speed camera at Lage Weide'),
  cam('cam-utr-daalse', 'Daalsetunnel Speed Camera', 'Daalsetunnel Utrecht', 'fixed', 50, 52.095, 5.109, 'Speed camera at the Daalsetunnel entrance'),
];

export async function fetchOsmCameras(center: Coordinate, radiusKm = 12): Promise<SpeedCamera[]> {
  const box = overpassBox(bbox(center, radiusKm), 3);
  const elements = await overpass(
    `(node["highway"="speed_camera"]${box};node["enforcement"="maxspeed"]${box};node["amenity"="police"]${box};);out body 50;`
  );
  const cameras: SpeedCamera[] = [];

  for (const el of elements) {
    if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
    const coordinate = { latitude: el.lat, longitude: el.lon };
    // The built-in entry is curated (names, limits), so it wins over the OSM duplicate.
    if (BUILTIN_CAMERAS.some((c) => distanceMeters(c.coordinate, coordinate) < 60)) continue;
    const tags = el.tags ?? {};

    if (tags.highway === 'speed_camera' || tags.enforcement === 'maxspeed') {
      const parsed = parseInt(tags.maxspeed || tags['maxspeed:practical'] || '50', 10);
      const speed = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
      const camType = tags['camera:type'] ?? '';
      const type: SpeedCamera['type'] =
        camType === 'distance' || tags.enforcement === 'average_speed'
          ? 'average'
          : camType === 'red_light' || tags.red_light === 'yes'
            ? 'red_light'
            : 'fixed';
      cameras.push({
        id: `osm-cam-${el.id}`,
        name: tags.name || (type === 'average' ? `Average Speed Check ${speed}` : `Speed Camera ${speed}`),
        road: tags.street || tags['addr:street'] || tags.ref || 'Local road',
        type,
        speedLimit: speed,
        coordinate,
        description: tags.description || `Live OpenStreetMap speed camera (${speed} km/h)`,
        source: 'osm',
      });
    } else if (tags.amenity === 'police') {
      cameras.push({
        id: `osm-police-${el.id}`,
        name: tags.name || 'Police Station',
        road: tags['addr:street'] || tags.street || 'Police location',
        type: 'police',
        speedLimit: 0,
        coordinate,
        description: tags.operator || 'Official police location',
        source: 'osm',
      });
    }
  }
  return cameras;
}

export function mergeCameras(live: SpeedCamera[]): SpeedCamera[] {
  const byId = new Map<string, SpeedCamera>();
  for (const c of [...BUILTIN_CAMERAS, ...live]) if (!byId.has(c.id)) byId.set(c.id, c);
  return [...byId.values()];
}

/**
 * Nearest enforcing camera within `radiusMeters`. With a heading, only cameras within ±70° of it count,
 * so a camera you just passed stops warning.
 */
export function upcomingCamera(
  position: Coordinate,
  cameras: SpeedCamera[],
  radiusMeters = 1500,
  heading?: number
): CameraWarning | null {
  // expo-location reports -1 (or null) when the heading is unknown.
  const useHeading = heading != null && Number.isFinite(heading) && heading >= 0;
  let best: SpeedCamera | null = null;
  let bestDist = Infinity;

  for (const c of cameras) {
    if (c.type === 'police') continue;
    const d = distanceMeters(position, c.coordinate);
    if (d > radiusMeters || d >= bestDist) continue;
    if (useHeading) {
      const off = Math.abs(((bearing(position, c.coordinate) - heading + 540) % 360) - 180);
      if (off > 70) continue;
    }
    best = c;
    bestDist = d;
  }

  if (!best) return null;
  const rounded = Math.round(bestDist);
  return { camera: best, distanceMeters: rounded, isUrgent: rounded <= 450 };
}

/** CJIB (Dutch) speeding fines; the first 3 km/h over are the statutory measuring margin. */
export function speedAlert(speed: number, limit: number): SpeedAlert {
  const overBy = limit > 0 ? Math.max(0, Math.round(speed - limit)) : 0;
  let fineEur = 0;
  if (overBy > 30) fineEur = 490 + (overBy - 30) * 25;
  else if (overBy >= 26) fineEur = 380;
  else if (overBy >= 20) fineEur = 285;
  else if (overBy >= 16) fineEur = 210;
  else if (overBy >= 12) fineEur = 155;
  else if (overBy >= 8) fineEur = 88;
  else if (overBy >= 4) fineEur = 42;
  return { speed, limit, overBy, fineEur, level: overBy <= 0 ? 'ok' : overBy < 8 ? 'over' : 'fine' };
}
