import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Region, MapType } from 'react-native-maps';
import * as Location from 'expo-location';

import { Coordinate, DestinationTarget, ParkingSpot, TurnManeuver, NavPhase, DriveRouteOption, CameraWarning, SpeedAlert, SpeedCamera } from '../src/types/parking';
import { scanNearbyParkingSpots } from '../src/services/parkingScanner';
import { fetchMultiDriveRoutes, fetchWalkingRoute } from '../src/services/routingService';
import { SPEED_CAMERAS, getUpcomingCameraWarning, calculateSpeedFine } from '../src/services/cameraRadarService';
import { SearchBar } from '../src/components/SearchBar';
import { MapToolsMenu } from '../src/components/MapToolsMenu';
import { RouteDrawer } from '../src/components/RouteDrawer';
import { NavigationHUD } from '../src/components/NavigationHUD';

const DEFAULT_COORDS: Coordinate = {
  latitude: 52.3676,
  longitude: 4.9041,
};

function calculateBearing(start: Coordinate, end: Coordinate): number {
  const startLat = (start.latitude * Math.PI) / 180;
  const startLng = (start.longitude * Math.PI) / 180;
  const endLat = (end.latitude * Math.PI) / 180;
  const endLng = (end.longitude * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const hasFittedRouteForDest = useRef<string | null>(null);
  const userCoordRef = useRef<Coordinate>(DEFAULT_COORDS);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>({
    ...DEFAULT_COORDS,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  });

  // Search & Destination State
  const [destination, setDestination] = useState<DestinationTarget | null>(null);
  const [optimalSpot, setOptimalSpot] = useState<ParkingSpot | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);

  // Real Road-Following Route State (via OSRM with Live Traffic alternatives)
  const [availableDriveRoutes, setAvailableDriveRoutes] = useState<DriveRouteOption[]>([]);
  const [selectedDriveRoute, setSelectedDriveRoute] = useState<DriveRouteOption | null>(null);
  const [drivingPolyline, setDrivingPolyline] = useState<Coordinate[]>([]);
  const [walkingPolyline, setWalkingPolyline] = useState<Coordinate[]>([]);
  const [drivingStats, setDrivingStats] = useState({ km: '0 km', min: 0 });
  const [roadManeuvers, setRoadManeuvers] = useState<TurnManeuver[]>([]);

  // In-App Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPhase, setNavPhase] = useState<NavPhase>('driving');
  const [currentSpeed, setCurrentSpeed] = useState(48); // km/h
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simIntervalId, setSimIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  // Flitsmeister Radar & Speed Warning State
  const [speedLimit, setSpeedLimit] = useState(50); // km/h (dynamic according to road or speed camera)
  const [cameraWarning, setCameraWarning] = useState<CameraWarning | null>(null);

  // Map Controls State
  const [mapType, setMapType] = useState<MapType>('standard');
  const [showTraffic, setShowTraffic] = useState(true);

  const userCoord: Coordinate = useMemo(() => {
    if (location) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    }
    return DEFAULT_COORDS;
  }, [location]);

  const [vehiclePosition, setVehiclePosition] = useState<Coordinate>(userCoord);

  useEffect(() => {
    userCoordRef.current = userCoord;
    if (!isNavigating) {
      setVehiclePosition(userCoord);
    }
  }, [userCoord.latitude, userCoord.longitude, isNavigating]);

  // Request foreground location permissions & start watch subscription
  useEffect(() => {
    let isMounted = true;
    let locSubscription: Location.LocationSubscription | null = null;

    async function initLocation() {
      try {
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
        // Fallback to default
      }
    }

    initLocation();

    return () => {
      isMounted = false;
      locSubscription?.remove();
      if (simIntervalId) clearInterval(simIntervalId);
    };
  }, []);

  // 750m Scan Center: Focuses on destination if selected, or user location
  const scanCenter: Coordinate = destination ? destination.coordinate : userCoord;

  // Run the 750m spatial parking scanner & priority algorithm around the destination
  const { spots: nearbySpots, optimalSpot: scannedOptimal } = useMemo(() => {
    return scanNearbyParkingSpots(scanCenter);
  }, [scanCenter]);

  // Auto-select optimal spot when destination changes
  useEffect(() => {
    if (destination && scannedOptimal && !isNavigating) {
      setOptimalSpot(scannedOptimal);
      setSelectedSpot(scannedOptimal);
    }
  }, [destination, scannedOptimal, isNavigating]);

  // Fetch REAL ROAD-FOLLOWING ROUTES (via OSRM) with Live Traffic Alternatives
  useEffect(() => {
    let isMounted = true;

    async function loadRoadRoute() {
      if (!destination || !optimalSpot) {
        setAvailableDriveRoutes([]);
        setSelectedDriveRoute(null);
        setDrivingPolyline([]);
        setWalkingPolyline([]);
        setRoadManeuvers([]);
        return;
      }

      try {
        const startCoord = userCoordRef.current || userCoord;
        const [driveRoutes, walkCoords] = await Promise.all([
          fetchMultiDriveRoutes(startCoord, optimalSpot.coordinate),
          fetchWalkingRoute(optimalSpot.coordinate, destination.coordinate),
        ]);

        if (isMounted) {
          setAvailableDriveRoutes(driveRoutes);
          // Route #0 is always the fastest, most efficient route based on live traffic
          const fastestRoute = driveRoutes[0] || null;
          setSelectedDriveRoute(fastestRoute);

          if (fastestRoute) {
            setDrivingPolyline(fastestRoute.coordinates);
            setDrivingStats({
              km: fastestRoute.distanceKm,
              min: fastestRoute.durationMinutes,
            });
            setRoadManeuvers(fastestRoute.maneuvers);
          }
          setWalkingPolyline(walkCoords);

          // Fit camera smoothly over the full real road route ONCE per destination selection
          const destKey = `${destination.name}-${optimalSpot.id}`;
          if (
            fastestRoute &&
            fastestRoute.coordinates.length > 0 &&
            !isNavigating &&
            hasFittedRouteForDest.current !== destKey
          ) {
            hasFittedRouteForDest.current = destKey;
            const sampleStep = Math.max(1, Math.floor(fastestRoute.coordinates.length / 10));
            const keyWaypoints = fastestRoute.coordinates.filter((_, idx) => idx % sampleStep === 0);
            keyWaypoints.push(destination.coordinate);

            setTimeout(() => {
              mapRef.current?.fitToCoordinates(keyWaypoints, {
                edgePadding: { top: 160, right: 70, bottom: 330, left: 70 },
                animated: true,
              });
            }, 300);
          }
        }
      } catch (err) {
        // Handled inside routing service fallback
      }
    }

    loadRoadRoute();

    return () => {
      isMounted = false;
    };
  }, [destination?.name, optimalSpot?.id, isNavigating]);

  // Handle switching between alternative routes
  const handleSelectDriveRoute = (route: DriveRouteOption) => {
    setSelectedDriveRoute(route);
    setDrivingPolyline(route.coordinates);
    setDrivingStats({
      km: route.distanceKm,
      min: route.durationMinutes,
    });
    setRoadManeuvers(route.maneuvers);
  };

  // Turn-by-Turn Maneuvers along the real in-app road route
  const currentManeuver: TurnManeuver = useMemo(() => {
    if (navPhase === 'walking') {
      return {
        instruction: `Walk ${optimalSpot?.distanceToDestMeters || 180}m to ${destination?.name || 'Destination'}`,
        street: 'Pedestrian Walkway',
        distanceText: `${optimalSpot?.distanceToDestMeters || 180}m`,
        icon: '🚶',
      };
    }

    if (roadManeuvers.length > 0) {
      const index = Math.min(simStep, roadManeuvers.length - 1);
      return roadManeuvers[index];
    }

    return {
      instruction: `Follow highway to ${optimalSpot?.title || 'Parking Space'}`,
      street: 'Highway / Main route',
      distanceText: drivingStats.km,
      icon: '🚗',
    };
  }, [navPhase, simStep, roadManeuvers, optimalSpot, destination, drivingStats]);

  // Real-time CJIB Traffic Fine Calculation
  const speedAlert: SpeedAlert = useMemo(() => {
    return calculateSpeedFine(currentSpeed, speedLimit);
  }, [currentSpeed, speedLimit]);

  // Real-time Camera Radar Scanner & Speed Limit Adaptation
  useEffect(() => {
    const alert = getUpcomingCameraWarning(vehiclePosition, 1500);
    setCameraWarning(alert);

    if (alert) {
      setSpeedLimit(alert.camera.speedLimit);
    } else if (isNavigating) {
      const isHighway =
        currentManeuver.street.toLowerCase().includes('a') ||
        currentManeuver.instruction.toLowerCase().includes('highway') ||
        currentManeuver.instruction.toLowerCase().includes('snelweg');
      setSpeedLimit(isHighway ? 100 : 50);
    }
  }, [vehiclePosition.latitude, vehiclePosition.longitude, isNavigating, currentManeuver.street, currentManeuver.instruction]);

  // Interactive Speed Cycle Tester (Tap speedometer to test fine risk!)
  const handleCycleSpeedTest = () => {
    setCurrentSpeed((prev) => {
      if (prev <= speedLimit) {
        return speedLimit + 6; // Minor overspeed (+6 km/h warning)
      } else if (prev < speedLimit + 14) {
        return speedLimit + 18; // Fine risk! (+18 km/h, €210 boete)
      } else if (prev < speedLimit + 25) {
        return speedLimit + 32; // Critical fine risk! (+32 km/h, €540 boete)
      }
      return Math.max(30, speedLimit - 5); // Return to safe speed
    });
  };

  // Center to user/vehicle location
  const handleRecenter = () => {
    const target = isNavigating ? vehiclePosition : userCoord;
    if (mapRef.current) {
      if (isNavigating) {
        mapRef.current.animateCamera(
          { center: target, pitch: 60, heading: 0, altitude: 300, zoom: 18.5 },
          { duration: 600 }
        );
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: target.latitude,
            longitude: target.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          600
        );
      }
    }
  };

  // Start In-App Turn-By-Turn Navigation (Advancing along real highway & road coordinates)
  const handleStartInAppNavigation = () => {
    if (!destination || !optimalSpot || drivingPolyline.length === 0) return;
    setIsNavigating(true);
    setNavPhase('driving');
    setSimStep(0);

    const initialPoint = drivingPolyline[0] || userCoord;
    const secondPoint = drivingPolyline[1] || optimalSpot.coordinate;
    const initialBearing = calculateBearing(initialPoint, secondPoint);

    // Initial 3D driver cockpit view
    mapRef.current?.animateCamera(
      {
        center: initialPoint,
        pitch: 60,
        heading: initialBearing,
        altitude: 300,
        zoom: 18.5,
      },
      { duration: 800 }
    );

    if (simIntervalId) clearInterval(simIntervalId);

    // Calculate jump step based on route length so simulation progresses smoothly
    const totalPoints = drivingPolyline.length;
    const stride = Math.max(1, Math.floor(totalPoints / 25));
    let currentIdx = 0;

    const interval = setInterval(() => {
      const prevIdx = currentIdx;
      currentIdx += stride;

      if (currentIdx < totalPoints) {
        setSimStep((prev) => prev + 1);
        const prevPoint = drivingPolyline[prevIdx];
        const nextPoint = drivingPolyline[currentIdx];
        const bearing = calculateBearing(prevPoint, nextPoint);

        setVehiclePosition(nextPoint);

        // Check for upcoming camera near nextPoint
        const camAlert = getUpcomingCameraWarning(nextPoint, 1500);
        setCameraWarning(camAlert);
        if (camAlert) {
          setSpeedLimit(camAlert.camera.speedLimit);
          // When approaching camera, simulate brief acceleration to demonstrate fine alert
          if (camAlert.distanceMeters <= 550 && camAlert.distanceMeters >= 180) {
            setCurrentSpeed(camAlert.camera.speedLimit + 18);
          } else {
            setCurrentSpeed(camAlert.camera.speedLimit);
          }
        }

        // Keep camera locked in 3D driver cockpit view - altitude: 300 ensures iOS never zooms out!
        mapRef.current?.animateCamera(
          {
            center: nextPoint,
            pitch: 60,
            heading: bearing,
            altitude: 300,
            zoom: 18.5,
          },
          { duration: 1200 }
        );
      } else {
        clearInterval(interval);
        setNavPhase('walking');
        setVehiclePosition(optimalSpot.coordinate);
        mapRef.current?.animateCamera(
          {
            center: optimalSpot.coordinate,
            pitch: 45,
            heading: 0,
            altitude: 250,
            zoom: 18,
          },
          { duration: 800 }
        );
        Alert.alert(
          '🅿️ Arrived at Free Parking!',
          `You have reached ${optimalSpot.title}.\nNow walking ${optimalSpot.distanceToDestMeters}m to ${destination.name}.`
        );
      }
    }, 2000);

    setSimIntervalId(interval);
  };

  const handleStopNavigation = () => {
    if (simIntervalId) clearInterval(simIntervalId);
    setIsNavigating(false);
    setNavPhase('driving');
    setSimStep(0);
    setVehiclePosition(userCoord);

    mapRef.current?.animateCamera(
      { center: userCoord, pitch: 0, heading: 0, altitude: 1200, zoom: 16 },
      { duration: 800 }
    );
  };

  const handleClearDestination = () => {
    hasFittedRouteForDest.current = null;
    setDestination(null);
    setOptimalSpot(null);
    setSelectedSpot(null);
    setAvailableDriveRoutes([]);
    setSelectedDriveRoute(null);
    setDrivingPolyline([]);
    setWalkingPolyline([]);
    setIsNavigating(false);
    if (simIntervalId) clearInterval(simIntervalId);

    mapRef.current?.animateCamera(
      { center: userCoord, pitch: 0, heading: 0, altitude: 1200, zoom: 15 },
      { duration: 600 }
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* 1. MAP VIEW (Using StyleSheet.absoluteFill) */}
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
          if (!isNavigating) {
            setSelectedSpot(null);
            Keyboard.dismiss();
          }
        }}
      >
        {/* 750m Scan Circle around Destination */}
        {!isNavigating && (
          <Circle
            center={scanCenter}
            radius={750}
            strokeWidth={2}
            strokeColor="rgba(59, 130, 246, 0.7)"
            fillColor="rgba(59, 130, 246, 0.06)"
          />
        )}

        {/* Real Road-Following Polylines with Live Traffic alternatives */}
        {destination && optimalSpot && (
          <>
            {/* Alternative Driving Corridors (Muted Slate with dash) */}
            {!isNavigating &&
              availableDriveRoutes
                .filter((r) => r.id !== selectedDriveRoute?.id)
                .map((altRoute) => (
                  <Polyline
                    key={altRoute.id}
                    coordinates={altRoute.coordinates}
                    strokeColor="#94a3b8"
                    strokeWidth={4}
                    lineDashPattern={[6, 3]}
                    zIndex={10}
                  />
                ))}

            {/* Selected Most Efficient Driving Route (Vibrant Royal Blue) */}
            <Polyline
              coordinates={drivingPolyline}
              strokeColor="#2563eb"
              strokeWidth={isNavigating ? 7 : 6}
              zIndex={20}
            />

            {/* Walking Route: Sidewalks & Pedestrian Paths to Destination */}
            <Polyline
              coordinates={walkingPolyline}
              strokeColor="#10b981"
              strokeWidth={4}
              lineDashPattern={[6, 4]}
              zIndex={25}
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

        {/* Real Speed Cameras & Flitsmeister Radar Traps */}
        {SPEED_CAMERAS.map((cam) => {
          const isTraject = cam.type === 'traject';
          const isMobile = cam.type === 'mobile';
          const isRedLight = cam.type === 'red_light';
          return (
            <Marker
              key={cam.id}
              coordinate={cam.coordinate}
              title={cam.name}
              description={`${cam.road} • Max ${cam.speedLimit} km/h`}
              zIndex={28}
              onPress={() => {
                Alert.alert(
                  `📸 ${cam.name}`,
                  `${cam.road}\n\nType: ${
                    isTraject
                      ? 'Trajectcontrole'
                      : isMobile
                      ? 'Mobiele Controle'
                      : isRedLight
                      ? 'Roodlicht & Flitser'
                      : 'Vaste Flitspaal'
                  }\nSnelheidslimiet: ${cam.speedLimit} km/h\n\n${cam.description}`
                );
              }}
            >
              <View style={[styles.cameraMarkerBubble, isMobile && styles.cameraMarkerMobile]}>
                <Text style={styles.cameraMarkerEmoji}>
                  {isTraject ? '⏱️' : isMobile ? '🚓' : isRedLight ? '🚦' : '📸'}
                </Text>
                <View style={styles.cameraMarkerSign}>
                  <Text style={styles.cameraMarkerSignText}>{cam.speedLimit}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* 2. TOP SEARCH BAR (Real geocoding search & suggestions) */}
      {!isNavigating && (
        <SearchBar
          currentDestination={destination}
          userLocation={userCoord}
          onSelectDestination={setDestination}
          onClearDestination={handleClearDestination}
        />
      )}

      {/* 2B. FLOATING RADAR WARNING (When driving in passive radar mode) */}
      {!isNavigating && cameraWarning && (
        <View style={[styles.floatingRadarPill, cameraWarning.isUrgent && styles.floatingRadarPillUrgent]}>
          <Text style={styles.floatingRadarEmoji}>
            {cameraWarning.camera.type === 'traject' ? '⏱️' : cameraWarning.camera.type === 'mobile' ? '🚓' : '📸'}
          </Text>
          <Text style={styles.floatingRadarText} numberOfLines={1}>
            {cameraWarning.camera.name} ({cameraWarning.distanceMeters}m) • Max {cameraWarning.camera.speedLimit} km/h
          </Text>
        </View>
      )}

      {/* 3. CLUTTER-FREE MAP CONTROLS (Standalone Re-center + Separate Tools Menu) */}
      <MapToolsMenu
        mapType={mapType}
        showTraffic={showTraffic}
        onToggleMapType={() => setMapType((p) => (p === 'standard' ? 'satellite' : 'standard'))}
        onToggleTraffic={() => setShowTraffic((p) => !p)}
        onRecenter={handleRecenter}
        bottomOffset={isNavigating ? 140 : destination ? 260 : 40}
      />

      {/* 4. OVERVIEW ROUTE DRAWER (When Destination is Set) */}
      {!isNavigating && destination && optimalSpot && (
        <RouteDrawer
          destination={destination}
          optimalSpot={optimalSpot}
          selectedRoute={selectedDriveRoute}
          availableRoutes={availableDriveRoutes}
          onSelectRoute={handleSelectDriveRoute}
          onStartNavigation={handleStartInAppNavigation}
          onCancel={handleClearDestination}
        />
      )}

      {/* 5. IN-APP TURN-BY-TURN NAVIGATION HUD (With Flitsers & Fine Risk Warnings) */}
      {isNavigating && destination && optimalSpot && (
        <NavigationHUD
          currentManeuver={currentManeuver}
          currentSpeed={currentSpeed}
          speedLimit={speedLimit}
          speedAlert={speedAlert}
          cameraWarning={cameraWarning}
          drivingMinutes={drivingStats.min}
          navPhase={navPhase}
          optimalSpot={optimalSpot}
          destination={destination}
          isVoiceMuted={isVoiceMuted}
          onToggleVoice={() => setIsVoiceMuted(!isVoiceMuted)}
          onEndNavigation={handleStopNavigation}
          onCycleSpeedTest={handleCycleSpeedTest}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
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
  cameraMarkerBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 14,
    paddingHorizontal: 6,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  cameraMarkerMobile: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
  },
  cameraMarkerEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  cameraMarkerSign: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraMarkerSignText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000000',
  },
  floatingRadarPill: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 116 : 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 35,
    maxWidth: '90%',
  },
  floatingRadarPillUrgent: {
    backgroundColor: 'rgba(127, 29, 29, 0.95)',
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  floatingRadarEmoji: {
    fontSize: 15,
    marginRight: 6,
  },
  floatingRadarText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
});
