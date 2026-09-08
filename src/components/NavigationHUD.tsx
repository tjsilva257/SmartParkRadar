import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { TurnManeuver, NavPhase, ParkingSpot, DestinationTarget } from '../types/parking';

interface NavigationHUDProps {
  currentManeuver: TurnManeuver;
  currentSpeed: number;
  navPhase: NavPhase;
  optimalSpot: ParkingSpot;
  destination: DestinationTarget;
  isVoiceMuted: boolean;
  onToggleVoice: () => void;
  onEndNavigation: () => void;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  currentManeuver,
  currentSpeed,
  navPhase,
  optimalSpot,
  destination,
  isVoiceMuted,
  onToggleVoice,
  onEndNavigation,
}) => {
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlayWrapper}>
      {/* 1. Top Turn-By-Turn Navigation Banner */}
      <View style={styles.tbtHeaderCard}>
        <View style={styles.tbtIconBubble}>
          <Text style={styles.tbtIcon}>{currentManeuver.icon}</Text>
        </View>
        <View style={styles.tbtTextCol}>
          <Text style={styles.tbtDistance}>{currentManeuver.distanceText}</Text>
          <Text style={styles.tbtInstruction} numberOfLines={2}>
            {currentManeuver.instruction}
          </Text>
          <Text style={styles.tbtStreet}>{currentManeuver.street}</Text>
        </View>
      </View>

      {/* 2. Speedometer & Hazard Radar (Left Side) */}
      <View style={styles.speedRadarContainer}>
        {/* Speed Value Gauge */}
        <View style={styles.speedGaugeBox}>
          <Text style={styles.speedValue}>{currentSpeed}</Text>
          <Text style={styles.speedUnit}>KM/H</Text>
        </View>

        {/* Speed Limit Sign */}
        <View style={styles.speedLimitSign}>
          <Text style={styles.speedLimitText}>50</Text>
        </View>

        {/* Flitsmeister Radar Pill */}
        <View style={styles.radarPill}>
          <Text style={styles.radarIcon}>🛡️</Text>
          <Text style={styles.radarText}>Radar Active</Text>
        </View>
      </View>

      {/* 3. Bottom Trip HUD Bar */}
      <View style={styles.bottomHUDCard}>
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.etaText}>
              {navPhase === 'driving' ? '6 min' : '2 min'}
            </Text>
            <Text style={styles.etaSubText}>
              {navPhase === 'driving'
                ? `To ${optimalSpot.title}`
                : `To ${destination.name}`}
            </Text>
          </View>

          <View style={styles.phaseBadge}>
            <Text style={styles.phaseBadgeText}>
              {navPhase === 'driving' ? '🚗 DRIVING TO SPOT' : '🚶 WALKING LEG'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onToggleVoice}
            style={styles.voiceBtn}
            accessibilityLabel="Toggle voice alerts"
          >
            <Text style={styles.voiceIcon}>{isVoiceMuted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>
        </View>

        {/* End Route Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onEndNavigation}
          style={styles.endRouteBtn}
          accessibilityLabel="End navigation"
        >
          <Text style={styles.endRouteText}>✕ End Route</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  overlayWrapper: {
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
  tbtIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tbtIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  tbtTextCol: {
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
  bottomHUDCard: {
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  etaText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  etaSubText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  phaseBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  phaseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38bdf8',
  },
  voiceBtn: {
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
  endRouteBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endRouteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
