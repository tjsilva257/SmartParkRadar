// One place that decides which glyph + system color each kind of thing gets,
// so markers, rows, cards and banners always agree.
import type {
  CameraType,
  FacilityType,
  HazardCategory,
  ManeuverKind,
  ParkingType,
  PoiCategory,
} from '../types';
import type { ThemeColor } from '../theme';
import type { IconName } from './ui';

export interface Glyph {
  icon: IconName;
  color: ThemeColor;
  label: string;
}

const POI: Record<PoiCategory, Glyph> = {
  cafe: { icon: 'cafe', color: 'orange', label: 'Café' },
  restaurant: { icon: 'restaurant', color: 'orange', label: 'Restaurant' },
  bakery: { icon: 'storefront', color: 'orange', label: 'Bakery' },
  bar: { icon: 'beer', color: 'orange', label: 'Bar' },
  parking: { icon: 'car', color: 'blue', label: 'Parking' },
  transit: { icon: 'train', color: 'blue', label: 'Transit' },
  museum: { icon: 'business', color: 'pink', label: 'Museum' },
  park: { icon: 'leaf', color: 'green', label: 'Park' },
  shopping: { icon: 'bag-handle', color: 'yellow', label: 'Shopping' },
  home: { icon: 'home', color: 'blue', label: 'Home' },
  work: { icon: 'briefcase', color: 'brown', label: 'Work' },
  generic: { icon: 'location', color: 'red', label: 'Location' },
};

export function poiGlyph(category: PoiCategory | undefined): Glyph {
  return POI[category ?? 'generic'] ?? POI.generic;
}

const HAZARD: Record<HazardCategory, Glyph> = {
  mobile_camera: { icon: 'speedometer', color: 'blue', label: 'Speed Check' },
  parking_warden: { icon: 'eye', color: 'teal', label: 'Parking Enforcement' },
  accident: { icon: 'car', color: 'red', label: 'Accident' },
  road_work: { icon: 'construct', color: 'orange', label: 'Road Works' },
  road_block: { icon: 'remove-circle', color: 'red', label: 'Road Closed' },
  debris: { icon: 'warning', color: 'orange', label: 'Hazard' },
  traffic_jam: { icon: 'car-sport', color: 'orange', label: 'Traffic Jam' },
};

export function hazardGlyph(category: HazardCategory): Glyph {
  return HAZARD[category] ?? HAZARD.debris;
}

/** Report sheet order. */
export const HAZARD_CATEGORIES: HazardCategory[] = [
  'mobile_camera',
  'accident',
  'debris',
  'traffic_jam',
  'road_work',
  'road_block',
  'parking_warden',
];

const CAMERA: Record<CameraType, Glyph> = {
  fixed: { icon: 'camera', color: 'red', label: 'Speed Camera' },
  average: { icon: 'timer', color: 'red', label: 'Average Speed Check' },
  red_light: { icon: 'stop-circle', color: 'red', label: 'Red Light Camera' },
  mobile: { icon: 'speedometer', color: 'blue', label: 'Mobile Speed Check' },
  police: { icon: 'shield', color: 'indigo', label: 'Police' },
};

export function cameraGlyph(type: CameraType): Glyph {
  return CAMERA[type] ?? CAMERA.fixed;
}

/** Cameras drawn as a round speed-limit sign rather than a glyph badge. */
export function cameraUsesSign(type: CameraType): boolean {
  return type === 'fixed' || type === 'average' || type === 'red_light';
}

const PARKING: Record<ParkingType, Glyph> = {
  free: { icon: 'car', color: 'green', label: 'Free' },
  blue: { icon: 'time', color: 'indigo', label: 'Blue Zone' },
  cheap: { icon: 'pricetag', color: 'teal', label: 'Low Rate' },
  paid: { icon: 'card', color: 'orange', label: 'Paid' },
};

export function parkingGlyph(type: ParkingType): Glyph {
  return PARKING[type] ?? PARKING.paid;
}

export function facilityLabel(facility: FacilityType): string {
  return facility === 'garage' ? 'Garage' : facility === 'lot' ? 'Parking Lot' : facility === 'bay' ? 'Parking Bay' : 'Street Parking';
}

/** Turn arrow for the navigation banner. `rotate` is degrees clockwise. */
export function maneuverGlyph(kind: ManeuverKind): { icon: IconName; rotate: number } {
  switch (kind) {
    case 'depart':
      return { icon: 'navigate', rotate: -45 };
    case 'arrive':
      return { icon: 'flag', rotate: 0 };
    case 'left':
      return { icon: 'return-up-back', rotate: 0 };
    case 'right':
      return { icon: 'return-up-forward', rotate: 0 };
    case 'slight-left':
    case 'fork-left':
      return { icon: 'arrow-up', rotate: -40 };
    case 'slight-right':
    case 'fork-right':
    case 'ramp':
      return { icon: 'arrow-up', rotate: 40 };
    case 'sharp-left':
      return { icon: 'arrow-up', rotate: -130 };
    case 'sharp-right':
      return { icon: 'arrow-up', rotate: 130 };
    case 'uturn':
      return { icon: 'arrow-undo', rotate: 0 };
    case 'roundabout':
      return { icon: 'sync', rotate: 0 };
    case 'merge':
      return { icon: 'git-merge', rotate: 0 };
    case 'walk':
      return { icon: 'walk', rotate: 0 };
    case 'straight':
    default:
      return { icon: 'arrow-up', rotate: 0 };
  }
}
