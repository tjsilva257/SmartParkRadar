import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  Keyboard,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Region, MapType } from 'react-native-maps';
import * as Location from 'expo-location';

import { Coordinate, DestinationTarget, ParkingSpot, TurnManeuver, NavPhase } from '../src/types/parking';
import { getDistanceInMeters, generateRouteWaypoints } from '../src/utils/distance';
import { scanNearbyParkingSpots } from '../src/services/parkingScanner';
import { SearchBar } from '../src/components/SearchBar';
import { MapToolsMenu } from '../src/components/MapToolsMenu';
import { RouteDrawer } from '../src/components/RouteDrawer';
import { NavigationHUD } from '../src/components/NavigationHUD';

const DEFAULT_COORDS: Coordinate = {
  latitude: 52.3676,
  longitude: 4.9041,
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
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

  // In-App Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [navPhase, setNavPhase] = useState<NavPhase>('driving');
  const [currentSpeed, setCurrentSpeed] = useState(48); // km/h
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simIntervalId, setSimIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

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
    setVehiclePosition(userCoord);
  }, [userCoord.latitude, userCoord.longitude]);

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

  // Run the 750m spatial parking scanner & priority algorithm
  const { spots: nearbySpots, optimalSpot: scannedOptimal } = useMemo(() => {
    return scanNearbyParkingSpots(scanCenter);
  }, [scanCenter]);

  // Auto-select optimal spot when destination changes
  useEffect(() => {
    if (destination && scannedOptimal && !isNavigating) {
      setOptimalSpot(scannedOptimal);
      setSelectedSpot(scannedOptimal);

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [userCoord, scannedOptimal.coordinate, destination.coordinate],
          {
            edgePadding: { top: 140, right: 60, bottom: 320, left: 60 },
            animated: true,
          }
        );
      }, 350);
    }
  }, [destination, scannedOptimal, isNavigating, userCoord]);

  // Calculate Route Polylines
  const drivingPolyline = useMemo(() => {
    if (!destination || !optimalSpot) return [];
    return generateRouteWaypoints(userCoord, optimalSpot.coordinate, 10);
  }, [userCoord, destination, optimalSpot]);

  const walkingPolyline = useMemo(() => {
    if (!destination || !optimalSpot) return [];
    return generateRouteWaypoints(optimalSpot.coordinate, destination.coordinate, 5);
  }, [destination, optimalSpot]);

  // Driving leg estimates
  const drivingStats = useMemo(() => {
    if (!optimalSpot) return { km: '0 km', min: 0 };
    const meters = getDistanceInMeters(
      userCoord.latitude,
      userCoord.longitude,
      optimalSpot.coordinate.latitude,
      optimalSpot.coordinate.longitude
    );
    const km = (meters / 1000).toFixed(1);
    const min = Math.max(2, Math.round(meters / 450));
    return { km: `${km} km`, min };
  }, [userCoord, optimalSpot]);

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

  // Center to user/vehicle location
  const handleRecenter = () => {
    const target = isNavigating ? vehiclePosition : userCoord;
    if (mapRef.current) {
      if (isNavigating) {
        mapRef.current.animateCamera(
          { center: target, pitch: 55, heading: 25, zoom: 18 },
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

  // Start In-App Turn-By-Turn Navigation
  const handleStartInAppNavigation = () => {
    if (!destination || !optimalSpot) return;
    setIsNavigating(true);
    setNavPhase('driving');
    setSimStep(0);

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
          `You have reached ${optimalSpot.title}.\nNow walking ${optimalSpot.distanceToDestMeters}m to ${destination.name}.`
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
      { center: userCoord, pitch: 0, heading: 0, zoom: 15 },
      { duration: 800 }
    );
  };

  const handleClearDestination = () => {
    setDestination(null);
    setOptimalSpot(null);
    setSelectedSpot(null);
    setIsNavigating(false);
    if (simIntervalId) clearInterval(simIntervalId);

    mapRef.current?.animateToRegion(
      {
        latitude: userCoord.latitude,
        longitude: userCoord.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      600
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* 1. MAP VIEW (Always using StyleSheet.absoluteFill) */}
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

      {/* 2. TOP SEARCH BAR (Real geocoding search & suggestions) */}
      {!isNavigating && (
        <SearchBar
          currentDestination={destination}
          userLocation={userCoord}
          onSelectDestination={setDestination}
          onClearDestination={handleClearDestination}
        />
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
          drivingMinutes={drivingStats.min}
          drivingKm={drivingStats.km}
          onStartNavigation={handleStartInAppNavigation}
          onCancel={handleClearDestination}
        />
      )}

      {/* 5. IN-APP TURN-BY-TURN NAVIGATION HUD */}
      {isNavigating && destination && optimalSpot && (
        <NavigationHUD
          currentManeuver={currentManeuver}
          currentSpeed={currentSpeed}
          navPhase={navPhase}
          optimalSpot={optimalSpot}
          destination={destination}
          isVoiceMuted={isVoiceMuted}
          onToggleVoice={() => setIsVoiceMuted(!isVoiceMuted)}
          onEndNavigation={handleStopNavigation}
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
});

