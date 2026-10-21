// The one screen of the app: a full-bleed map with Apple Maps-style floating chrome.
// Owns all state and wires services -> sheets/overlays. Modes:
// browse (search sheet) -> place (place card) -> route (planner) -> nav (turn-by-turn).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Keyboard, Platform, StatusBar, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Details, LongPressEvent, MapPressEvent, MapType, PoiClickEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Coordinate,
  DEFAULT_ICON_FILTERS,
  DEFAULT_MAP_SETTINGS,
  ExploredGeometry,
  MapIconFilters,
  MapSettings,
  NewHazardReport,
  ParkingSpot,
  Place,
  RoadHazard,
  RouteOption,
  SavedState,
  SpeedCamera,
  TravelPhase,
} from './types';
import { spacing, spring, text, useTheme } from './theme';
import { bearing, distanceMeters } from './lib/geo';
import { fetchOsmParking, pickBestOsm, scanParking } from './services/parking';
import { fetchDriveRoutes, fetchWalkRoute } from './services/routing';
import { BUILTIN_CAMERAS, fetchOsmCameras, mergeCameras, upcomingCamera } from './services/cameras';
import { confirmHazard, isLocalHazard, loadAllHazards, loadHazards, reportHazard, timeAgo } from './services/hazards';
import { poiAt, poiCategoryFor, reverseGeocode } from './services/places';
import {
  addRecent,
  clearRecents,
  isFavorite,
  loadIconFilters,
  loadMapSettings,
  loadSaved,
  saveIconFilters,
  saveMapSettings,
  setSavedSlot,
  toggleFavorite,
} from './services/saved';
import { voice } from './services/voice';
import { addExplored, clearExplored, loadExplored, startBackgroundScratch, stopBackgroundScratch } from './services/scratchMap';
import { useTripSimulation } from './hooks/useTripSimulation';
import { cameraGlyph, hazardGlyph } from './components/glyphs';
import { Glass, Icon } from './components/ui';
import { SearchSheet } from './components/SearchSheet';
import { PlaceCard } from './components/PlaceCard';
import { RoutePlanner } from './components/RoutePlanner';
import { NavigationView } from './components/NavigationView';
import { MapControls, RadarPill } from './components/MapControls';
import { MapSettingsSheet } from './components/MapSettingsSheet';
import { ReportSheet } from './components/ReportSheet';
import { MemeShake } from './components/MemeShake';
import {
  CameraMarkers,
  HazardMarkers,
  ParkingOverlay,
  PlacePin,
  RouteLines,
  ScratchFog,
  VehiclePuck,
} from './components/MapLayers';

type Mode = 'browse' | 'place' | 'route' | 'nav';
type Overlay = 'settings' | 'report' | null;
type WalkRoute = { coordinates: Coordinate[]; distanceMeters: number; durationSeconds: number };

const DEFAULT_COORD: Coordinate = { latitude: 52.3676, longitude: 4.9041 };
const EMPTY_SAVED: SavedState = { home: null, work: null, favorites: [], recents: [] };
const NO_ROUTES: RouteOption[] = [];
const NO_PATH: Coordinate[] = [];
// The map fires onPress right after a POI tap or marker press; ignore it for this long.
const TAP_GUARD_MS = 600;
const LIVE_REFRESH_METERS = 3000;
// Floating control stack: capsule (2 x 44) + 8 gap + report button (44), starting at safeTop + 8.
const CONTROLS_HEIGHT = 8 + 88 + 8 + 44 + 8;
const RADAR_PILL_HEIGHT = 8 + 56 + 8;
// Nav framing: keep the puck clear of the guidance banner and the collapsed trip card.
const NAV_BANNER_SPACE = 110;
const NAV_CARD_HEIGHT = 92;
// Speed cluster above the trip card (gap 12 + 52 pt sign + 8), kept clear of the map's legal label/logo.
const NAV_CLUSTER_SPACE = 12 + 52 + 8;
// iOS: MapKit's compass sits top-right inside mapPadding; keep it left of the control column (10 + 44 + 8).
const IOS_CONTROLS_INSET = Platform.OS === 'ios' ? 10 + 44 + 8 : 0;

