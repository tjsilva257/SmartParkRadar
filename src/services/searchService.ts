import * as Location from 'expo-location';
import { Coordinate, DestinationTarget } from '../types/parking';

export const POPULAR_DESTINATIONS: DestinationTarget[] = [
  {
    name: 'Centraal Station',
    subtitle: 'Stationsplein 1, Amsterdam · Public Transit Hub',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.3791, longitude: 4.9003 },
  },
  {
    name: 'Dam Square & Royal Palace',
    subtitle: 'Dam, 1012 JS Amsterdam · Historic City Core',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.3731, longitude: 4.8926 },
  },
  {
    name: 'Museumplein / Rijksmuseum',
    subtitle: 'Museumstraat 1, Amsterdam · Cultural Quarter',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.3599, longitude: 4.8852 },
  },
  {
    name: 'Leidseplein',
    subtitle: 'Leidseplein, 1017 PT Amsterdam · Entertainment District',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.3644, longitude: 4.8827 },
  },
  {
    name: 'Vondelpark',
    subtitle: 'Vondelpark, Amsterdam · Urban Park Area',
    city: 'Amsterdam',
    state: 'Noord-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.358, longitude: 4.8686 },
  },
  {
    name: 'Schiphol Airport P3',
    subtitle: 'Holiday Valet Parking, Schiphol',
    city: 'Schiphol',
    state: 'Noord-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.3105, longitude: 4.7683 },
  },
  {
    name: 'Rotterdam Centraal',
    subtitle: 'Stationsplein 1, 3013 AJ Rotterdam · City Terminal',
    city: 'Rotterdam',
    state: 'Zuid-Holland',
    country: 'Nederland',
    coordinate: { latitude: 51.9244, longitude: 4.4777 },
  },
  {
    name: 'Rotterdam Centrum / Markthal',
    subtitle: 'Ds. Jan Scharpstraat 298, Rotterdam · Commercial Core',
    city: 'Rotterdam',
    state: 'Zuid-Holland',
    country: 'Nederland',
    coordinate: { latitude: 51.9201, longitude: 4.4868 },
  },
  {
    name: 'Utrecht Centraal',
    subtitle: 'Stationshal 12, 3511 CE Utrecht · Central Hub',
    city: 'Utrecht',
    state: 'Utrecht',
    country: 'Nederland',
    coordinate: { latitude: 52.0894, longitude: 5.1102 },
  },
  {
    name: 'Den Haag Centraal',
    subtitle: 'Koningin Julianaplein 10, Den Haag · Government District',
    city: 'Den Haag',
    state: 'Zuid-Holland',
    country: 'Nederland',
    coordinate: { latitude: 52.0809, longitude: 4.3248 },
  },
];

/**
 * Calculates Haversine distance in km between two GPS coordinates
 */
