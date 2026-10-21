import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView, ScrollView, Animated } from 'react-native';
import { DestinationTarget, ParkingSpot, DriveRouteOption } from '../types/parking';

interface RouteDrawerProps {
  destination: DestinationTarget;
  optimalSpot: ParkingSpot;
  selectedRoute: DriveRouteOption | null;
  availableRoutes: DriveRouteOption[];
  maxWalkingDistance?: number;
  nearestFreeSpot?: ParkingSpot | null;
  onSelectRoute: (route: DriveRouteOption) => void;
  onSelectMaxWalkingDistance?: (dist: number) => void;
  onStartNavigation: () => void;
  onCancel: () => void;
}

export const RouteDrawer: React.FC<RouteDrawerProps> = ({
  destination,
  optimalSpot,
  selectedRoute,
  availableRoutes,
  maxWalkingDistance = 500,
  nearestFreeSpot,
  onSelectRoute,
  onSelectMaxWalkingDistance,
  onStartNavigation,
  onCancel,
}) => {
  const slideAnim = useRef(new Animated.Value(320)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCancelPress = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 320,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onCancel());
  };

  const driveMinutes = selectedRoute?.durationMinutes || 0;
  const driveKm = selectedRoute?.distanceKm || '0 km';
  const traffic = selectedRoute?.traffic;
  const isFree = optimalSpot.pricePerHour === 0 || optimalSpot.type === 'free';
  const isGarage = optimalSpot.facilityType === 'garage';
  const isLot = optimalSpot.facilityType === 'lot';

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.container}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.handle} />

        {/* Free / Nearest Facility Match Banner */}
        <View style={[styles.matchBanner, isFree ? styles.matchBannerFree : styles.matchBannerPaid]}>
          <Text style={styles.matchIcon}>
            {isFree ? '✨' : isGarage ? '🏢' : isLot ? '🅿️' : '📍'}
          </Text>
          <Text style={[styles.matchText, isFree ? styles.matchTextFree : styles.matchTextPaid]}>
            {isFree
              ? `Gevonden: 100% Gratis ${isGarage ? 'Parkeergarage' : isLot ? 'Parkeerterrein' : 'Parkeren'} (${optimalSpot.distanceToDestMeters}m lopen)!`
              : `Dichtstbijzijnde ${isGarage ? 'Parkeergarage' : isLot ? 'Parkeerterrein' : 'Parkeerplek'}: ${optimalSpot.label} (${optimalSpot.distanceToDestMeters}m lopen)`}
          </Text>
        </View>

        {/* Walking Distance Preference Selector */}
        <View style={styles.walkingSelectorContainer}>
          <View style={styles.walkingHeaderRow}>
            <Text style={styles.walkingSelectorTitle}>🚶 Maximaal Lopen</Text>
            <Text style={styles.walkingSelectorValue}>
              {maxWalkingDistance >= 1000 ? `${(maxWalkingDistance / 1000).toFixed(1)} km` : `${maxWalkingDistance}m`}
              {maxWalkingDistance <= 300 ? ' · Direct erbij' : maxWalkingDistance <= 600 ? ' · Comfortabel' : ' · Verder'}
            </Text>
          </View>

          <View style={styles.walkingChipsRow}>
            {[250, 500, 750, 1200].map((dist) => {
              const isSelected = maxWalkingDistance === dist;
              const label = dist === 250 ? '⚡ 250m' : dist === 500 ? '🚶 500m' : dist === 750 ? '👟 750m' : '🚴 1.2km';
              const sub = dist === 250 ? '~3 min' : dist === 500 ? '~6 min' : dist === 750 ? '~10 min' : '~15 min';

              return (
                <TouchableOpacity
                  key={dist}
                  activeOpacity={0.8}
                  onPress={() => onSelectMaxWalkingDistance?.(dist)}
                  style={[styles.walkingChip, isSelected && styles.walkingChipSelected]}
                >
                  <Text style={[styles.walkingChipText, isSelected && styles.walkingChipTextSelected]}>
                    {label}
                  </Text>
                  <Text style={[styles.walkingChipSub, isSelected && styles.walkingChipSubSelected]}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Suggestion pill if chosen spot is paid because free spot is outside chosen walking range */}
        {!isFree && nearestFreeSpot && nearestFreeSpot.distanceToDestMeters > maxWalkingDistance && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              const target = nearestFreeSpot.distanceToDestMeters <= 500 ? 500 : nearestFreeSpot.distanceToDestMeters <= 750 ? 750 : 1200;
              onSelectMaxWalkingDistance?.(target);
            }}
            style={styles.freeFurtherPill}
          >
            <Text style={styles.freeFurtherText}>
              💡 Gratis parkeren ligt op {nearestFreeSpot.distanceToDestMeters}m · Tik hier om loopafstand te verhogen
            </Text>
          </TouchableOpacity>
        )}

        {/* Live Traffic Efficiency Pill */}
        {traffic && (
          <View style={styles.trafficRow}>
            <View style={styles.trafficPill}>
              <Text style={styles.trafficText}>{traffic.summary}</Text>
            </View>
            {traffic.savingsText && (
              <View style={styles.savingsPill}>
                <Text style={styles.savingsText}>{traffic.savingsText}</Text>
              </View>
            )}
          </View>
        )}

        {/* Multi-Route Corridor Selector (If alternatives exist) */}
        {availableRoutes.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routeChipsContainer}
            style={styles.routeChipsScroll}
          >
            {availableRoutes.map((route) => {
              const isSelected = selectedRoute?.id === route.id;
              return (
                <TouchableOpacity
                  key={route.id}
                  activeOpacity={0.8}
                  onPress={() => onSelectRoute(route)}
                  style={[
                    styles.routeChip,
                    isSelected && styles.routeChipSelected,
                  ]}
                >
                  <Text style={[styles.routeChipTitle, isSelected && styles.routeChipTitleSelected]}>
                    {route.isFastest ? '⚡ ' : ''}{route.summary}
                  </Text>
                  <Text style={[styles.routeChipSub, isSelected && styles.routeChipSubSelected]}>
                    {route.durationMinutes} min ({route.distanceKm})
                    {route.timeDiffMinutes > 0 ? ` · +${route.timeDiffMinutes} min` : ' · Fastest'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Journey Leg Breakdown */}
        <View style={styles.legsRow}>
          {/* Leg 1: Drive */}
          <View style={styles.legItem}>
            <View style={styles.legIconBubble}>
              <Text style={styles.legIcon}>🚗</Text>
            </View>
            <View>
              <Text style={styles.legTime}>{driveMinutes} min</Text>
              <Text style={styles.legLabel}>Drive ({driveKm})</Text>
            </View>
          </View>

          <Text style={styles.arrowIcon}>➔</Text>

          {/* Leg 2: Park */}
          <View style={styles.legItem}>
            <View style={[styles.legIconBubble, { backgroundColor: optimalSpot.color + '20' }]}>
              <Text style={styles.legIcon}>🅿️</Text>
            </View>
            <View>
              <Text style={[styles.legTime, { color: optimalSpot.color }]}>
                {optimalSpot.label}
              </Text>
              <Text style={styles.legLabel}>{optimalSpot.badge}</Text>
            </View>
          </View>

          <Text style={styles.arrowIcon}>➔</Text>

          {/* Leg 3: Walk */}
          <View style={styles.legItem}>
            <View style={[styles.legIconBubble, { backgroundColor: '#ecfdf5' }]}>
              <Text style={styles.legIcon}>🚶</Text>
            </View>
            <View>
              <Text style={styles.legTime}>{optimalSpot.walkingTimeMinutes} min</Text>
              <Text style={styles.legLabel}>Walk ({optimalSpot.distanceToDestMeters}m)</Text>
            </View>
          </View>
        </View>

        {/* Spot Title & Rules */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{optimalSpot.title}</Text>
          <Text style={styles.infoSub}>{optimalSpot.venstertijden}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onStartNavigation}
            style={styles.startBtn}
          >
            <Text style={styles.startBtnText}>
              🧭 Navigate Fastest Route
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCancelPress}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  matchBannerFree: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  matchBannerPaid: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  matchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  matchText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  matchTextFree: {
    color: '#065f46',
  },
  matchTextPaid: {
    color: '#1e40af',
  },
  walkingSelectorContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  walkingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  walkingSelectorTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  walkingSelectorValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#2563eb',
  },
  walkingChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  walkingChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  walkingChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  walkingChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569',
  },
  walkingChipTextSelected: {
    color: '#1d4ed8',
  },
  walkingChipSub: {
    fontSize: 8,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 1,
  },
  walkingChipSubSelected: {
    color: '#3b82f6',
  },
  freeFurtherPill: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  freeFurtherText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  trafficPill: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  trafficText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  savingsPill: {
    backgroundColor: '#fefce8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a16207',
  },
  routeChipsScroll: {
    marginBottom: 8,
  },
  routeChipsContainer: {
    gap: 8,
  },
  routeChip: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  routeChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  routeChipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  routeChipTitleSelected: {
    color: '#1d4ed8',
  },
  routeChipSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  routeChipSubSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  legsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  legItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  legIcon: {
    fontSize: 15,
  },
  legTime: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  legLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  arrowIcon: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  infoBox: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  infoSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  startBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  startBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
});
