import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Polygon, Polyline, Marker } from 'react-native-maps';
import { ParkingSpot } from '../types/parking';

interface ParkingAreaOverlayProps {
  spot: ParkingSpot;
  isOptimal?: boolean;
  onPress?: (spot: ParkingSpot) => void;
}

export const ParkingAreaOverlay: React.FC<ParkingAreaOverlayProps> = ({
  spot,
  isOptimal = false,
  onPress,
}) => {
  const isFree = spot.type === 'free';
  const fillColor = isFree
    ? 'rgba(16, 185, 129, 0.38)' // Crisp emerald green translucent fill
    : spot.type === 'blue'
    ? 'rgba(37, 99, 235, 0.32)'
    : 'rgba(2, 132, 199, 0.30)';

  const strokeColor = isFree ? '#059669' : spot.color;

  return (
    <>
      {/* 1. Precise Dedicated Parking Area Polygon (Strictly bounded to parking bays - not the road) */}
      {spot.polygon && spot.polygon.length >= 3 && (
        <Polygon
          coordinates={spot.polygon}
          strokeColor={strokeColor}
          fillColor={fillColor}
          strokeWidth={2.5}
          zIndex={18}
        />
      )}

      {/* 2. Individual Parking Stall Divider Markings */}
      {spot.stallDividers &&
        spot.stallDividers.map((divider, idx) => (
          <Polyline
            key={`stall-${spot.id}-${idx}`}
            coordinates={[divider.start, divider.end]}
            strokeColor="rgba(255, 255, 255, 0.95)"
            strokeWidth={1.5}
            lineDashPattern={[4, 2]}
            zIndex={19}
          />
        ))}

      {/* 3. High-Precision Parking Zone Pin & Badge */}
      <Marker
        coordinate={spot.coordinate}
        title={spot.title}
        description={`${spot.badge} • Alleen parkeerzone`}
        zIndex={30}
        onPress={() => onPress?.(spot)}
      >
        <View style={styles.markerWrapper}>
          <View style={[styles.parkingBadge, { backgroundColor: strokeColor }]}>
            <Text style={styles.parkingBadgeIcon}>
              {spot.facilityType === 'garage' ? '🏢' : '🅿️'}
            </Text>
            <Text style={styles.parkingBadgeLabel}>{spot.label}</Text>
          </View>

          {/* Sub-label confirming facility type and strict parking area demarcation */}
          <View style={styles.areaTypePill}>
            <Text style={styles.areaTypeText}>
              {spot.facilityType === 'garage'
                ? (isFree ? 'Gratis Garage' : 'Parkeergarage')
                : spot.facilityType === 'lot'
                ? (isFree ? 'Gratis Terrein' : 'Parkeerterrein')
                : (isFree ? 'Parkeervlak · Vrij' : 'Parkeervlak')}
            </Text>
          </View>

          <View style={[styles.markerArrow, { borderTopColor: strokeColor }]} />
        </View>
      </Marker>
    </>
  );
};

const styles = StyleSheet.create({
  markerWrapper: {
    alignItems: 'center',
  },
  parkingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  parkingBadgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  parkingBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  areaTypePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginTop: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  areaTypeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },
});

