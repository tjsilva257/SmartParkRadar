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
import MapView, { Marker, Circle, Region, MapType } from 'react-native-maps';
import * as Location from 'expo-location';

interface ParkingSpot {
  id: string;
  title: string;
  type: 'free' | 'blue' | 'cheap' | 'paid' | 'hazard';
  pricePerHour: number;
  label: string;
  badge: string;
  walkingTime: string;
  distance: string;
  venstertijden: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  color: string;
  description: string;
}

interface SearchDestination {
  id: string;
  name: string;
  subtitle: string;
  distance: string;
  coordinate: {
    latitude: number;
    longitude: number;
  };
}

// Default Fallback (Central Amsterdam coordinates)
const DEFAULT_COORDS = {
  latitude: 52.3676,
  longitude: 4.9041,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

export default function MapScreen() {
  const mapRef = useRef<MapView | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_COORDS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Filter State (Google Maps / Apple Maps style)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'free' | 'cheap' | 'hazard'>('all');
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);

  // Map settings
  const [mapType, setMapType] = useState<MapType>('standard');
  const [showTraffic, setShowTraffic] = useState(false);

  // 1. Location Permissions & Initial Tracking
  useEffect(() => {
    let isMounted = true;

    async function initializeLocation() {
      try {
        setIsLoading(true);
        setErrorMsg(null);

        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED) {
          if (isMounted) {
            setErrorMsg(
              'Location permission denied. Map is running in manual exploration mode.'
            );
            setIsLoading(false);
          }
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          setLocation(currentLocation);

          const newRegion: Region = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          };

          setRegion(newRegion);
          setIsLoading(false);

          // Animate smoothly to current position
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 800);
          }
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg('Unable to retrieve GPS location. Showing default area.');
          setIsLoading(false);
        }
      }
    }

    initializeLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const centerCoords = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }
    : {
        latitude: DEFAULT_COORDS.latitude,
        longitude: DEFAULT_COORDS.longitude,
      };

  // 2. Realistic Nearby Parking Spots (Generated around user coordinates)
  const parkingSpots: ParkingSpot[] = useMemo(() => {
    const lat = centerCoords.latitude;
    const lng = centerCoords.longitude;

    return [
      {
        id: 'spot-1',
        title: 'Kerkstraat P-Zone (100% Free)',
        type: 'free',
        pricePerHour: 0,
        label: 'FREE',
        badge: '100% FREE',
        walkingTime: '3 min walk',
        distance: '230m away',
        venstertijden: 'Free 24/7 · Municipal free parking strip',
        color: '#10b981', // emerald-500
        coordinate: { latitude: lat + 0.0022, longitude: lng + 0.0018 },
        description: 'Roadside non-permit parking strip. 4 spaces usually free.',
      },
      {
        id: 'spot-2',
        title: 'Prinsengracht Blue Zone',
        type: 'blue',
        pricePerHour: 0,
        label: 'BLUE 2H',
        badge: 'BLUE ZONE',
        walkingTime: '5 min walk',
        distance: '420m away',
        venstertijden: 'Max 2 hours with parking disc (09:00 - 18:00)',
        color: '#2563eb', // blue-600
        coordinate: { latitude: lat - 0.0028, longitude: lng + 0.0035 },
        description: 'Blue zone parking disc required between 09:00 and 18:00.',
      },
      {
        id: 'spot-3',
        title: 'Westerdok Municipal Cheap Zone',
        type: 'cheap',
        pricePerHour: 1.5,
        label: '€1.50/h',
        badge: 'CHEAPEST PAID',
        walkingTime: '7 min walk',
        distance: '610m away',
        venstertijden: 'Free after 19:00 & Sundays · Normally €1.50/h',
        color: '#0284c7', // sky-600
        coordinate: { latitude: lat + 0.0038, longitude: lng - 0.0029 },
        description: 'Low-tariff municipal zone. Saves up to €4.50/h vs city center.',
      },
      {
        id: 'spot-4',
        title: 'Q-Park Center Garage',
        type: 'paid',
        pricePerHour: 4.8,
        label: '€4.80/h',
        badge: 'COVERED GARAGE',
        walkingTime: '9 min walk',
        distance: '720m away',
        venstertijden: 'Open 24/7 · Height clearance 2.10m · EV Chargers',
        color: '#f59e0b', // amber-500
        coordinate: { latitude: lat - 0.0041, longitude: lng - 0.0032 },
        description: 'Underground secure garage with 8 EV charging bays.',
      },
      {
        id: 'hazard-1',
        title: 'Active Parking Warden / Controle',
        type: 'hazard',
        pricePerHour: 0,
        label: '⚠️ WARDEN',
        badge: 'HAZARD ALERT',
        walkingTime: 'Alert from driver 4m ago',
        distance: '310m away',
        venstertijden: 'Scan-car spotted checking licenses on Singel',
        color: '#dc2626', // red-600
        coordinate: { latitude: lat + 0.0015, longitude: lng - 0.0019 },
        description: 'Municipal scan car active on this street right now.',
      },
    ];
  }, [centerCoords.latitude, centerCoords.longitude]);

  // Filtered spots based on category chip selection
  const filteredSpots = useMemo(() => {
    if (selectedFilter === 'free') {
      return parkingSpots.filter((s) => s.type === 'free' || s.type === 'blue');
    }
    if (selectedFilter === 'cheap') {
      return parkingSpots.filter((s) => s.type === 'cheap' || s.type === 'free');
    }
    if (selectedFilter === 'hazard') {
      return parkingSpots.filter((s) => s.type === 'hazard');
    }
    return parkingSpots;
  }, [parkingSpots, selectedFilter]);

  // Destination Search Suggestions (Google / Apple Maps style)
  const popularDestinations: SearchDestination[] = useMemo(
    () => [
      {
        id: 'dest-1',
        name: 'Centraal Station',
        subtitle: 'Stationsplein, Amsterdam · Public Transit Hub',
        distance: '850m',
        coordinate: {
          latitude: centerCoords.latitude + 0.0045,
          longitude: centerCoords.longitude + 0.002,
        },
      },
      {
        id: 'dest-2',
        name: 'Dam Square & Royal Palace',
        subtitle: 'City Center · High Parking Tariff Zone',
        distance: '1.2 km',
        coordinate: {
          latitude: centerCoords.latitude - 0.003,
          longitude: centerCoords.longitude + 0.001,
        },
      },
      {
        id: 'dest-3',
        name: 'Museumplein & Van Gogh Museum',
        subtitle: 'Museumkwartier · Blue zone borders',
        distance: '2.4 km',
        coordinate: {
          latitude: centerCoords.latitude - 0.007,
          longitude: centerCoords.longitude - 0.004,
        },
      },
    ],
    [centerCoords]
  );

  const handleSelectDestination = (dest: SearchDestination) => {
    setSearchQuery(dest.name);
    setIsSearchFocused(false);
    Keyboard.dismiss();

    const targetRegion: Region = {
      latitude: dest.coordinate.latitude,
      longitude: dest.coordinate.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    setRegion(targetRegion);
    mapRef.current?.animateToRegion(targetRegion, 900);
  };

  const handleRecenter = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600
      );
    }
  };

  const toggleMapType = () => {
    setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const handleReportHazard = () => {
    Alert.alert(
      '⚠️ Report Parking Hazard',
      'Select a hazard to broadcast in real time to nearby ParkNavigator drivers:',
      [
        {
          text: '👮 Parking Warden (Scan-auto / Handhaving)',
          onPress: () => Alert.alert('Reported', 'Hazard broadcasted to live feed.'),
        },
        {
          text: '🅿️ Full Blue Zone (No spots left)',
          onPress: () => Alert.alert('Reported', 'Blue zone marked full.'),
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ================= MAP COMPONENT ================= */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        mapType={mapType}
        showsTraffic={showTraffic}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        showsBuildings={true}
        scrollEnabled={true}
        zoomEnabled={true}
        rotateEnabled={true}
        pitchEnabled={true}
        onPress={() => {
          setSelectedSpot(null);
          setIsSearchFocused(false);
          Keyboard.dismiss();
        }}
      >
        {/* 750m Smart Scanning Radius Circle */}
        <Circle
          center={centerCoords}
          radius={750}
          strokeWidth={2}
          strokeColor="rgba(59, 130, 246, 0.7)"
          fillColor="rgba(59, 130, 246, 0.07)"
        />

        {/* Interactive Parking Spots & Hazards */}
        {filteredSpots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={spot.coordinate}
            onPress={() => setSelectedSpot(spot)}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.markerContainer,
                {
                  borderColor: spot.color,
                  backgroundColor: selectedSpot?.id === spot.id ? spot.color : '#ffffff',
                },
              ]}
            >
              <Text
                style={[
                  styles.markerLabel,
                  {
                    color: selectedSpot?.id === spot.id ? '#ffffff' : spot.color,
                  },
                ]}
              >
                {spot.label}
              </Text>
            </View>
            <View
              style={[
                styles.markerArrow,
                {
                  borderTopColor: selectedSpot?.id === spot.id ? spot.color : '#ffffff',
                },
              ]}
            />
          </Marker>
        ))}
      </MapView>

      {/* ================= TOP FLOATING OVERLAYS ================= */}
      <SafeAreaView pointerEvents="box-none" style={styles.topOverlayArea}>
        {/* Google / Apple Maps Styled Floating Search Card */}
        <View style={styles.searchCard}>
          <View style={styles.searchRow}>
            {/* Search Icon / Indicator */}
            <View style={styles.searchIconBubble}>
              <Text style={styles.searchIconText}>🔍</Text>
            </View>

            {/* Main Search Input */}
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search destination, street or city..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />

            {/* Clear / Voice / Radius Badge */}
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setIsSearchFocused(false);
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.radiusPill}>
                <Text style={styles.radiusPillText}>750m</Text>
              </View>
            )}
          </View>

          {/* Quick Filter Category Chips (Google Maps / Apple Maps style) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipScroll}
            style={styles.filterChipScrollView}
          >
            <TouchableOpacity
              onPress={() => setSelectedFilter('all')}
              style={[
                styles.filterChip,
                selectedFilter === 'all' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === 'all' && styles.filterChipTextActive,
                ]}
              >
                🅿️ All Spots ({parkingSpots.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFilter('free')}
              style={[
                styles.filterChip,
                selectedFilter === 'free' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === 'free' && styles.filterChipTextActive,
                ]}
              >
                🆓 100% Free & Blue
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFilter('cheap')}
              style={[
                styles.filterChip,
                selectedFilter === 'cheap' && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === 'cheap' && styles.filterChipTextActive,
                ]}
              >
                💶 Under €2.00/h
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedFilter('hazard')}
              style={[
                styles.filterChip,
                selectedFilter === 'hazard' && styles.filterChipHazardActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === 'hazard' && styles.filterChipTextActive,
                ]}
              >
                ⚠️ Wardens & Hazards
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Dropdown Suggestions Card (Appears when Search is Focused) */}
        {isSearchFocused && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsHeader}>POPULAR DESTINATIONS</Text>
            {popularDestinations.map((dest) => (
              <TouchableOpacity
                key={dest.id}
                onPress={() => handleSelectDestination(dest)}
                style={styles.suggestionItem}
              >
                <View style={styles.suggestionIcon}>
                  <Text style={styles.suggestionPin}>📍</Text>
                </View>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionTitle}>{dest.name}</Text>
                  <Text style={styles.suggestionSubtitle}>{dest.subtitle}</Text>
                </View>
                <Text style={styles.suggestionDistance}>{dest.distance}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SafeAreaView>

      {/* ================= RIGHT SIDE MAP CONTROLS ================= */}
      <View pointerEvents="box-none" style={styles.mapControlsContainer}>
        {/* Layer Switcher (Standard / Satellite) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={toggleMapType}
          style={styles.mapControlButton}
          accessibilityLabel="Toggle Satellite Layer"
        >
          <Text style={styles.mapControlIcon}>
            {mapType === 'standard' ? '🛰️' : '🗺️'}
          </Text>
        </TouchableOpacity>

        {/* Traffic Overlay Toggle */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setShowTraffic(!showTraffic)}
          style={[
            styles.mapControlButton,
            showTraffic && styles.mapControlButtonActive,
          ]}
          accessibilityLabel="Toggle Traffic Layer"
        >
          <Text style={styles.mapControlIcon}>🚦</Text>
        </TouchableOpacity>

        {/* Re-center GPS Location Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleRecenter}
          style={styles.mapControlButton}
          accessibilityLabel="Re-center on User Location"
        >
          <Text style={styles.mapControlIcon}>🎯</Text>
        </TouchableOpacity>
      </View>

      {/* ================= BOTTOM RIGHT: REPORT HAZARD FAB ================= */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleReportHazard}
        style={styles.hazardFab}
        accessibilityLabel="Report Hazard"
      >
        <Text style={styles.hazardFabIcon}>⚠️</Text>
        <Text style={styles.hazardFabText}>Report</Text>
      </TouchableOpacity>

      {/* ================= BOTTOM SPOT DETAIL CARD (APPLE MAPS STYLE) ================= */}
      {selectedSpot && (
        <SafeAreaView pointerEvents="box-none" style={styles.bottomSheetWrapper}>
          <View style={styles.bottomCard}>
            <View style={styles.cardHandle} />

            <View style={styles.cardHeader}>
              <View style={styles.cardTitleArea}>
                <View style={styles.cardBadgeRow}>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: selectedSpot.color + '20' },
                    ]}
                  >
                    <Text style={[styles.typeBadgeText, { color: selectedSpot.color }]}>
                      {selectedSpot.badge}
                    </Text>
                  </View>
                  <Text style={styles.cardDistance}>{selectedSpot.distance}</Text>
                  <Text style={styles.cardWalkingTime}>· {selectedSpot.walkingTime}</Text>
                </View>
                <Text style={styles.cardTitle}>{selectedSpot.title}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedSpot(null)}
                style={styles.closeCardButton}
              >
                <Text style={styles.closeCardText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardDescription}>{selectedSpot.description}</Text>

            {/* Venstertijden / Municipal Rules */}
            <View style={styles.venstertijdenBox}>
              <Text style={styles.venstertijdenIcon}>⏱️</Text>
              <Text style={styles.venstertijdenText}>{selectedSpot.venstertijden}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  Alert.alert(
                    'Routing to Parking',
                    `Routing to ${selectedSpot.title}.\nEstimated walking time to destination: ${selectedSpot.walkingTime}.`
                  );
                }}
                style={styles.primaryActionButton}
              >
                <Text style={styles.primaryActionText}>
                  {selectedSpot.pricePerHour === 0 ? 'Park for Free' : `Park (${selectedSpot.label})`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Alert.alert('Saved', 'Spot added to saved parking list.');
                }}
                style={styles.secondaryActionButton}
              >
                <Text style={styles.secondaryActionText}>⭐ Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Loading Overlay (Only if first GPS location is actively resolving) */}
      {isLoading && !location && (
        <View style={styles.initialLoadingBanner}>
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text style={styles.initialLoadingText}>
            Detecting GPS position & 750m parking zone...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Top Search Overlays
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
    borderRadius: 24,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchIconText: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    paddingVertical: 6,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  radiusPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginLeft: 6,
  },
  radiusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },

  // Category Filter Chips
  filterChipScrollView: {
    marginTop: 10,
  },
  filterChipScroll: {
    paddingRight: 6,
  },
  filterChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#1e293b',
    borderColor: '#0f172a',
  },
  filterChipHazardActive: {
    backgroundColor: '#dc2626',
    borderColor: '#b91c1c',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },

  // Suggestions Dropdown
  suggestionsContainer: {
    marginHorizontal: 14,
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  suggestionsHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#94a3b8',
    marginBottom: 8,
    marginLeft: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  suggestionPin: {
    fontSize: 16,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  suggestionDistance: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 8,
  },

  // Map Controls (Right Side)
  mapControlsContainer: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    zIndex: 20,
    alignItems: 'center',
  },
  mapControlButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapControlButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
  },
  mapControlIcon: {
    fontSize: 18,
  },

  // Report Hazard FAB (Bottom Right)
  hazardFab: {
    position: 'absolute',
    right: 14,
    bottom: 34,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 20,
  },
  hazardFabIcon: {
    fontSize: 22,
    lineHeight: 24,
  },
  hazardFabText: {
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#ffffff',
  },

  // Custom Markers
  markerContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  markerLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
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

  // Bottom Sheet Spot Details
  bottomSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleArea: {
    flex: 1,
    paddingRight: 10,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardWalkingTime: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeCardButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  cardDescription: {
    fontSize: 13,
    color: '#475569',
    marginTop: 6,
    lineHeight: 18,
  },
  venstertijdenBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  venstertijdenIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  venstertijdenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  primaryActionButton: {
    flex: 1,
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
  primaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },

  // Floating status toast
  initialLoadingBanner: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 120 : 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  initialLoadingText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
});
