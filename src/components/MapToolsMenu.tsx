import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MapType } from 'react-native-maps';
import { CameraDisplayMode } from '../types/parking';

interface MapToolsMenuProps {
  mapType: MapType;
  showTraffic: boolean;
  showScratchMap?: boolean;
  cameraDisplayMode?: CameraDisplayMode;
  onToggleMapType: () => void;
  onToggleTraffic: () => void;
  onToggleScratchMap?: () => void;
  onCycleCameraDisplayMode?: () => void;
  onRecenter: () => void;
  bottomOffset?: number;
}

export const MapToolsMenu: React.FC<MapToolsMenuProps> = ({
  mapType,
  showTraffic,
  showScratchMap = false,
  cameraDisplayMode = 'always',
  onToggleMapType,
  onToggleTraffic,
  onToggleScratchMap,
  onCycleCameraDisplayMode,
  onRecenter,
  bottomOffset = 40,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleReportHazard = () => {
    setIsOpen(false);
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

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { bottom: bottomOffset }]}
    >
      {/* Popover Menu Card */}
      {isOpen && (
        <View style={styles.menuCard}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuHeaderTitle}>MAP TOOLS & ACTIONS</Text>
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <Text style={styles.menuHeaderClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Action 1: Report Hazard */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleReportHazard}
            style={styles.menuItem}
          >
            <View style={[styles.iconBubble, { backgroundColor: '#fef2f2' }]}>
              <Text style={styles.itemIcon}>⚠️</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.itemTitle}>Report Hazard</Text>
              <Text style={styles.itemSub}>Wardens, full zones & work</Text>
            </View>
          </TouchableOpacity>

          {/* Action 2: Satellite Toggle */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggleMapType}
            style={styles.menuItem}
          >
            <View style={[styles.iconBubble, { backgroundColor: '#f0fdf4' }]}>
              <Text style={styles.itemIcon}>
                {mapType === 'satellite' ? '🗺️' : '🛰️'}
              </Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.itemTitle}>Satellite View</Text>
              <Text style={styles.itemSub}>
                {mapType === 'satellite' ? 'Active: Satellite' : 'Active: Standard'}
              </Text>
            </View>
            <View
              style={[
                styles.badge,
                mapType === 'satellite' ? styles.badgeOn : styles.badgeOff,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  mapType === 'satellite' ? styles.badgeTextOn : styles.badgeTextOff,
                ]}
              >
                {mapType === 'satellite' ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action 3: Traffic Toggle */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onToggleTraffic}
            style={styles.menuItem}
          >
            <View style={[styles.iconBubble, { backgroundColor: '#eff6ff' }]}>
              <Text style={styles.itemIcon}>🚦</Text>
            </View>
            <View style={styles.textCol}>
              <Text style={styles.itemTitle}>Live Traffic</Text>
              <Text style={styles.itemSub}>Municipal congestion feed</Text>
            </View>
            <View style={[styles.badge, showTraffic ? styles.badgeOn : styles.badgeOff]}>
              <Text
                style={[
                  styles.badgeText,
                  showTraffic ? styles.badgeTextOn : styles.badgeTextOff,
                ]}
              >
                {showTraffic ? 'ON' : 'OFF'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action 4: Scratch Map (Fog of War) Toggle */}
          {onToggleScratchMap && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onToggleScratchMap}
              style={styles.menuItem}
            >
              <View style={[styles.iconBubble, { backgroundColor: '#f3e8ff' }]}>
                <Text style={styles.itemIcon}>🌫️</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.itemTitle}>Scratch Map</Text>
                <Text style={styles.itemSub}>Fog of War exploration</Text>
              </View>
              <View style={[styles.badge, showScratchMap ? styles.badgeOn : styles.badgeOff]}>
                <Text
                  style={[
                    styles.badgeText,
                    showScratchMap ? styles.badgeTextOn : styles.badgeTextOff,
                  ]}
                >
                  {showScratchMap ? 'ON' : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Action 5: Speed Camera Icons on Road Mode */}
          {onCycleCameraDisplayMode && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCycleCameraDisplayMode}
              style={styles.menuItem}
            >
              <View style={[styles.iconBubble, { backgroundColor: '#fee2e2' }]}>
                <Text style={styles.itemIcon}>📸</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.itemTitle}>Camera Icons</Text>
                <Text style={styles.itemSub}>
                  {cameraDisplayMode === 'always'
                    ? 'Always visible on road'
                    : cameraDisplayMode === 'trip_only'
                    ? 'Only while on a trip'
                    : 'Turned off completely'}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  cameraDisplayMode === 'always'
                    ? styles.badgeOn
                    : cameraDisplayMode === 'trip_only'
                    ? styles.badgeTrip
                    : styles.badgeOff,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    cameraDisplayMode === 'always'
                      ? styles.badgeTextOn
                      : cameraDisplayMode === 'trip_only'
                      ? styles.badgeTextTrip
                      : styles.badgeTextOff,
                  ]}
                >
                  {cameraDisplayMode === 'always'
                    ? 'ALWAYS'
                    : cameraDisplayMode === 'trip_only'
                    ? 'ON TRIP'
                    : 'OFF'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Button 1: Tools Menu Trigger Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setIsOpen(!isOpen)}
        style={[styles.floatingBtn, isOpen && styles.floatingBtnActive]}
        accessibilityLabel="Open Map Tools Menu"
      >
        <Text style={styles.btnIcon}>{isOpen ? '✕' : '🛠️'}</Text>
      </TouchableOpacity>

      {/* Button 2: Center to Your Location Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onRecenter}
        style={styles.floatingBtn}
        accessibilityLabel="Center to Your Location"
      >
        <Text style={styles.btnIcon}>🎯</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 14,
    zIndex: 35,
    alignItems: 'flex-end',
    gap: 12,
  },
  floatingBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  floatingBtnActive: {
    backgroundColor: '#1e293b',
    borderColor: '#0f172a',
  },
  btnIcon: {
    fontSize: 20,
  },
  menuCard: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 4,
  },
  menuHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
  },
  menuHeaderClose: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemIcon: {
    fontSize: 16,
  },
  textCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOn: {
    backgroundColor: '#dbeafe',
  },
  badgeOff: {
    backgroundColor: '#f1f5f9',
  },
  badgeTrip: {
    backgroundColor: '#fef3c7',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeTextOn: {
    color: '#1d4ed8',
  },
  badgeTextTrip: {
    color: '#b45309',
  },
  badgeTextOff: {
    color: '#64748b',
  },
});