const coordKey = (c: Coordinate) => `${c.latitude.toFixed(5)},${c.longitude.toFixed(5)}`;

// Like Apple Maps, the map never insets past the medium detent: on Android a taller padding leaves
// no viewport for animateToRegion/fitToCoordinates and shifts the map on every detent change.
const mapBottomInset = (sheetHeight: number, screenH: number) => Math.min(sheetHeight, Math.round(screenH * 0.5));

function cameraVisible(c: SpeedCamera, f: MapIconFilters): boolean {
  return c.type === 'mobile' || c.type === 'police' ? f.showPolice : f.showSpeedCameras;
}

function hazardVisible(h: RoadHazard, f: MapIconFilters): boolean {
  switch (h.category) {
    case 'mobile_camera':
      return f.showPolice;
    case 'parking_warden':
      return f.showWardens;
    case 'road_work':
    case 'road_block':
      return f.showRoadworks;
    case 'accident':
    case 'debris':
    case 'traffic_jam':
      return f.showHazards;
    default:
      return true;
  }
}

function mapTypeFor(mode: MapSettings['mode']): MapType {
  if (mode === 'satellite') return 'hybrid';
  if (mode === 'driving' && Platform.OS === 'ios') return 'mutedStandard';
  return 'standard';
}

function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/** Foreground GPS: one Balanced fix, then a High-accuracy watch. null until the first fix. */
function useUserLocation(onFix: (c: Coordinate, first: boolean) => void): Coordinate | null {
  const [fix, setFix] = useState<Coordinate | null>(null);
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  useEffect(() => {
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    let first = true;
    const handle = (coords: { latitude: number; longitude: number }) => {
      if (!alive) return;
      const c = { latitude: coords.latitude, longitude: coords.longitude };
      setFix(c);
      onFixRef.current(c, first);
      first = false;
    };
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!alive || status !== Location.PermissionStatus.GRANTED) return;
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          handle(pos.coords);
        } catch {
          // Location services off or timed out: the watch below may still deliver.
        }
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 1500, distanceInterval: 3 },
          (loc) => handle(loc.coords)
        );
        if (alive) sub = s;
        else s.remove();
      } catch {
        // Permission request failed: stay on the default coordinate.
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  return fix;
}

