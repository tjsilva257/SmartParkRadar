import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated } from 'react-native';
import { MapType } from 'react-native-maps';
import { CameraDisplayMode } from '../types/parking';

interface MapToolsMenuProps {
  visible?: boolean;
  mapType: MapType;
  showTraffic: boolean;
  showScratchMap?: boolean;
  cameraDisplayMode?: CameraDisplayMode;
  isLiveFeedActive?: boolean;
  activeIconCount?: number;
  onToggleMapType: () => void;
  onToggleTraffic: () => void;
  onToggleScratchMap?: () => void;
  onCycleCameraDisplayMode?: () => void;
  onOpenIconFilters?: () => void;
  onOpenHazardReport?: () => void;
  onOpenMemeShake?: () => void;
  onRefreshLiveFeed?: () => void;
  onRecenter: () => void;
  bottomOffset?: number;
}

export const MapToolsMenu: React.FC<MapToolsMenuProps> = ({
  visible = true,
  mapType,
  showTraffic,
  showScratchMap = false,
  cameraDisplayMode = 'always',
  isLiveFeedActive = false,
  activeIconCount,
  onToggleMapType,
  onToggleTraffic,
  onToggleScratchMap,
  onCycleCameraDisplayMode,
  onOpenIconFilters,
  onOpenHazardReport,
  onOpenMemeShake,
  onRefreshLiveFeed,
  onRecenter,
  bottomOffset = 40,
}) => {
  if (!visible) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [isMenuRendered, setIsMenuRendered] = useState(false);

  // Smooth entrance for floating controls
  const rootFade = useRef(new Animated.Value(0)).current;
  const rootScale = useRef(new Animated.Value(0.85)).current;

  // Popover menu animation values
  const menuFade = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.88)).current;
  const menuTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rootFade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(rootScale, { toValue: 1, tension: 75, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const openMenu = () => {
    setIsMenuRendered(true);
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(menuFade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(menuScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.spring(menuTranslateY, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const closeMenu = (onFinished?: () => void) => {
    Animated.parallel([
      Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(menuScale, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(menuTranslateY, { toValue: 8, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setIsOpen(false);
      setIsMenuRendered(false);
      onFinished?.();
    });
  };

  const toggleMenu = () => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const handleReportHazard = () => {
    closeMenu(() => {
      if (onOpenHazardReport) {
        onOpenHazardReport();
        return;
      }
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
    });
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity: rootFade,
          transform: [{ scale: rootScale }],
        },
      ]}
    >
      {/* Popover Menu Card with smooth scale & slide */}
      {isMenuRendered && (
        <Animated.View
          style={[
            styles.menuCard,
            {
              opacity: menuFade,
              transform: [{ scale: menuScale }, { translateY: menuTranslateY }],
            },
          ]}
        >
          <View style={styles.menuHeader}>
            <Text style={styles.menuHeaderTitle}>MAP TOOLS & ACTIONS</Text>
            <TouchableOpacity onPress={() => closeMenu()}>
              <Text style={styles.menuHeaderClose}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Live Data Network Status Banner */}
          <View style={styles.liveFeedBanner}>
            <View style={[styles.liveFeedPulseDot, isLiveFeedActive && styles.liveFeedPulseDotActive]} />
            <View style={styles.liveFeedTextCol}>
              <Text style={styles.liveFeedTitle}>LIVE OVERHEID & DATA FEEDS</Text>
              <Text style={styles.liveFeedSub}>
                {isLiveFeedActive
                  ? 'Verbonden met PDOK RWS & OpenStreetMap'
                  : 'Lokale database actief (offline gereed)'}
              </Text>
            </View>
            {onRefreshLiveFeed && (
              <TouchableOpacity onPress={onRefreshLiveFeed} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.liveFeedRefreshText}>🔄</Text>
              </TouchableOpacity>
            )}
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

          {/* Action 5: Kaart Iconen & Filters (Kies welke iconen zichtbaar zijn) */}
          {onOpenIconFilters && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setIsOpen(false);
                onOpenIconFilters();
              }}
              style={styles.menuItem}
            >
              <View style={[styles.iconBubble, { backgroundColor: '#e0f2fe' }]}>
                <Text style={styles.itemIcon}>👁️</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.itemTitle}>Kaart Iconen & Filters</Text>
                <Text style={styles.itemSub}>Kies welke iconen zichtbaar zijn</Text>
              </View>
              <View style={[styles.badge, styles.badgeOn]}>
                <Text style={[styles.badgeText, styles.badgeTextOn]}>
                  {activeIconCount !== undefined ? `${activeIconCount}/7` : 'KIES'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Action 6: Speed Camera Icons on Road Mode */}
          {onCycleCameraDisplayMode && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onCycleCameraDisplayMode}
              style={styles.menuItem}
            >
              <View style={[styles.iconBubble, { backgroundColor: '#fee2e2' }]}>
                <Text style={styles.itemIcon}>📸</Text>
                <View style={styles.miniCameraSpeedSign}>
                  <Text style={styles.miniCameraSpeedSignText}>50</Text>
                </View>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.itemTitle}>Camera Icons</Text>
                <Text style={styles.itemTitle}>Flitspalen / Snelheid</Text>
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

          {/* Action 6: 6 & 7 Shake Meme */}
          {onOpenMemeShake && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setIsOpen(false);
                onOpenMemeShake();
              }}
              style={styles.menuItem}
            >
              <View style={[styles.iconBubble, { backgroundColor: '#fdf4ff' }]}>
                <Text style={styles.itemIcon}>🕺</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.itemTitle}>6 & 7 Shake Meme</Text>
                <Text style={styles.itemSub}>Of typ '6-7' in de zoekbalk!</Text>
              </View>
              <View style={[styles.badge, styles.badgeTrip]}>
                <Text style={[styles.badgeText, styles.badgeTextTrip]}>MEME</Text>
              </View>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Button 1: Tools Menu Trigger Button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={toggleMenu}
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
    </Animated.View>
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
  miniCameraSpeedSign: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCameraSpeedSignText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0f172a',
  },
  liveFeedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  liveFeedPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
    marginRight: 10,
  },
  liveFeedPulseDotActive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 3,
  },
  liveFeedTextCol: {
    flex: 1,
  },
  liveFeedTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  liveFeedSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 1,
  },
  liveFeedRefreshText: {
    fontSize: 14,
    marginLeft: 8,
  },
});