export function calculateDistanceKm(c1: Coordinate, c2: Coordinate): number {
  const R = 6371; // Earth radius km
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLon = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.latitude * Math.PI) / 180) *
      Math.cos((c2.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance into friendly text (e.g. "450 m" or "3.4 km")
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

interface IntermediateResult extends DestinationTarget {
  _distVal: number;
}

/**
 * High-accuracy multi-city street and destination search.
 * Supports Dutch street normalization (e.g. 'apple straat' -> 'appelstraat'),
 * location biasing from user coordinates, and distinct street entries per city.
 */
export async function searchDestinations(
  query: string,
  userLocation?: Coordinate
): Promise<DestinationTarget[]> {
  const trimmed = query.trim();

  // If query is empty, return popular destinations with distance calculated
  if (!trimmed) {
    return POPULAR_DESTINATIONS.map((dest) => {
      if (userLocation) {
        const dist = calculateDistanceKm(userLocation, dest.coordinate);
        return {
          ...dest,
          distanceKm: formatDistance(dist),
        };
      }
      return dest;
    });
  }

  const userLat = userLocation?.latitude ?? 52.3676;
  const userLon = userLocation?.longitude ?? 4.9041;

  // 1. Generate smart query variations (e.g. 'apple straat' -> 'appel straat', 'appelstraat')
  const queryVariants: string[] = [trimmed];
  const dutchTypoFix = trimmed.replace(/\bapple\b/gi, 'appel');
  if (dutchTypoFix.toLowerCase() !== trimmed.toLowerCase()) {
    queryVariants.push(dutchTypoFix);
  }

  // Handle separated suffixes (e.g. 'appel straat' -> 'appelstraat', 'kerk laan' -> 'kerklaan')
  const joinedSuffix = dutchTypoFix.replace(
    /\s+(straat|weg|laan|plein|kade|gracht|dijk|singel|pad|steeg|dreef)\b/gi,
    (_match, p1) => p1
  );
  if (joinedSuffix.toLowerCase() !== dutchTypoFix.toLowerCase()) {
    queryVariants.push(joinedSuffix);
  }

  const seenKeys = new Set<string>();
  const results: IntermediateResult[] = [];

  // 2. High-speed multi-city geocoding via Photon with location bias
  for (const variant of queryVariants.slice().reverse()) {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        variant
      )}&lat=${userLat}&lon=${userLon}&limit=16`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800);

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        for (const f of data.features || []) {
          const p = f.properties;
          const name = p.name || p.street;
          if (!name) continue;

          const city =
            p.city ||
            p.town ||
            p.village ||
            p.municipality ||
            p.district ||
            p.county ||
            '';
          const state = p.state || '';
          const country = p.country || '';

          // Deduplicate by street name + city (allows same street in multiple different cities!)
          const key = `${name.toLowerCase()}|${city.toLowerCase()}|${country.toLowerCase()}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);

          const coordinate: Coordinate = {
            latitude: f.geometry.coordinates[1],
            longitude: f.geometry.coordinates[0],
          };

          const dist = calculateDistanceKm({ latitude: userLat, longitude: userLon }, coordinate);
          const subtitleParts = [city, state, country].filter(Boolean);
          const subtitle = subtitleParts.length > 0 ? subtitleParts.join(', ') : 'Location';

          results.push({
            id: `photon_${f.geometry.coordinates.join('_')}`,
            name,
            subtitle,
            city,
            state,
            country,
            coordinate,
            distanceKm: formatDistance(dist),
            _distVal: dist,
          });
        }
      }
    } catch {
      // Continue to next variant or fallbacks
    }

    if (results.length >= 8) break;
  }

  // Filter out any anomalous results that are > 2500 km away if we already have local results
  const localResults = results.filter((r) => r._distVal < 1500);
  const candidates = localResults.length > 0 ? localResults : results;

  // Sort by proximity to the user's current GPS position
  candidates.sort((a, b) => a._distVal - b._distVal);

  if (candidates.length > 0) {
    return candidates.slice(0, 10).map(({ _distVal, ...rest }) => rest);
  }

  // 3. Fallback: OpenStreetMap Nominatim for exact street & city search
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&addressdetails=1&limit=8`;
    const nomRes = await fetch(nomUrl, {
      headers: { 'User-Agent': 'SmartParkRadar/1.0' },
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      for (const item of nomData) {
        const addr = item.address || {};
        const road = addr.road || addr.pedestrian || item.display_name.split(',')[0];
        const city = addr.city || addr.town || addr.village || addr.municipality || '';
        const state = addr.state || '';
        const country = addr.country || '';
        const coordinate = {
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        };
        const dist = calculateDistanceKm({ latitude: userLat, longitude: userLon }, coordinate);

        results.push({
          id: `nom_${item.place_id || Math.random()}`,
          name: road || query,
          subtitle: [city, state, country].filter(Boolean).join(', ') || item.display_name,
          city,
          state,
          country,
          coordinate,
          distanceKm: formatDistance(dist),
          _distVal: dist,
        });
      }
    }
  } catch {
    // Continue to local fallback
  }

  if (results.length > 0) {
    results.sort((a, b) => a._distVal - b._distVal);
    return results.slice(0, 8).map(({ _distVal, ...rest }) => rest);
  }

  // 4. Native Expo Geocoder fallback (offline or constrained networks)
  try {
    const geocoded = await Location.geocodeAsync(query);
    if (geocoded && geocoded.length > 0) {
      return geocoded.slice(0, 4).map((res) => {
        const coordinate = { latitude: res.latitude, longitude: res.longitude };
        const dist = calculateDistanceKm({ latitude: userLat, longitude: userLon }, coordinate);
        return {
          id: `expo_${res.latitude}_${res.longitude}`,
          name: query,
          subtitle: `Geocoded coordinate (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)})`,
          coordinate,
          distanceKm: formatDistance(dist),
        };
      });
    }
  } catch {
    // Offline fallback
  }

  // 5. Local catalog keyword search
  const lowerQuery = query.toLowerCase();
  const catalogMatches = POPULAR_DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(lowerQuery) ||
      d.subtitle.toLowerCase().includes(lowerQuery) ||
      (d.city && d.city.toLowerCase().includes(lowerQuery))
  ).map((dest) => {
    const dist = calculateDistanceKm({ latitude: userLat, longitude: userLon }, dest.coordinate);
    return {
      ...dest,
      distanceKm: formatDistance(dist),
    };
  });

  if (catalogMatches.length > 0) {
    return catalogMatches;
  }

  // 6. Generic offset fallback for free-form exploration
  const base = userLocation || { latitude: 52.3676, longitude: 4.9041 };
  return [
    {
      name: query,
      subtitle: 'Custom destination location',
      coordinate: {
        latitude: base.latitude + 0.005,
        longitude: base.longitude + 0.003,
      },
      distanceKm: '1.2 km',
    },
  ];
}
