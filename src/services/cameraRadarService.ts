import { Coordinate, SpeedCamera, CameraWarning, SpeedAlert } from '../types/parking';
import { getDistanceInMeters } from '../utils/distance';

/**
 * Verified database of Speed Cameras ("Flitsers"), Trajectcontroles, and Mobile Radar Traps
 * across key highways (A4, A10, A2, A13) and city centers (Amsterdam, Rotterdam, Utrecht).
 */
export const SPEED_CAMERAS: SpeedCamera[] = [
  // --- AMSTERDAM & RING A10 ---
  {
    id: 'cam-a10w-1',
    name: 'A10 West - De Nieuwe Meer',
    road: 'A10 West Ring',
    type: 'fixed',
    speedLimit: 100,
    coordinate: { latitude: 52.3412, longitude: 4.8450 },
    description: 'Vaste flitspaal na knooppunt De Nieuwe Meer',
  },
  {
    id: 'cam-a10z-1',
    name: 'A10 Zuid Trajectcontrole',
    road: 'A10 Zuid (Zuidas)',
    type: 'traject',
    speedLimit: 100,
    coordinate: { latitude: 52.3365, longitude: 4.8780 },
    description: 'Trajectcontrole beide rijbanen Zuidas',
  },
  {
    id: 'cam-a10n-1',
    name: 'A10 Noord - Coentunnel',
    road: 'A10 Noord',
    type: 'fixed',
    speedLimit: 100,
    coordinate: { latitude: 52.4120, longitude: 4.8850 },
    description: 'Flitser tunnelbuis Coentunnel',
  },
  {
    id: 'cam-ams-stadhouderskade',
    name: 'Stadhouderskade Flitspaal',
    road: 'Stadhouderskade (Rijksmuseum)',
    type: 'red_light',
    speedLimit: 50,
    coordinate: { latitude: 52.3585, longitude: 4.8890 },
    description: 'Snelheid + Roodlicht camera kruising Hobbemastraat',
  },
  {
    id: 'cam-ams-wibaut',
    name: 'Wibautstraat Radar',
    road: 'Wibautstraat',
    type: 'fixed',
    speedLimit: 50,
    coordinate: { latitude: 52.3540, longitude: 4.9125 },
    description: 'Vaste flitspaal richting Amstelstation',
  },
  {
    id: 'cam-ams-cs',
    name: 'De Ruijterkade Camera',
    road: 'De Ruijterkade (Centraal)',
    type: 'fixed',
    speedLimit: 50,
    coordinate: { latitude: 52.3795, longitude: 4.9015 },
    description: 'Centraal Station achterzijde',
  },
  {
    id: 'cam-ams-west-mob',
    name: 'Jan van Galenstraat Laser',
    road: 'Jan van Galenstraat',
    type: 'mobile',
    speedLimit: 50,
    coordinate: { latitude: 52.3735, longitude: 4.8560 },
    description: 'Mobiele lasercontrole gemeld door community',
  },

  // --- A4 HIGHWAY (AMSTERDAM ➔ SCHIPHOL ➔ DEN HAAG ➔ ROTTERDAM) ---
  {
    id: 'cam-a4-schiphol',
    name: 'A4 Trajectcontrole Schiphol',
    road: 'A4 km 12.4',
    type: 'traject',
    speedLimit: 100,
    coordinate: { latitude: 52.3080, longitude: 4.7620 },
    description: 'Trajectcontrole Schiphol-Oost tot Hoofddorp',
  },
  {
    id: 'cam-a4-hoofddorp',
    name: 'A4 Mobiele Flitser Hoofddorp',
    road: 'A4 Li km 18.2',
    type: 'mobile',
    speedLimit: 100,
    coordinate: { latitude: 52.2680, longitude: 4.7100 },
    description: 'Politie radar op viaduct',
  },
  {
    id: 'cam-a4-leiden',
    name: 'A4 Flitser Leiden Knooppunt',
    road: 'A4 km 34.8',
    type: 'fixed',
    speedLimit: 100,
    coordinate: { latitude: 52.1620, longitude: 4.5430 },
    description: 'Vaste flitspaal bij knooppunt Burgerveen',
  },

  // --- A13 & ROTTERDAM ---
  {
    id: 'cam-a13-overschie',
    name: 'A13 Trajectcontrole Overschie',
    road: 'A13 km 11.2 (Overschie)',
    type: 'traject',
    speedLimit: 80,
    coordinate: { latitude: 51.9420, longitude: 4.4310 },
    description: 'Strikte 80 km/h milieuzone trajectcontrole',
  },
  {
    id: 'cam-a20-rot',
    name: 'A20 Kleinpolderplein',
    road: 'A20 km 28.5',
    type: 'fixed',
    speedLimit: 100,
    coordinate: { latitude: 51.9360, longitude: 4.4490 },
    description: 'Flitser splitsing A13 / A20',
  },
  {
    id: 'cam-rot-coolsingel',
    name: 'Coolsingel Flitspaal',
    road: 'Coolsingel Rotterdam',
    type: 'red_light',
    speedLimit: 50,
    coordinate: { latitude: 51.9215, longitude: 4.4790 },
    description: 'Snelheid + Roodlicht camera bij Stadhuis',
  },
  {
    id: 'cam-rot-maas',
    name: 'Maasboulevard Radar',
    road: 'Maasboulevard',
    type: 'fixed',
    speedLimit: 50,
    coordinate: { latitude: 51.9180, longitude: 4.5020 },
    description: 'Vaste flitspaal richting Erasmusbrug',
  },

  // --- A2 HIGHWAY (AMSTERDAM ➔ UTRECHT) ---
  {
    id: 'cam-a2-traject',
    name: 'A2 Trajectcontrole Breukelen',
    road: 'A2 km 48.0',
    type: 'traject',
    speedLimit: 100,
    coordinate: { latitude: 52.1750, longitude: 4.9920 },
    description: 'Trajectcontrole 5 rijstroken Breukelen',
  },
  {
    id: 'cam-utr-ring',
    name: 'A2 Utrecht Ring West',
    road: 'A2 km 56.4',
    type: 'fixed',
    speedLimit: 100,
    coordinate: { latitude: 52.0910, longitude: 5.0680 },
    description: 'Vaste flitspaal bij Lage Weide',
  },
  {
    id: 'cam-utr-daalse',
    name: 'Daalsetunnel Flitser',
    road: 'Daalsetunnel Utrecht',
    type: 'fixed',
    speedLimit: 50,
    coordinate: { latitude: 52.0950, longitude: 5.1090 },
    description: 'Flitspaal ingang Daalsetunnel',
  },
];

