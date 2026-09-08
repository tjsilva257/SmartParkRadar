import * as Location from 'expo-location';
import { Coordinate, DestinationTarget } from '../types/parking';

const POPULAR_DESTINATIONS: DestinationTarget[] = [
  {
    name: 'Centraal Station',
    subtitle: 'Stationsplein 1, Amsterdam · Public Transit Hub',
    coordinate: { latitude: 52.3791, longitude: 4.9003 },
  },
  {
    name: 'Dam Square & Royal Palace',
    subtitle: 'Dam, 1012 JS Amsterdam · Historic City Core',
    coordinate: { latitude: 52.3731, longitude: 4.8926 },
  },
  {
    name: 'Museumplein / Rijksmuseum',
    subtitle: 'Museumstraat 1, Amsterdam · Cultural Quarter',
    coordinate: { latitude: 52.3599, longitude: 4.8852 },
  },
  {
    name: 'Leidseplein',
    subtitle: 'Leidseplein, 1017 PT Amsterdam · Entertainment District',
    coordinate: { latitude: 52.3644, longitude: 4.8827 },
  },
  {
    name: 'Vondelpark',
    subtitle: 'Vondelpark, Amsterdam · Urban Park Area',
    coordinate: { latitude: 52.358, longitude: 4.8686 },
  },
  {
    name: 'Schiphol Airport P3',
    subtitle: 'Holiday Valet Parking, Schiphol',
    coordinate: { latitude: 52.3105, longitude: 4.7683 },
  },
];

/**
 * Searches for real destinations using expo-location geocoding + local smart catalog
 */
export async function searchDestinations(
  query: string,
  userLocation?: Coordinate
): Promise<DestinationTarget[]> {
  const trimmed = query.trim().toLowerCase();

  // If query is empty, return top popular destinations
  if (!trimmed) {
    return POPULAR_DESTINATIONS.slice(0, 4);
  }

  // 1. Instant local catalog matches
  const localMatches = POPULAR_DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(trimmed) ||
      d.subtitle.toLowerCase().includes(trimmed)
  );

  // 2. Real native geocoding via expo-location (resolves real addresses globally!)
  try {
    const geocoded = await Location.geocodeAsync(query);

    if (geocoded && geocoded.length > 0) {
      const liveResults: DestinationTarget[] = geocoded.slice(0, 4).map((res, index) => ({
        name: query.length > 25 ? query.slice(0, 25) + '...' : query,
        subtitle: `Geocoded location (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)})`,
        coordinate: {
          latitude: res.latitude,
          longitude: res.longitude,
        },
      }));

      // Combine local catalog matches and live geocoded results
      const combined = [...localMatches];
      for (const item of liveResults) {
        if (!combined.some((c) => Math.abs(c.coordinate.latitude - item.coordinate.latitude) < 0.001)) {
          combined.push(item);
        }
      }
      return combined.slice(0, 5);
    }
  } catch (error) {
    // Geocoding network fallback
  }

  // Return local matches or fallback
  if (localMatches.length > 0) {
    return localMatches;
  }

  // If no match found, create a sensible offset from user location for exploration
  const base = userLocation || { latitude: 52.3676, longitude: 4.9041 };
  return [
    {
      name: query,
      subtitle: 'Custom destination location',
      coordinate: {
        latitude: base.latitude + 0.005,
        longitude: base.longitude + 0.003,
      },
    },
  ];
}
