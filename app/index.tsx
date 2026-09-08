import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  Keyboard,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Region, MapType } from 'react-native-maps';
import * as Location from 'expo-location';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface ParkingSpot {
  id: string;
  title: string;
  type: 'free' | 'blue' | 'cheap' | 'paid' | 'hazard';
  pricePerHour: number;
  label: string;
  badge: string;
  distanceToDestMeters: number;
  walkingTimeMinutes: number;
  venstertijden: string;
  coordinate: Coordinate;
  color: string;
  description: string;
}

interface DestinationTarget {
  name: string;
  subtitle: string;
  coordinate: Coordinate;
}

interface TurnManeuver {
  instruction: string;
  street: string;
  distanceText: string;
  icon: string;
}

const DEFAULT_COORDS: Coordinate = {
  latitude: 52.3676,
  longitude: 4.9041,
};

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (val: number) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function generateRouteWaypoints(start: Coordinate, end: Coordinate, steps = 8): Coordinate[] {
  const points: Coordinate[] = [start];
  for (let i = 1; i <= steps; i++) {
    const ratio = i / (steps + 1);
    const latBend = Math.sin(ratio * Math.PI) * 0.0007;
    const lonBend = Math.cos(ratio * Math.PI) * 0.0005;
    points.push({
      latitude: start.latitude + (end.latitude - start.latitude) * ratio + (i % 2 === 0 ? latBend : -latBend * 0.4),
      longitude: start.longitude + (end.longitude - start.longitude) * ratio + (i % 2 === 1 ? lonBend : -lonBend * 0.4),
    });
  }
  points.push(end);
  return points;
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>({
    ...DEFAULT_COORDS,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Navigation State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [destination, setDestination] = useState<DestinationTarget | null>(null);
  const [optimalSpot, setOptimalSpot] = useState<ParkingSpot | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);

  // Clutter-Free Separate Menu State for Hazard & Map Layers
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  // In-App Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPhase, setNavPhase] = useState<'driving' | 'walking'>('driving');
  const [currentSpeed, setCurrentSpeed] = useState(48); // km/h
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [simStep, setSimStep] = useState(0);

  // Fixed TS2694 error: use ReturnType<typeof setInterval> instead of NodeJS.Timeout
  const [simIntervalId, setSimIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  // Map display settings
  const [mapType, setMapType] = useState<MapType>('standard');
  const [showTraffic, setShowTraffic] = useState(true);

  const userCoord: Coordinate = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
    : DEFAULT_COORDS;

  const [vehiclePosition, setVehiclePosition] = useState<Coordinate>(userCoord);

  useEffect(() => {
    setVehiclePosition(userCoord);
  }, [userCoord.latitude, userCoord.longitude]);

  // Request GPS permission on mount
  useEffect(() => {
    let isMounted = true;
    let locSubscription: Location.LocationSubscription | null = null;

    async function initLocation() {
      try {
        setIsLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status === Location.PermissionStatus.GRANTED) {
          const currentLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          if (isMounted) {
            setLocation(currentLoc);
            const initialRegion: Region = {
              latitude: currentLoc.coords.latitude,
              longitude: currentLoc.coords.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            };
            setRegion(initialRegion);
            mapRef.current?.animateToRegion(initialRegion, 800);
          }

          locSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 1500,
              distanceInterval: 3,
            },
            (updatedLoc) => {
              if (isMounted) {
                setLocation(updatedLoc);
                if (updatedLoc.coords.speed && updatedLoc.coords.speed > 0) {
                  setCurrentSpeed(Math.round(updatedLoc.coords.speed * 3.6));
                }
              }
            }
          );
        }
      } catch (err) {
        // Fallback to default coordinates
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initLocation();

    return () => {
      isMounted = false;
      locSubscription?.remove();
      if (simIntervalId) clearInterval(simIntervalId);
    };
  }, []);

  const scanCenter: Coordinate = destination ? destination.coordinate : userCoord;

  // Candidate parking spots in 750m radius
  const nearbySpots: ParkingSpot[] = useMemo(() => {
    const dLat = scanCenter.latitude;
    const dLon = scanCenter.longitude;

    const spotsRaw = [
      {
        id: 'spot-free-1',
        title: 'Singel Free Parking Strip',
        type: 'free' as const,
        pricePerHour: 0,
        label: 'FREE',
        badge: '100% FREE',
        venstertijden: 'Free 24/7 · Municipal non-metered strip',
        color: '#10b981',
        offset: { lat: 0.0019, lon: 0.0014 },
        description: 'Roadside municipal free zone. 3 free spots usually available.',
      },
      {
        id: 'spot-blue-1',
        title: 'Prins Hendrikkade Blue Zone',
        type: 'blue' as const,
        pricePerHour: 0,
        label: 'BLUE 2H',
        badge: 'BLUE ZONE',
        venstertijden: 'Max 2h with disc · Free after 18:00 & Sundays',
        color: '#2563eb',
        offset: { lat: -0.0022, lon: 0.0025 },
        description: 'Blue zone parking disc required between 09:00 and 18:00.',
      },
      {
        id: 'spot-cheap-1',
        title: 'Westerdok Municipal Low-Tariff',
        type: 'cheap' as const,
        pricePerHour: 1.5,
        label: '€1.50/h',
        badge: 'CHEAPEST PAID',
        venstertijden: '€1.50/h · 100% Free after 19:00 and all Sunday',
        color: '#0284c7',
        offset: { lat: 0.0034, lon: -0.0021 },
        description: 'Low-tariff municipal zone. Saves up to €5.50/h vs destination roadside tariff.',
      },
      {
        id: 'spot-garage-1',
        title: 'Q-Park City Center Garage',
        type: 'paid' as const,
        pricePerHour: 5.5,
        label: '€5.50/h',
        badge: 'GARAGE',
        venstertijden: 'Open 24/7 · Covered · EV Charging bays',
        color: '#f59e0b',
        offset: { lat: 0.0012, lon: -0.0038 },
        description: 'Underground secured facility right in the core.',
      },
      {
        id: 'hazard-1',
        title: 'Active Parking Warden / Controle',
        type: 'hazard' as const,
        pricePerHour: 0,
        label: '⚠️ WARDEN',
        badge: 'HAZARD',
        venstertijden: 'Scan-car reported 3m ago on this road',
        color: '#dc2626',
        offset: { lat: -0.0012, lon: 0.0016 },
        description: 'Municipal license plate scanner car currently patrolling here.',
      },
    ];

    return spotsRaw.map((s) => {
      const spotCoord: Coordinate = {
        latitude: dLat + s.offset.lat,
        longitude: dLon + s.offset.lon,
      };
      const distMeters = getDistanceInMeters(dLat, dLon, spotCoord.latitude, spotCoord.longitude);
      const walkMin = Math.max(1, Math.round(distMeters / 75));

      return {
        id: s.id,
        title: s.title,
        type: s.type,
        pricePerHour: s.pricePerHour,
        label: s.label,
        badge: s.badge,
        distanceToDestMeters: distMeters,
        walkingTimeMinutes: walkMin,
        venstertijden: s.venstertijden,
        coordinate: spotCoord,
        color: s.color,
        description: s.description,
      };
    });
  }, [scanCenter]);

  // Automatic Best Parking Selection Algorithm
  const bestParkingCandidate = useMemo(() => {
    const candidates = nearbySpots.filter(
      (s) => s.type !== 'hazard' && s.distanceToDestMeters <= 750
    );
    if (candidates.length === 0) return null;

    // 1. Free spots
    const freeSpots = candidates
      .filter((s) => s.type === 'free')
      .sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);
    if (freeSpots.length > 0) return freeSpots[0];

    // 2. Blue zones
    const blueSpots = candidates
      .filter((s) => s.type === 'blue')
      .sort((a, b) => a.distanceToDestMeters - b.distanceToDestMeters);
    if (blueSpots.length > 0) return blueSpots[0];

    // 3. Cheapest paid
    const paidSpots = [...candidates].sort((a, b) => {
      if (a.pricePerHour !== b.pricePerHour) return a.pricePerHour - b.pricePerHour;
      return a.distanceToDestMeters - b.distanceToDestMeters;
    });
    return paidSpots[0] || null;
  }, [nearbySpots]);

  useEffect(() => {
    if (destination && bestParkingCandidate && !isNavigating) {
      setOptimalSpot(bestParkingCandidate);
      setSelectedSpot(bestParkingCandidate);

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [userCoord, bestParkingCandidate.coordinate, destination.coordinate],
          {
            edgePadding: { top: 140, right: 60, bottom: 320, left: 60 },
            animated: true,
          }
        );
      }, 350);
    }
  }, [destination, bestParkingCandidate, isNavigating]);

  // Route Polylines
  const drivingPolyline = useMemo(() => {
    if (!destination || !optimalSpot) return [];
    return generateRouteWaypoints(userCoord, optimalSpot.coordinate, 10);
  }, [userCoord, destination, optimalSpot]);

  const walkingPolyline = useMemo(() => {
    if (!destination || !optimalSpot) return [];
    return generateRouteWaypoints(optimalSpot.coordinate, destination.coordinate, 5);
  }, [destination, optimalSpot]);

  // Turn-by-Turn Maneuvers along the in-app route
  const currentManeuver: TurnManeuver = useMemo(() => {
    if (navPhase === 'walking') {
      return {
        instruction: `Walk ${optimalSpot?.distanceToDestMeters || 180}m to ${destination?.name || 'Destination'}`,
        street: 'Pedestrian Walkway',
        distanceText: `${optimalSpot?.distanceToDestMeters || 180}m`,
        icon: '🚶',
      };
    }

    if (simStep === 0) {
      return {
        instruction: 'Head north on current street towards canal',
        street: 'Prins Hendrikkade',
        distanceText: '250m',
        icon: '⬆️',
      };
    } else if (simStep === 1) {
      return {
        instruction: 'Turn right at the intersection onto Singel',
        street: 'Singel Canal',
        distanceText: '120m',
        icon: '↱',
      };
    } else if (simStep === 2) {
      return {
        instruction: 'Continue straight towards Free Parking Zone',
        street: 'Singel Free Parking Strip',
        distanceText: '80m',
        icon: '⬆️',
      };
    } else {
      return {
        instruction: `Arrive at ${optimalSpot?.title || 'Free Parking Space'} on the right!`,
        street: 'Destination Parking Space',
        distanceText: 'Arrived',
        icon: '🅿️',
      };
    }
  }, [navPhase, simStep, optimalSpot, destination]);

  // 1. Center to your location button handler (Kept on screen)
  const handleRecenter = () => {
    const target = isNavigating ? vehiclePosition : userCoord;
    if (mapRef.current) {
      if (isNavigating) {
        mapRef.current.animateCamera(
          {
            center: target,
            pitch: 55,
            heading: 25,
            zoom: 18,
          },
          { duration: 600 }
        );
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: target.latitude,
            longitude: target.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          600
        );
      }
    }
  };

  // 2. Report Stuff (Moved inside separate menu)
  const handleReportHazard = () => {
    setIsToolsMenuOpen(false);
    Alert.alert(
      '⚠️ Report Parking Hazard',
      'Select a hazard to broadcast in real time to nearby drivers:',
      [
        {
          text: '👮 Parking Warden (Scan-auto / Handhaving)',
          onPress: () => Alert.alert('Reported', 'Hazard alert broadcasted to live feed.'),
        },
        {
          text: '🅿️ Full Blue Zone (No spots left)',
          onPress: () => Alert.alert('Reported', 'Blue zone marked 100% full.'),
        },
        {
          text: '🚧 Road Closure / Work',
          onPress: () => Alert.alert('Reported', 'Road blocked alert sent.'),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // 3. Third Button: Map Layers & Traffic (Moved inside separate menu)
  const handleToggleMapType = () => {
    setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const handleToggleTraffic = () => {
    setShowTraffic((prev) => !prev);
  };

  // Start In-App Navigation
  const handleStartInAppNavigation = () => {
    if (!destination || !optimalSpot) return;
    setIsNavigating(true);
    setNavPhase('driving');
    setSimStep(0);
    setIsToolsMenuOpen(false);

    mapRef.current?.animateCamera(
      {
        center: userCoord,
        pitch: 55,
        heading: 25,
        altitude: 400,
        zoom: 18,
      },
      { duration: 1000 }
    );

    if (simIntervalId) clearInterval(simIntervalId);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < drivingPolyline.length) {
        setSimStep(step);
        const nextPoint = drivingPolyline[step];
        setVehiclePosition(nextPoint);
        mapRef.current?.animateCamera(
          {
            center: nextPoint,
            pitch: 55,
            heading: (step * 20) % 360,
            zoom: 18.2,
          },
          { duration: 1400 }
        );
      } else {
        clearInterval(interval);
        setNavPhase('walking');
        setVehiclePosition(optimalSpot.coordinate);
        Alert.alert(
          '🅿️ Arrived at Free Parking!',
          `You have reached ${optimalSpot.title}.\nNow walking ${optimalSpot.distanceToDestMeters}m to ${destination.name}.`,
          [{ text: 'Start Walking Leg', onPress: () => {} }]
        );
      }
    }, 2500);

    setSimIntervalId(interval);
  };

  const handleStopNavigation = () => {
    if (simIntervalId) clearInterval(simIntervalId);
    setIsNavigating(false);
    setNavPhase('driving');
    setSimStep(0);
    setVehiclePosition(userCoord);

    mapRef.current?.animateCamera(
      {
        center: userCoord,
        pitch: 0,
        heading: 0,
        zoom: 15,
      },
      { duration: 800 }
    );
  };

  const destinationsCatalog: DestinationTarget[] = useMemo(
    () => [
      {
        name: 'Centraal Station',
        subtitle: 'Stationsplein 1 · Auto-routes to Singel free parking',
        coordinate: {
          latitude: userCoord.latitude + 0.0075,
          longitude: userCoord.longitude + 0.0035,
        },
      },
      {
        name: 'Dam Square & Royal Palace',
        subtitle: 'Amsterdam City Center · High tariff zone',
        coordinate: {
          latitude: userCoord.latitude - 0.0055,
          longitude: userCoord.longitude + 0.002,
        },
      },
      {
        name: 'Museumplein / Rijksmuseum',
        subtitle: 'Museumkwartier · Cheap parking zone',
        coordinate: {
          latitude: userCoord.latitude - 0.011,
          longitude: userCoord.longitude - 0.005,
        },
      },
    ],
    [userCoord]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ================= 1. MAP VIEW (Using StyleSheet.absoluteFill) ================= */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        mapType={mapType}
        showsTraffic={showTraffic}
        showsUserLocation={!isNavigating}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        showsBuildings={true}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}
        onPress={() => {
          setIsToolsMenuOpen(false);
          if (!isNavigating) {
            setSelectedSpot(null);
            setIsSearchFocused(false);
            Keyboard.dismiss();
          }
        }}
      >
        {/* 750m Scan Circle */}
        {!isNavigating && (
          <Circle
            center={scanCenter}
            radius={750}
            strokeWidth={2}
            strokeColor="rgba(59, 130, 246, 0.7)"
            fillColor="rgba(59, 130, 246, 0.06)"
          />
        )}

        {/* Polylines */}
        {destination && optimalSpot && (
          <>
            <Polyline
              coordinates={drivingPolyline}
              strokeColor="#2563eb"
              strokeWidth={isNavigating ? 7 : 5}
            />
            <Polyline
              coordinates={walkingPolyline}
              strokeColor="#10b981"
              strokeWidth={4}
              lineDashPattern={[6, 4]}
            />
          </>
        )}

        {/* Destination Target Marker */}
        {destination && (
          <Marker coordinate={destination.coordinate} title={destination.name}>
            <View style={styles.destinationMarker}>
              <Text style={styles.destMarkerIcon}>🏁</Text>
            </View>
          </Marker>
        )}

        {/* Optimal Free/Cheapest Parking Spot Marker */}
        {optimalSpot && (
          <Marker
            coordinate={optimalSpot.coordinate}
            title={optimalSpot.title}
            description={optimalSpot.badge}
            zIndex={30}
          >
            <View style={[styles.parkingSpotMarker, { backgroundColor: optimalSpot.color }]}>
              <Text style={styles.parkingSpotText}>{optimalSpot.label}</Text>
            </View>
            <View style={[styles.markerArrow, { borderTopColor: optimalSpot.color }]} />
          </Marker>
        )}

        {/* Active Vehicle Marker during In-App Navigation */}
        {isNavigating && (
          <Marker coordinate={vehiclePosition} zIndex={40} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.activeVehicleMarker}>
              <View style={styles.vehiclePuckGlow} />
              <View style={styles.vehiclePuck}>
                <Text style={styles.vehiclePuckIcon}>
                  {navPhase === 'driving' ? '🚗' : '🚶'}
                </Text>
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ================= 2. RIGHT-SIDE FLOATING CONTROLS (LESS CLUTTER) ================= */}
      <View
        pointerEvents="box-none"
        style={[
          styles.floatingActionColumn,
          { bottom: isNavigating ? 140 : destination ? 260 : 40 },
        ]}
      >
        {/* SEPARATE MENU POPOVER (Holds Report Hazard + Map Layers / Traffic) */}
        {isToolsMenuOpen && (
          <View style={styles.toolsMenuCard}>
            <View style={styles.toolsMenuHeader}>
              <Text style={styles.toolsMenuTitle}>MAP TOOLS</Text>
              <TouchableOpacity onPress={() => setIsToolsMenuOpen(false)}>
                <Text style={styles.toolsMenuClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Menu Item 1: Report Stuff */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleReportHazard}
              style={styles.toolsMenuItem}
            >
              <View style={[styles.menuItemIconBubble, { backgroundColor: '#fef2f2' }]}>
                <Text style={styles.menuItemIcon}>⚠️</Text>
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemLabel}>Report Hazard</Text>
                <Text style={styles.menuItemSub}>Wardens, full zones & work</Text>
              </View>
            </TouchableOpacity>

            {/* Menu Item 2: Satellite Layer Toggle */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleMapType}
              style={styles.toolsMenuItem}
            >
              <View style={[styles.menuItemIconBubble, { backgroundColor: '#f0fdf4' }]}>
                <Text style={styles.menuItemIcon}>
                  {mapType === 'satellite' ? '🗺️' : '🛰️'}
                </Text>
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemLabel}>
                  {mapType === 'satellite' ? 'Standard Map' : 'Satellite View'}
                </Text>
                <Text style={styles.menuItemSub}>
                  {mapType === 'satellite' ? 'Active: Satellite' : 'Active: Standard'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  mapType === 'satellite' ? styles.statusBadgeOn : styles.statusBadgeOff,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    mapType === 'satellite'
                      ? styles.statusBadgeTextOn
                      : styles.statusBadgeTextOff,
                  ]}
                >
                  {mapType === 'satellite' ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Menu Item 3: Live Traffic Toggle */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleToggleTraffic}
              style={styles.toolsMenuItem}
            >
              <View style={[styles.menuItemIconBubble, { backgroundColor: '#eff6ff' }]}>
                <Text style={styles.menuItemIcon}>🚦</Text>
              </View>
              <View style={styles.menuItemTextCol}>
                <Text style={styles.menuItemLabel}>Traffic Conditions</Text>
                <Text style={styles.menuItemSub}>Live municipal road feed</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  showTraffic ? styles.statusBadgeOn : styles.statusBadgeOff,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    showTraffic ? styles.statusBadgeTextOn : styles.statusBadgeTextOff,
                  ]}
                >
                  {showTraffic ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Separate Menu Trigger Button (Replaces cluttered buttons) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
          style={[
            styles.floatingCircleButton,
            isToolsMenuOpen && styles.floatingCircleButtonActive,
          ]}
          accessibilityLabel="Open Map Tools Menu"
        >
          <Text style={styles.floatingCircleIcon}>
            {isToolsMenuOpen ? '✕' : '🛠️'}
          </Text>
        </TouchableOpacity>

        {/* KEPT BUTTON: Center to Your Location Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleRecenter}
          style={styles.floatingCircleButton}
          accessibilityLabel="Center to Your Location"
        >
          <Text style={styles.floatingCircleIcon}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* ================= 3. ACTIVE IN-APP NAVIGATION HUD ================= */}
      {isNavigating ? (
        <SafeAreaView pointerEvents="box-none" style={styles.navOverlayWrapper}>
          {/* Top Turn-By-Turn Navigation Banner */}
          <View style={styles.tbtHeaderCard}>
            <View style={styles.tbtLeftIconBubble}>
              <Text style={styles.tbtManeuverIcon}>{currentManeuver.icon}</Text>
            </View>
            <View style={styles.tbtInstructionCol}>
              <Text style={styles.tbtDistance}>{currentManeuver.distanceText}</Text>
              <Text style={styles.tbtInstruction} numberOfLines={2}>
                {currentManeuver.instruction}
              </Text>
              <Text style={styles.tbtStreet}>{currentManeuver.street}</Text>
            </View>
          </View>

          {/* Speedometer & Hazard Radar (Left Side) */}
          <View style={styles.speedRadarContainer}>
            <View style={styles.speedGaugeBox}>
              <Text style={styles.speedValue}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>
            <View style={styles.speedLimitSign}>
              <Text style={styles.speedLimitText}>50</Text>
            </View>
            <View style={styles.radarPill}>
              <Text style={styles.radarIcon}>🛡️</Text>
              <Text style={styles.radarText}>Flitser Radar Active</Text>
            </View>
          </View>

          {/* Bottom In-App Trip HUD Bar */}
          <View style={styles.navBottomHUD}>
            <View style={styles.navStatsRow}>
              <div>
                <Text style={styles.navEtaText}>
                  {navPhase === 'driving' ? '6 min' : '2 min'}
                </Text>
                <Text style={styles.navSubText}>
                  {navPhase === 'driving'
                    ? `To ${optimalSpot?.title || 'Free Parking'}`
                    : `To ${destination?.name || 'Destination'}`}
                </Text>
              </div>

              <View style={styles.phaseIndicatorBadge}>
                <Text style={styles.phaseIndicatorText}>
                  {navPhase === 'driving' ? '🚗 DRIVING TO SPOT' : '🚶 WALKING LEG'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setIsVoiceMuted(!isVoiceMuted)}
                style={styles.voiceButton}
              >
                <Text style={styles.voiceIcon}>{isVoiceMuted ? '🔇' : '🔊'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleStopNavigation}
              style={styles.endNavigationBtn}
            >
              <Text style={styles.endNavigationText}>✕ End Route</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      ) : (
        /* ================= 4. OVERVIEW / DESTINATION SEARCH MODE ================= */
        <>
          {/* Top Floating Search Bar */}
          <SafeAreaView pointerEvents="box-none" style={styles.topOverlayArea}>
            <View style={styles.searchCard}>
              <View style={styles.searchRow}>
                <View style={styles.searchIconBubble}>
                  <Text style={styles.searchIconText}>{destination ? '🏁' : '🔍'}</Text>
                </View>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Enter destination to scan free parking..."
                  placeholderTextColor="#94a3b8"
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {destination && (
                  <TouchableOpacity
                    onPress={() => {
                      setDestination(null);
                      setOptimalSpot(null);
                      setSearchQuery('');
                    }}
                    style={styles.clearBtn}
                  >
                    <Text style={styles.clearBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Suggestions Card */}
            {isSearchFocused && (
              <View style={styles.suggestionsCard}>
                <Text style={styles.suggestionsHeader}>SET DESTINATION</Text>
                {destinationsCatalog.map((dest) => (
                  <TouchableOpacity
                    key={dest.name}
                    onPress={() => {
                      setSearchQuery(dest.name);
                      setDestination(dest);
                      setIsSearchFocused(false);
                      Keyboard.dismiss();
                    }}
                    style={styles.suggestionRow}
                  >
                    <Text style={styles.suggestionPin}>📍</Text>
                    <View style={styles.suggestionTextCol}>
                      <Text style={styles.suggestionTitle}>{dest.name}</Text>
                      <Text style={styles.suggestionSubtitle}>{dest.subtitle}</Text>
                    </View>
                    <View style={styles.autoScanPill}>
                      <Text style={styles.autoScanText}>Auto-Scan</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </SafeAreaView>

          {/* Bottom Route Summary Drawer */}
          {destination && optimalSpot && (
            <SafeAreaView pointerEvents="box-none" style={styles.bottomDrawerArea}>
              <View style={styles.drawerCard}>
                <View style={styles.cardHandle} />

                {/* Match Banner */}
                <View style={styles.freeMatchBanner}>
                  <Text style={styles.freeMatchIcon}>✨</Text>
                  <Text style={styles.freeMatchTitle}>
                    {optimalSpot.pricePerHour === 0
                      ? `Found 100% Free Parking ${optimalSpot.distanceToDestMeters}m from destination!`
                      : `Cheapest Parking: ${optimalSpot.label} (${optimalSpot.distanceToDestMeters}m walk)`}
                  </Text>
                </View>

                {/* 2-Leg Journey Breakdown */}
                <View style={styles.journeyLegsRow}>
                  <View style={styles.journeyLeg}>
                    <Text style={styles.journeyLegIcon}>🚗</Text>
                    <Text style={styles.journeyLegTime}>8 min</Text>
                    <Text style={styles.journeyLegDesc}>Drive to Spot</Text>
                  </View>
                  <Text style={styles.arrowIcon}>➔</Text>
                  <View style={styles.journeyLeg}>
                    <Text style={styles.journeyLegIcon}>🅿️</Text>
                    <Text style={[styles.journeyLegTime, { color: optimalSpot.color }]}>
                      {optimalSpot.label}
                    </Text>
                    <Text style={styles.journeyLegDesc}>{optimalSpot.badge}</Text>
                  </View>
                  <Text style={styles.arrowIcon}>➔</Text>
                  <View style={styles.journeyLeg}>
                    <Text style={styles.journeyLegIcon}>🚶</Text>
                    <Text style={styles.journeyLegTime}>{optimalSpot.walkingTimeMinutes} min</Text>
                    <Text style={styles.journeyLegDesc}>Walk ({optimalSpot.distanceToDestMeters}m)</Text>
                  </View>
                </View>

                {/* In-App Start Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleStartInAppNavigation}
                  style={styles.startInAppNavBtn}
                >
                  <Text style={styles.startInAppNavText}>
                    🧭 Start In-App Turn-By-Turn Navigation
                  </Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Floating Action Column on Right Side (Clutter-Free)
  floatingActionColumn: {
    position: 'absolute',
    right: 14,
    zIndex: 35,
    alignItems: 'flex-end',
    gap: 12,
  },
  floatingCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  floatingCircleButtonActive: {
    backgroundColor: '#1e293b',
    borderColor: '#0f172a',
  },
  floatingCircleIcon: {
    fontSize: 20,
  },

  // Separate Tools Menu Popover
  toolsMenuCard: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  toolsMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 6,
  },
  toolsMenuTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
  },
  toolsMenuClose: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  toolsMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  menuItemIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemTextCol: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  menuItemSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeOn: {
    backgroundColor: '#dbeafe',
  },
  statusBadgeOff: {
    backgroundColor: '#f1f5f9',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusBadgeTextOn: {
    color: '#1d4ed8',
  },
  statusBadgeTextOff: {
    color: '#64748b',
  },

  // Turn-by-Turn Navigation Header
  navOverlayWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    zIndex: 40,
  },
  tbtHeaderCard: {
    marginHorizontal: 12,
    marginTop: Platform.OS === 'android' ? 36 : 10,
    backgroundColor: '#0f172a',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tbtLeftIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tbtManeuverIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  tbtInstructionCol: {
    flex: 1,
  },
  tbtDistance: {
    fontSize: 20,
    fontWeight: '900',
    color: '#38bdf8',
  },
  tbtInstruction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 1,
  },
  tbtStreet: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },

  // Speedometer & Radar Gauge
  speedRadarContainer: {
    position: 'absolute',
    left: 14,
    bottom: 140,
    zIndex: 30,
    alignItems: 'flex-start',
  },
  speedGaugeBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f172a',
    borderWidth: 3,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  speedValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 22,
  },
  speedUnit: {
    fontSize: 8,
    fontWeight: '800',
    color: '#94a3b8',
  },
  speedLimitSign: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginLeft: 12,
  },
  speedLimitText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  radarIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  radarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },

  // Bottom In-App HUD Bar
  navBottomHUD: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 12,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  navStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navEtaText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  navSubText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  phaseIndicatorBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  phaseIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIcon: {
    fontSize: 16,
  },
  endNavigationBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endNavigationText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },

  // Vehicle Cursor Marker
  activeVehicleMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehiclePuckGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.3)',
  },
  vehiclePuck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  vehiclePuckIcon: {
    fontSize: 16,
  },

  // Destination & Parking Markers
  destinationMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destMarkerIcon: {
    fontSize: 16,
  },
  parkingSpotMarker: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  parkingSpotText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  markerArrow: {
    width: 0,
    height: 0,
    alignSelf: 'center',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },

  // Overview Search Bar
  topOverlayArea: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 10,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  searchCard: {
    marginHorizontal: 14,
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  searchIconText: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },

  // Suggestions Card
  suggestionsCard: {
    marginHorizontal: 14,
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  suggestionsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 6,
    marginLeft: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionPin: {
    fontSize: 16,
    marginRight: 8,
  },
  suggestionTextCol: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  suggestionSubtitle: {
    fontSize: 10,
    color: '#64748b',
  },
  autoScanPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  autoScanText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
  },

  // Bottom Route Drawer
  bottomDrawerArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  drawerCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
  },
  cardHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  freeMatchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 8,
  },
  freeMatchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  freeMatchTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e40af',
    flex: 1,
  },
  journeyLegsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  journeyLeg: {
    alignItems: 'center',
  },
  journeyLegIcon: {
    fontSize: 14,
  },
  journeyLegTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  journeyLegDesc: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 11,
    color: '#94a3b8',
  },
  startInAppNavBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startInAppNavText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