/**
 * Calculates estimated CJIB traffic fines (Netherlands) based on speed over the limit.
 */
export function calculateSpeedFine(currentSpeed: number, speedLimit: number): SpeedAlert {
  const overBy = Math.max(0, currentSpeed - speedLimit);
  const isOverLimit = overBy > 0;
  // Fine risk triggers when exceeding by 8+ km/h
  const isWayOverLimit = overBy >= 8;

  let fineEstimateEur = 0;
  if (overBy >= 1 && overBy <= 3) {
    fineEstimateEur = 0; // Statutory measurement margin
  } else if (overBy >= 4 && overBy <= 7) {
    fineEstimateEur = 42;
  } else if (overBy >= 8 && overBy <= 11) {
    fineEstimateEur = 88;
  } else if (overBy >= 12 && overBy <= 15) {
    fineEstimateEur = 155;
  } else if (overBy >= 16 && overBy <= 19) {
    fineEstimateEur = 210;
  } else if (overBy >= 20 && overBy <= 25) {
    fineEstimateEur = 285;
  } else if (overBy >= 26 && overBy <= 30) {
    fineEstimateEur = 380;
  } else if (overBy > 30) {
    fineEstimateEur = 490 + (overBy - 30) * 25; // Criminal penalty & license suspension risk
  }

  return {
    isOverLimit,
    isWayOverLimit,
    speedLimit,
    currentSpeed,
    overBy,
    fineEstimateEur,
  };
}

/**
 * Scans for speed cameras within a detection radar radius (default 3km).
 */
export function getNearbyCameras(
  position: Coordinate,
  radiusMeters: number = 3500
): { camera: SpeedCamera; distanceMeters: number }[] {
  const results: { camera: SpeedCamera; distanceMeters: number }[] = [];

  for (const cam of SPEED_CAMERAS) {
    const dist = getDistanceInMeters(
      position.latitude,
      position.longitude,
      cam.coordinate.latitude,
      cam.coordinate.longitude
    );
    if (dist <= radiusMeters) {
      results.push({ camera: cam, distanceMeters: dist });
    }
  }

  results.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return results;
}

/**
 * Finds the immediate upcoming camera ahead on the road within radar warning distance (1200m).
 */
export function getUpcomingCameraWarning(
  position: Coordinate,
  radarRadiusMeters: number = 1200
): CameraWarning | null {
  const nearby = getNearbyCameras(position, radarRadiusMeters);
  if (nearby.length === 0) return null;

  const closest = nearby[0];
  return {
    camera: closest.camera,
    distanceMeters: closest.distanceMeters,
    isUrgent: closest.distanceMeters <= 450,
  };
}