/** Speed cameras + hazards: built-in/stored data at once, live OSM data around the user when online. */
function useLiveFeeds(fix: Coordinate | null) {
  const mounted = useMounted();
  const [cameras, setCameras] = useState<SpeedCamera[]>(BUILTIN_CAMERAS);
  const [hazards, setHazards] = useState<RoadHazard[]>([]);
  const [active, setActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const lastAt = useRef<Coordinate | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    let alive = true;
    loadHazards()
      .then((stored) => {
        // A live refresh may have landed first; it already contains the stored hazards.
        if (alive) setHazards((prev) => (prev.length ? prev : stored));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(
    async (at: Coordinate) => {
      lastAt.current = at;
      const id = ++runId.current;
      setRefreshing(true);
      try {
        const [live, all] = await Promise.all([fetchOsmCameras(at), loadAllHazards(at)]);
        if (!mounted.current || id !== runId.current) return;
        if (live.length) setCameras(mergeCameras(live));
        setHazards((prev) => {
          // Keep local reports made while this request was in flight.
          const ids = new Set(all.map((h) => h.id));
          return [...prev.filter((h) => isLocalHazard(h) && !ids.has(h.id)), ...all];
        });
        if (live.length || all.some((h) => !isLocalHazard(h))) setActive(true);
      } catch {
        // Offline: keep built-in cameras and stored hazards.
      } finally {
        if (mounted.current && id === runId.current) setRefreshing(false);
      }
    },
    [mounted]
  );

  useEffect(() => {
    if (!fix) return;
    if (!lastAt.current || distanceMeters(lastAt.current, fix) > LIVE_REFRESH_METERS) refresh(fix);
  }, [fix, refresh]);

  return { cameras, hazards, setHazards, active, refreshing, refresh };
}

/** Drive alternatives to the parking + walk from the parking, refetched per destination/parking pair. */
function useRoutes(destination: Place | null, parking: ParkingSpot | null, fromRef: React.RefObject<Coordinate>) {
  const key = destination && parking ? `${coordKey(parking.coordinate)}>${coordKey(destination.coordinate)}` : null;
  const [data, setData] = useState<{ key: string; routes: RouteOption[]; walk: WalkRoute | null } | null>(null);

  useEffect(() => {
    // Never show a cached result while its refetch is in flight: it would land after GO.
    setData(null);
    if (!key || !destination || !parking) return;
    let alive = true;
    Promise.all([
      fetchDriveRoutes(fromRef.current, parking.coordinate),
      fetchWalkRoute(parking.coordinate, destination.coordinate),
    ])
      .then(([routes, walk]) => {
        if (alive) setData({ key, routes, walk });
      })
      .catch(() => {
        if (alive) setData({ key, routes: [], walk: null });
      });
    return () => {
      alive = false;
    };
  }, [key]);

  // Results for a previous destination/parking never leak into the current one (also covers the render
  // before the effect above clears them).
  const current = data && data.key === key ? data : null;
  return { current, loading: key !== null && current === null };
}

function Toast({ message, top, onDone }: { message: string; top: number; onDone: () => void }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, ...spring.snappy }).start();
    const timer = setTimeout(() => {
      Animated.spring(anim, { toValue: 0, useNativeDriver: true, ...spring.snappy }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 2500);
    return () => {
      clearTimeout(timer);
      anim.stopAnimation();
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
        ],
      }}
    >
      <Glass radius={22} material="control" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16 }}>
        <Icon name="checkmark-circle" size={22} color={theme.green} />
        <Text style={[text.subhead, { fontWeight: '600', color: theme.label }]} numberOfLines={1}>
          {message}
        </Text>
      </Glass>
    </Animated.View>
  );
}

