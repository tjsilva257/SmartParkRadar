import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { TurnManeuver, NavPhase, ParkingSpot, DestinationTarget, CameraWarning, SpeedAlert } from '../types/parking';

interface NavigationHUDProps {
  currentManeuver: TurnManeuver;
  currentSpeed: number;
  speedLimit?: number;
  speedAlert?: SpeedAlert | null;
  cameraWarning?: CameraWarning | null;
  drivingMinutes?: number;
  navPhase: NavPhase;
  optimalSpot: ParkingSpot;
  destination: DestinationTarget;
  isVoiceMuted: boolean;
  onToggleVoice: () => void;
  onEndNavigation: () => void;
  onCycleSpeedTest?: () => void;
}

export const NavigationHUD: React.FC<NavigationHUDProps> = ({
  currentManeuver,
  currentSpeed,
  speedLimit = 50,
  speedAlert,
  cameraWarning,
  drivingMinutes,
  navPhase,
  optimalSpot,
  destination,
  isVoiceMuted,
  onToggleVoice,
  onEndNavigation,
  onCycleSpeedTest,
}) => {
  const isWayOver = speedAlert?.isWayOverLimit;
  const isOver = speedAlert?.isOverLimit;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlayWrapper}>
      {/* 1. Top Section: Turn-By-Turn Banner + Camera / Fine Alerts */}
      <View style={styles.topAlertsContainer}>
        {/* Turn-By-Turn Navigation Header */}
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

        {/* 1B. FLITSER / SPEED CAMERA RADAR WARNING BANNER */}
        {cameraWarning && (
          <View style={[styles.cameraAlertCard, cameraWarning.isUrgent && styles.cameraAlertCardUrgent]}>
            <View style={[styles.cameraAlertIconBubble, cameraWarning.isUrgent && styles.cameraAlertIconBubbleUrgent]}>
              <Text style={styles.cameraAlertEmoji}>
                {cameraWarning.camera.type === 'traject'
                  ? '⏱️'
                  : cameraWarning.camera.type === 'mobile'
                  ? '🚓'
                  : cameraWarning.camera.type === 'red_light'
                  ? '🚦'
                  : '📸'}
              </Text>
            </View>
            {cameraWarning.camera.type === 'mobile' && (
              <View style={[styles.cameraAlertIconBubble, cameraWarning.isUrgent && styles.cameraAlertIconBubbleUrgent]}>
                <Text style={styles.cameraAlertEmoji}>🚓</Text>
              </View>
            )}
            <View style={styles.cameraAlertTextCol}>
              <View style={styles.cameraAlertTopRow}>
                <Text style={styles.cameraAlertBadge}>
                  {cameraWarning.camera.type === 'traject'
                    ? 'TRAJECTCONTROLE'
                    : cameraWarning.camera.type === 'mobile'
                    ? 'MOBIELE FLITSER'
                    ? 'POLITIECONTROLE'
                    : cameraWarning.camera.type === 'red_light'
                    ? 'FLITS- & ROODLICHT'
                    : 'FLITSER GEMELD'}
                    : 'FLITSER'}
                </Text>
                <Text style={styles.cameraAlertDistance}>
                  {cameraWarning.distanceMeters > 1000
                    ? `${(cameraWarning.distanceMeters / 1000).toFixed(1)} km`
                    : `${cameraWarning.distanceMeters}m`}
                </Text>
              </View>
              <Text style={styles.cameraAlertRoad} numberOfLines={1}>
                {cameraWarning.camera.name} • Max {cameraWarning.camera.speedLimit} km/h
              </Text>
            </View>
            <View style={styles.cameraSignBox}>
              <Text style={styles.cameraSignText}>{cameraWarning.camera.speedLimit}</Text>
            </View>
          </View>
        )}

        {/* 1C. FINE RISK ALERT BANNER (When going way too fast!) */}
        {isWayOver && (
          <View style={styles.fineWarningCard}>
            <View style={styles.fineWarningIconBadge}>
              <Text style={styles.fineWarningEmoji}>🚨</Text>
            </View>
            <View style={styles.fineWarningContent}>
              <Text style={styles.fineWarningTitle}>BOETE GEVAAR! MATIG SNELHEID</Text>
              <Text style={styles.fineWarningDetails}>
                +{speedAlert.overBy} km/h te snel • Geschatte boete: €{speedAlert.fineEstimateEur}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* 2. Speedometer & Hazard Radar (Left Side) */}
      <View style={styles.speedRadarContainer}>
        {/* Speed Value Gauge (Tappable for interactive testing) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onCycleSpeedTest}
          style={[
            styles.speedGaugeBox,
            isOver && styles.speedGaugeBoxOver,
            isWayOver && styles.speedGaugeBoxWayOver,
          ]}
        >
          <Text
            style={[
              styles.speedValue,
              isOver && styles.speedValueOver,
              isWayOver && styles.speedValueWayOver,
            ]}
          >
            {currentSpeed}
          </Text>
          <Text style={styles.speedUnit}>KM/H</Text>
        </TouchableOpacity>

        {/* Dutch Speed Limit Sign (Standard red-bordered traffic ring) */}
        <View style={styles.speedLimitSign}>
          <Text style={styles.speedLimitText}>{speedLimit}</Text>
        </View>

        {/* Fine Estimate Pill or Radar Active Pill */}
        {isWayOver ? (
          <View style={styles.fineAmountPill}>
            <Text style={styles.fineAmountIcon}>💸</Text>
            <Text style={styles.fineAmountText}>€{speedAlert?.fineEstimateEur} boete</Text>
          </View>
        ) : isOver ? (
          <View style={styles.speedWarningPill}>
            <Text style={styles.speedWarningPillText}>+{speedAlert?.overBy} km/h</Text>
          </View>
        ) : cameraWarning ? (
          <View style={styles.radarAlertPill}>
            <Text style={styles.radarIcon}>📸</Text>
            {cameraWarning.camera.type === 'mobile' && (
              <Text style={styles.radarIcon}>🚓</Text>
            )}
            <Text style={styles.radarAlertText}>{cameraWarning.distanceMeters}m</Text>
          </View>
        ) : (
          <View style={styles.radarPill}>
            <Text style={styles.radarIcon}>🛡️</Text>
            <Text style={styles.radarText}>Radar Actief</Text>
          </View>
        )}
      </View>

      {/* 3. Bottom Trip HUD Bar */}
      <View style={styles.bottomHUDCard}>
        <View style={styles.statsRow}>
          <View>
            <Text style={styles.etaText}>
              {navPhase === 'driving' ? (drivingMinutes ? `${drivingMinutes} min` : '6 min') : '2 min'}
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
  topAlertsContainer: {
    marginHorizontal: 12,
    marginTop: Platform.OS === 'android' ? 44 : 58,
    gap: 8,
  },
  tbtHeaderCard: {
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
  cameraAlertCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  cameraAlertCardUrgent: {
    backgroundColor: '#450a0a',
    borderColor: '#ef4444',
    shadowColor: '#dc2626',
    shadowOpacity: 0.5,
  },
  cameraAlertIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3730a3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cameraAlertIconBubbleUrgent: {
    backgroundColor: '#991b1b',
  },
  cameraAlertEmoji: {
    fontSize: 18,
  },
  cameraAlertTextCol: {
    flex: 1,
  },
  cameraAlertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraAlertBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: '#818cf8',
    letterSpacing: 0.5,
  },
  cameraAlertDistance: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fbbf24',
  },
  cameraAlertRoad: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
    marginTop: 1,
  },
  cameraSignBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  cameraSignText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
  },
  fineWarningCard: {
    backgroundColor: '#7f1d1d',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  fineWarningIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#991b1b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  fineWarningEmoji: {
    fontSize: 16,
  },
  fineWarningContent: {
    flex: 1,
  },
  fineWarningTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  fineWarningDetails: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fecaca',
    marginTop: 1,
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
  speedGaugeBoxOver: {
    borderColor: '#f59e0b',
    backgroundColor: '#291b00',
  },
  speedGaugeBoxWayOver: {
    borderColor: '#ef4444',
    backgroundColor: '#450a0a',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  speedValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 22,
  },
  speedValueOver: {
    color: '#fbbf24',
  },
  speedValueWayOver: {
    color: '#ef4444',
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
  fineAmountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#991b1b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  fineAmountIcon: {
    fontSize: 11,
    marginRight: 3,
  },
  fineAmountText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  speedWarningPill: {
    backgroundColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'center',
  },
  speedWarningPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  radarAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#312e81',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  radarAlertText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a5b4fc',
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

