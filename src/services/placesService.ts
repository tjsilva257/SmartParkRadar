import { Coordinate, DestinationTarget } from '../types/parking';
import { getDistanceInMeters } from '../utils/distance';

export interface MapPlace extends DestinationTarget {
  category: 'restaurant' | 'cafe' | 'bakery' | 'bar' | 'poi';
  emoji: string;
  categoryLabel: string;
}

/**
 * Detects appropriate category emoji and title for any POI based on its name
 */
export function detectPoiCategory(name: string): {
  category: 'restaurant' | 'cafe' | 'bakery' | 'bar' | 'poi';
  emoji: string;
  categoryLabel: string;
} {
  const lower = name.toLowerCase();

  if (
    lower.includes('cafe') ||
    lower.includes('café') ||
    lower.includes('coffee') ||
    lower.includes('koffie') ||
    lower.includes('espresso') ||
    lower.includes('roastery')
  ) {
    return { category: 'cafe', emoji: '☕', categoryLabel: 'Café & Koffie' };
  }

  if (
    lower.includes('bakker') ||
    lower.includes('bakery') ||
    lower.includes('patisserie') ||
    lower.includes('croissant') ||
    lower.includes('koek')
  ) {
    return { category: 'bakery', emoji: '🥐', categoryLabel: 'Bakkerij & Patisserie' };
  }

  if (
    lower.includes('bar') ||
    lower.includes('pub') ||
    lower.includes('brouwerij') ||
    lower.includes('brewery') ||
    lower.includes('bier') ||
    lower.includes('lounge')
  ) {
    return { category: 'bar', emoji: '🍺', categoryLabel: 'Bar & Brouwerij' };
  }

  if (
    lower.includes('restaurant') ||
    lower.includes('bistrot') ||
    lower.includes('bistro') ||
    lower.includes('brasserie') ||
    lower.includes('pancake') ||
    lower.includes('pizza') ||
    lower.includes('pizzeria') ||
    lower.includes('burger') ||
    lower.includes('sushi') ||
    lower.includes('kitchen') ||
    lower.includes('eten') ||
    lower.includes('steak')
  ) {
    return { category: 'restaurant', emoji: '🍽️', categoryLabel: 'Restaurant' };
  }

  return { category: 'poi', emoji: '📍', categoryLabel: 'Interessante Locatie' };
}

/**
 * Curated authentic cafes, restaurants, bars, and bakeries in Amsterdam core
 * that render as interactive icons on the road map.
 */
export const CURATED_PLACES: MapPlace[] = [
  {
    id: 'place-cafe-de-jaren',
    name: 'Café de Jaren',
    subtitle: 'Nieuwe Doelenstraat 20 · Terras aan de Amstel',
    coordinate: { latitude: 52.3678, longitude: 4.8962 },
    category: 'cafe',
    emoji: '☕',
    categoryLabel: 'Café aan het water',
  },
  {
    id: 'place-winkel-43',
    name: 'Winkel 43',
    subtitle: 'Noordermarkt 43 · Beroemde Appeltaart',
    coordinate: { latitude: 52.3796, longitude: 4.8860 },
    category: 'cafe',
    emoji: '🥧',
    categoryLabel: 'Café & Appeltaart',
  },
  {
    id: 'place-restaurant-breda',
    name: 'Restaurant BREDA',
    subtitle: 'Singel 210 · Franse Gastronomie',
    coordinate: { latitude: 52.3725, longitude: 4.8885 },
    category: 'restaurant',
    emoji: '🍽️',
    categoryLabel: 'Gastronomisch Restaurant',
  },
  {
    id: 'place-pancakes-ams',
    name: 'PANCAKES Amsterdam',
    subtitle: 'Prinsengracht 277 · Naast Anne Frank Huis',
    coordinate: { latitude: 52.3752, longitude: 4.8837 },
    category: 'restaurant',
    emoji: '🥞',
    categoryLabel: 'Pannenkoekenhuis',
  },
  {
    id: 'place-bakkerij-wolf',
    name: 'Bakkerij Wolf',
    subtitle: 'Wolvenstraat 22 · 9 Straatjes Zuurdesem',
    coordinate: { latitude: 52.3702, longitude: 4.8856 },
    category: 'bakery',
    emoji: '🥐',
    categoryLabel: 'Ambachtelijke Bakkerij',
  },
  {
    id: 'place-cannibale-royale',
    name: 'Cannibale Royale',
    subtitle: 'Handboogstraat 29 · Craft Burgers & Grill',
    coordinate: { latitude: 52.3685, longitude: 4.8899 },
    category: 'restaurant',
    emoji: '🍔',
    categoryLabel: 'Grill & Burgers',
  },
  {
    id: 'place-brouwerij-t-ij',
    name: "Brouwerij 't IJ",
    subtitle: 'Funenkade 7 · Windmolen Proeflokaal',
    coordinate: { latitude: 52.3667, longitude: 4.9264 },
    category: 'bar',
    emoji: '🍺',
    categoryLabel: 'Speciaalbier Brouwerij',
  },
  {
    id: 'place-pluk-ams',
    name: 'Pluk Amsterdam',
    subtitle: 'Reestraat 19 · Brunch & Specialty Coffee',
    coordinate: { latitude: 52.3712, longitude: 4.8845 },
    category: 'cafe',
    emoji: '☕',
    categoryLabel: 'Brunch & Koffiebar',
  },
  {
    id: 'place-de-kas',
    name: 'Restaurant De Kas',
    subtitle: 'Kamerlingh Onneslaan 3 · Kwekerij & Dine',
    coordinate: { latitude: 52.3522, longitude: 4.9304 },
    category: 'restaurant',
    emoji: '🥗',
    categoryLabel: 'Farm-to-table Restaurant',
  },
  {
    id: 'place-sound-garden',
    name: 'Café Sound Garden',
    subtitle: 'Marnixstraat 164 · Terras aan Singelgracht',
    coordinate: { latitude: 52.3741, longitude: 4.8768 },
    category: 'bar',
    emoji: '🍻',
    categoryLabel: 'Muziekbar aan het water',
  },
];

/**
 * Calculates distance and walking estimate from user to place
 */
export function getPlaceDistanceInfo(
  userCoord: Coordinate,
  placeCoord: Coordinate
): { distanceText: string; walkingMin: number } {
  const meters = getDistanceInMeters(
    userCoord.latitude,
    userCoord.longitude,
    placeCoord.latitude,
    placeCoord.longitude
  );

  const distanceText = meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
  const walkingMin = Math.max(1, Math.round(meters / 80)); // ~80 meters per minute walk

  return { distanceText, walkingMin };
}