export default function MapScreen(): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const mounted = useMounted();
  const mapRef = useRef<MapView>(null);
  const lastMapTap = useRef(0);
  const poiTapSeq = useRef(0);

  const [mode, setMode] = useState<Mode>('browse');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [memeVisible, setMemeVisible] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [centered, setCentered] = useState(true);

  const [saved, setSaved] = useState<SavedState>(EMPTY_SAVED);
  const [filters, setFilters] = useState<MapIconFilters>(DEFAULT_ICON_FILTERS);
  const [settings, setSettings] = useState<MapSettings>(DEFAULT_MAP_SETTINGS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [explored, setExplored] = useState<ExploredGeometry>(null);

  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [maxWalk, setMaxWalk] = useState(500);
  const [osmSpots, setOsmSpots] = useState<ParkingSpot[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [goId, setGoId] = useState<string | null>(null);

  // Handlers and async callbacks read these so they never act on a stale render.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const centeredRef = useRef(centered);
  centeredRef.current = centered;
  const sheetHeightRef = useRef(sheetHeight);
  sheetHeightRef.current = sheetHeight;

  // ---------- Location, scratch map, live feeds ----------

  const fix = useUserLocation((c, first) => {
    addExplored(c)
      .then((g) => {
        // addExplored returns the same object when nothing changed, so this is a no-op then.
        if (mounted.current) setExplored(g);
      })
      .catch(() => undefined);
    if (first && modeRef.current === 'browse' && centeredRef.current) {
      mapRef.current?.animateToRegion({ ...c, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 800);
    }
  });
  const userCoord = fix ?? DEFAULT_COORD;
  const userCoordRef = useRef(userCoord);
  userCoordRef.current = userCoord;

  const live = useLiveFeeds(fix);
  const { cameras, hazards, setHazards } = live;

  // ---------- Persisted state ----------

  useEffect(() => {
    let alive = true;
    loadSaved()
      .then((s) => {
        if (alive) setSaved(s);
      })
      .catch(() => undefined);
    loadExplored()
      .then((g) => {
        // A GPS fix may already have produced a newer geometry.
        if (alive) setExplored((prev) => prev ?? g);
      })
      .catch(() => undefined);
    Promise.all([loadIconFilters(), loadMapSettings()])
      .then(([f, s]) => {
        if (!alive) return;
        setFilters(f);
        setSettings(s);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setPrefsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Persist only after loading, so the defaults never overwrite stored preferences.
  useEffect(() => {
    if (prefsLoaded) saveIconFilters(filters);
  }, [filters, prefsLoaded]);

  useEffect(() => {
    if (prefsLoaded) saveMapSettings(settings);
  }, [settings, prefsLoaded]);

  useEffect(() => {
    voice.setMuted(settings.voiceMuted);
  }, [settings.voiceMuted]);

  // Background location is only requested once the user turns the Scratch Map on.
  useEffect(() => {
    if (!prefsLoaded) return;
    if (settings.showScratchMap) startBackgroundScratch().catch(() => undefined);
    else stopBackgroundScratch().catch(() => undefined);
  }, [settings.showScratchMap, prefsLoaded]);

  // ---------- Destination, parking, routes ----------

  const scan = useMemo(() => (destination ? scanParking(destination.coordinate, maxWalk) : null), [destination, maxWalk]);

  useEffect(() => {
    setOsmSpots([]);
    if (!destination) return;
    let alive = true;
    fetchOsmParking(destination.coordinate)
      .then((spots) => {
        // Late results must not swap the parking (and so the route) under a running trip.
        if (alive && modeRef.current !== 'nav') setOsmSpots(spots);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [destination]);

  const parking = useMemo(
    () => (destination ? pickBestOsm(osmSpots, maxWalk) ?? scan?.best ?? null : null),
    [destination, osmSpots, maxWalk, scan]
  );
  const parkingRef = useRef(parking);
  parkingRef.current = parking;

  const routeState = useRoutes(destination, parking, userCoordRef);
  const routes = routeState.current?.routes ?? NO_ROUTES;
  const walk = routeState.current?.walk ?? null;
  const walkPath = walk?.coordinates ?? NO_PATH;
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;

  // New routes: select the fastest and frame it above the planner sheet.
  useEffect(() => {
    const data = routeState.current;
    const fastest = data?.routes[0];
    // A late result must never re-select or re-frame under a running trip.
    if (!fastest || !destination || modeRef.current !== 'route') return;
    setSelectedRouteId(fastest.id);
    const step = Math.max(1, Math.floor(fastest.coordinates.length / 40));
    const points = fastest.coordinates.filter((_, i) => i % step === 0);
    points.push(...fastest.coordinates.slice(-1), destination.coordinate);
    setCentered(false);
    const sheet = sheetHeightRef.current;
    // Android adds edgePadding on top of mapPadding; iOS uses edgePadding alone.
    const android = Platform.OS === 'android';
    const baseTop = android ? insets.top : 0;
    const baseBottom = android ? mapBottomInset(sheet, screenH) : 0;
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: insets.top + 80 - baseTop, right: 60, bottom: Math.max(24, sheet + 24 - baseBottom), left: 60 },
      animated: true,
    });
  }, [routeState.current]);

  // ---------- Trip ----------

  const handlePhaseChange = useCallback((phase: TravelPhase | 'arrived') => {
    const spot = parkingRef.current;
    if (phase === 'walking' && spot) {
      mapRef.current?.animateCamera({ center: spot.coordinate, pitch: 45, altitude: 300, zoom: 18.5 }, { duration: 800 });
    }
  }, []);

  const { trip, start, stop, cycleSpeedTest } = useTripSimulation({
    route: selectedRoute,
    walkPath,
    parking,
    destination,
    cameras,
    onPhaseChange: handlePhaseChange,
  });

  // GO selects a route and starts it; start once the hook has received that route.
  useEffect(() => {
    if (!goId || !selectedRoute || selectedRoute.id !== goId) return;
    setGoId(null);
    start();
    setMode('nav');
    const [a, b] = selectedRoute.coordinates;
    if (a) {
      mapRef.current?.animateCamera(
        { center: a, heading: b ? bearing(a, b) : 0, pitch: 55, altitude: 380, zoom: 18 },
        { duration: 800 }
      );
    }
  }, [goId, selectedRoute, start]);

  useEffect(() => {
    if (mode !== 'nav' || !trip) return;
    mapRef.current?.animateCamera(
      { center: trip.position, heading: trip.heading, pitch: 55, altitude: 380, zoom: 18 },
      { duration: 1000 }
    );
    // The simulated drive and walk scratch the fog open too, like the old app.
    addExplored(trip.position)
      .then((g) => {
        if (mounted.current) setExplored(g);
      })
      .catch(() => undefined);
  }, [mode, trip?.position]);

  // ---------- Derived map content ----------

  const typeFilteredCameras = useMemo(() => cameras.filter((c) => cameraVisible(c, filters)), [cameras, filters]);
  const inTrip = mode === 'route' || mode === 'nav';
  const showCameraMarkers = settings.cameraDisplay === 'always' || (settings.cameraDisplay === 'trip_only' && inTrip);
  const visibleHazards = useMemo(() => hazards.filter((h) => hazardVisible(h, filters)), [hazards, filters]);

  const browsing = mode === 'browse' || mode === 'place';
  const radarWarning = useMemo(
    () => (browsing && settings.cameraDisplay !== 'off' ? upcomingCamera(userCoord, typeFilteredCameras, 1500) : null),
    [browsing, settings.cameraDisplay, userCoord, typeFilteredCameras]
  );

  // ---------- Camera helpers ----------

  const flyToUser = () => {
    setCentered(true);
    mapRef.current?.animateCamera(
      { center: userCoordRef.current, pitch: 0, heading: 0, altitude: 1200, zoom: 16 },
      { duration: 800 }
    );
  };

  const focusPlace = (c: Coordinate) => {
    setCentered(false);
    // Center slightly south so the pin sits above the place card.
    mapRef.current?.animateToRegion(
      { latitude: c.latitude - 0.002, longitude: c.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      350
    );
  };

  const handleRecenter = () => {
    setCentered(true);
    mapRef.current?.animateToRegion({ ...userCoordRef.current, latitudeDelta: 0.008, longitudeDelta: 0.008 }, 600);
  };

  // ---------- Places ----------

  const rememberRecent = (place: Place) => {
    addRecent(place, savedRef.current.recents)
      .then((recents) => {
        if (mounted.current) setSaved((s) => ({ ...s, recents }));
      })
      .catch(() => undefined);
  };

  const openPlace = (place: Place, recent: boolean) => {
    poiTapSeq.current++; // drop any iOS POI lookup still in flight
    Keyboard.dismiss();
    setSelectedPlace(place);
    setMode('place');
    focusPlace(place.coordinate);
    if (recent) rememberRecent(place);
  };

  /** Fills in address details of a tapped POI / dropped pin, if it's still the one shown. */
  const enrichPlace = (place: Place, keepName: boolean) => {
    reverseGeocode(place.coordinate)
      .then((found) => {
        if (!found || !mounted.current) return;
        setSelectedPlace((cur) =>
          cur && cur.id === place.id
            ? {
                ...cur,
                name: keepName ? cur.name : found.name,
                subtitle: found.subtitle || cur.subtitle,
                city: found.city ?? cur.city,
                state: found.state ?? cur.state,
                country: found.country ?? cur.country,
              }
            : cur
        );
      })
      .catch(() => undefined);
  };

  const closePlace = () => {
    setSelectedPlace(null);
    setMode('browse');
  };

  const startDirections = (place: Place) => {
    poiTapSeq.current++;
    Keyboard.dismiss();
    setSelectedPlace(null);
    setSelectedRouteId(null);
    setDestination(place);
    setMode('route');
    rememberRecent(place);
  };

  const clearDestination = () => {
    setDestination(null);
    setSelectedRouteId(null);
    setGoId(null);
    setMode('browse');
    flyToUser();
  };

  const endTrip = () => {
    stop();
    clearDestination();
  };

  const handleToggleFavorite = (place: Place) => {
    toggleFavorite(place, savedRef.current.favorites)
      .then((favorites) => {
        if (mounted.current) setSaved((s) => ({ ...s, favorites }));
      })
      .catch(() => undefined);
  };

  const handleSetSlot = (slot: 'home' | 'work', place: Place | null) => {
    setSavedSlot(slot, place)
      .then((value) => {
        if (mounted.current) setSaved((s) => ({ ...s, [slot]: value }));
      })
      .catch(() => undefined);
  };

  const handleClearRecents = () => {
    setSaved((s) => ({ ...s, recents: [] }));
    clearRecents().catch(() => undefined);
  };

  // ---------- Map events ----------

  const handlePoiClick = (e: PoiClickEvent) => {
    if (modeRef.current !== 'browse' && modeRef.current !== 'place') return;
    lastMapTap.current = Date.now();
    const { name, placeId, coordinate } = e.nativeEvent;
    // Android puts the category on a second line of the POI name.
    const title = (name ?? '').split('\n')[0].trim() || 'Point of Interest';
    const c = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    const place: Place = {
      id: placeId || `poi-${coordKey(c)}`,
      name: title,
      // Filled in by enrichPlace; until then the card shows only the category.
      subtitle: '',
      coordinate: c,
      poiCategory: poiCategoryFor(title),
    };
    openPlace(place, false);
    enrichPlace(place, true);
  };

  const handleLongPress = (e: LongPressEvent) => {
    if (modeRef.current !== 'browse' && modeRef.current !== 'place') return;
    lastMapTap.current = Date.now();
    const c = { latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude };
    const place: Place = {
      id: `pin-${c.latitude.toFixed(5)}-${c.longitude.toFixed(5)}`,
      name: 'Dropped Pin',
      subtitle: '',
      coordinate: c,
      poiCategory: 'generic',
    };
    openPlace(place, false);
    enrichPlace(place, true);
  };

  const handleMapPress = (e: MapPressEvent) => {
    if (e.nativeEvent.action === 'marker-press') return;
    if (Date.now() - lastMapTap.current < TAP_GUARD_MS) return;
    Keyboard.dismiss();
    if (modeRef.current === 'place') {
      closePlace();
      return;
    }
    // Apple Maps has no onPoiClick: on iOS, look up a named POI under a browse-mode tap instead.
    if (Platform.OS !== 'ios' || modeRef.current !== 'browse' || !filters.showPois) return;
    const seq = ++poiTapSeq.current;
    const at = Date.now();
    const c = { latitude: e.nativeEvent.coordinate.latitude, longitude: e.nativeEvent.coordinate.longitude };
    poiAt(c)
      .then((place) => {
        // A later tap, marker press (iOS reports it after or before this one), long-press, search or
        // route start supersedes this lookup.
        const current = seq === poiTapSeq.current && lastMapTap.current < at && modeRef.current === 'browse';
        if (place && mounted.current && current) openPlace(place, false);
      })
      .catch(() => undefined);
  };

  const handleRegionChangeComplete = (_: Region, details: Details) => {
    if (details?.isGesture) setCentered(false);
  };

  // Stable callbacks so the memoized camera/hazard markers skip re-rendering on every trip tick.
  const handleCameraPress = useCallback((cam: SpeedCamera) => {
    lastMapTap.current = Date.now();
    const lines = [
      `${cameraGlyph(cam.type).label} · ${cam.road}`,
      cam.speedLimit > 0 ? `Speed limit: ${cam.speedLimit} km/h` : '',
      cam.description ?? '',
    ].filter(Boolean);
    Alert.alert(cam.name, lines.join('\n'));
  }, []);

  const handleHazardPress = useCallback((h: RoadHazard) => {
    lastMapTap.current = Date.now();
    const lines = [
      `${hazardGlyph(h.category).label} · ${h.roadName}`,
      `Reported by ${h.reporterLabel || 'a driver'} · ${timeAgo(h.reportedAt)}`,
      h.note ?? '',
      `${h.confirmations} ${h.confirmations === 1 ? 'confirmation' : 'confirmations'}`,
    ].filter(Boolean);
    Alert.alert(h.title, lines.join('\n'), [
      {
        text: 'Confirm (+1)',
        onPress: () => {
          setHazards((prev) => prev.map((x) => (x.id === h.id ? { ...x, confirmations: x.confirmations + 1 } : x)));
          confirmHazard(h.id).catch(() => undefined);
        },
      },
      { text: 'Close', style: 'cancel' },
    ]);
  }, [setHazards]);

  // ---------- Overlays ----------

  const handleReport = async (report: NewHazardReport) => {
    try {
      const hazard = await reportHazard(report);
      if (!mounted.current) return;
      setHazards((prev) => [hazard, ...prev.filter((x) => x.id !== hazard.id)]);
      voice.say(`Report sent: ${hazard.title} on ${hazard.roadName}`);
      // In nav the toast would cover the guidance banner; the voice line and new marker confirm it there.
      if (modeRef.current !== 'nav') setToast({ id: Date.now(), message: 'Thanks! Your report is live.' });
    } catch {
      if (mounted.current) Alert.alert('Report Not Sent', 'Your report could not be saved. Please try again.');
    }
  };

  const handleResetScratchMap = () => {
    clearExplored()
      .then(() => {
        if (mounted.current) setExplored(null);
      })
      .catch(() => undefined);
  };

  const openMemeFromSettings = () => {
    setOverlay(null);
    // iOS can't present a Modal while another one is still animating out.
    setTimeout(() => {
      if (mounted.current) setMemeVisible(true);
    }, 400);
  };

  // ---------- Layout ----------

  const sheetTop = screenH - sheetHeight;
  const controlsTop = insets.top + 8;
  const showControls = mode !== 'nav' && sheetTop > controlsTop + CONTROLS_HEIGHT;
  const showRadar = !!radarWarning && sheetTop > controlsTop + RADAR_PILL_HEIGHT;
  const mapPadding =
    mode === 'nav'
      ? {
          top: insets.top + NAV_BANNER_SPACE,
          right: 0,
          bottom: NAV_CARD_HEIGHT + Math.max(insets.bottom, spacing.sheetMargin) + NAV_CLUSTER_SPACE,
          left: 0,
        }
      : { top: insets.top, right: IOS_CONTROLS_INSET, bottom: mapBottomInset(sheetHeight, screenH), left: 0 };
  // The nav banner floats below the status bar, so the bar sits on the map like in every other mode.
  const lightStatusBar = theme.dark || settings.mode === 'satellite';

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle={lightStatusBar ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{ ...DEFAULT_COORD, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
        mapType={mapTypeFor(settings.mode)}
        showsTraffic={settings.showTraffic || settings.mode === 'driving'}
        showsPointsOfInterests={filters.showPois}
        showsUserLocation={mode !== 'nav'}
        showsMyLocationButton={false}
        // In nav the heading follows the route, so a compass would sit permanently on the banner strips.
        showsCompass={mode !== 'nav'}
        showsScale
        showsBuildings
        pitchEnabled
        rotateEnabled
        toolbarEnabled={false}
        zoomControlEnabled={false}
        moveOnMarkerPress={false}
        // Android only reads this at creation; unset it follows the system theme live, like useTheme.
        userInterfaceStyle={Platform.OS === 'ios' ? (theme.dark ? 'dark' : 'light') : undefined}
        mapPadding={mapPadding}
        onPoiClick={handlePoiClick}
        onLongPress={handleLongPress}
        onPress={handleMapPress}
        onMarkerPress={() => {
          lastMapTap.current = Date.now();
        }}
        onPanDrag={() => setCentered(false)}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {settings.showScratchMap && <ScratchFog geometry={explored} />}
        {inTrip && (
          <RouteLines
            routes={routes}
            selectedId={selectedRoute?.id ?? null}
            walkPath={walkPath}
            navigating={mode === 'nav'}
            onSelectRoute={(id: string) => {
              lastMapTap.current = Date.now();
              setSelectedRouteId(id);
            }}
          />
        )}
        {inTrip && filters.showParking && parking && <ParkingOverlay spot={parking} />}
        {showCameraMarkers && <CameraMarkers cameras={typeFilteredCameras} onPress={handleCameraPress} />}
        <HazardMarkers hazards={visibleHazards} onPress={handleHazardPress} />
        {mode === 'place' && selectedPlace && (
          <PlacePin place={selectedPlace} onPress={() => focusPlace(selectedPlace.coordinate)} />
        )}
        {inTrip && destination && <PlacePin place={destination} />}
        {mode === 'nav' && trip && <VehiclePuck position={trip.position} phase={trip.phase} />}
      </MapView>

      {showControls && (
        <MapControls
          top={controlsTop}
          centered={centered}
          onOpenSettings={() => setOverlay('settings')}
          onRecenter={handleRecenter}
          onReport={() => setOverlay('report')}
        />
      )}

      {/* RadarPill insets itself clear of the control column. */}
      {showRadar && radarWarning && <RadarPill warning={radarWarning} top={controlsTop} />}

      {mode === 'browse' && (
        <SearchSheet
          userLocation={userCoord}
          hasLocation={!!fix}
          saved={saved}
          onSelectPlace={(place) => openPlace(place, true)}
          onRoutePlace={startDirections}
          onSetSlot={handleSetSlot}
          onToggleFavorite={handleToggleFavorite}
          onClearRecents={handleClearRecents}
          onTriggerMeme={() => setMemeVisible(true)}
          onHeightChange={setSheetHeight}
        />
      )}

      {mode === 'place' && selectedPlace && (
        <PlaceCard
          place={selectedPlace}
          userLocation={userCoord}
          isFavorite={isFavorite(selectedPlace, saved.favorites)}
          onDirections={startDirections}
          onToggleFavorite={handleToggleFavorite}
          onClose={closePlace}
          onHeightChange={setSheetHeight}
        />
      )}

      {mode === 'route' && destination && (
        <RoutePlanner
          destination={destination}
          parking={parking}
          nearestFree={scan?.nearestFree ?? null}
          routes={routes}
          selectedRouteId={selectedRoute?.id ?? null}
          loading={routeState.loading}
          walk={walk}
          maxWalkMeters={maxWalk}
          onChangeMaxWalk={setMaxWalk}
          onSelectRoute={setSelectedRouteId}
          onGo={(id) => {
            setSelectedRouteId(id);
            setGoId(id);
          }}
          onClose={clearDestination}
          onHeightChange={setSheetHeight}
        />
      )}

      {mode === 'nav' && trip && destination && (
        <NavigationView
          trip={trip}
          destination={destination}
          parking={parking}
          voiceMuted={settings.voiceMuted}
          onToggleVoice={() => setSettings((s) => ({ ...s, voiceMuted: !s.voiceMuted }))}
          onEnd={endTrip}
          onReport={() => setOverlay('report')}
          onCycleSpeedTest={cycleSpeedTest}
        />
      )}

      <MapSettingsSheet
        visible={overlay === 'settings'}
        onClose={() => setOverlay(null)}
        settings={settings}
        onChangeSettings={setSettings}
        filters={filters}
        onChangeFilters={setFilters}
        live={{
          active: live.active,
          refreshing: live.refreshing,
          cameraCount: cameras.length,
          hazardCount: hazards.length,
        }}
        onRefreshLive={() => live.refresh(userCoordRef.current)}
        onResetScratchMap={handleResetScratchMap}
        onOpenMeme={openMemeFromSettings}
      />

      <ReportSheet
        visible={overlay === 'report'}
        // While navigating, "here" is the simulated vehicle the user is looking at.
        userLocation={mode === 'nav' && trip ? trip.position : userCoord}
        // Without a GPS fix userCoord is only the Amsterdam fallback, not a place to report at.
        locationKnown={(mode === 'nav' && !!trip) || !!fix}
        onClose={() => setOverlay(null)}
        onSubmit={handleReport}
      />

      <MemeShake visible={memeVisible} onClose={() => setMemeVisible(false)} />

      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          top={showRadar ? controlsTop + RADAR_PILL_HEIGHT - 8 : controlsTop}
          onDone={() => setToast((t) => (t?.id === toast.id ? null : t))}
        />
      )}
    </View>
  );
}
