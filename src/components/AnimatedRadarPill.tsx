import React, { useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Platform, Animated } from 'react-native';
import { CameraWarning } from '../types/parking';

interface AnimatedRadarPillProps {
  warning: CameraWarning;
}

export const AnimatedRadarPill: React.FC<AnimatedRadarPillProps> = ({ warning }) => {
  const dropAnim = useRef(new Animated.Value(-60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Drop in from top
    Animated.parallel([
      Animated.spring(dropAnim, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation if urgent
    if (warning.isUrgent) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.04, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [warning.isUrgent, warning.camera.id]);

  const isMobile = warning.camera.type === 'mobile';

  return (
    <Animated.View
      style={[
        styles.floatingRadarPill,
        warning.isUrgent && styles.floatingRadarPillUrgent,
        {
          opacity: fadeAnim,
          transform: [{ translateY: dropAnim }, { scale: pulseScale }],
        },
      ]}
    >
      {isMobile ? (
        <Text style={styles.floatingRadarEmoji}>🚓</Text>
      ) : (
        <View style={styles.floatingRadarSign}>
          <Text
            style={[
              styles.floatingRadarSignText,
              warning.camera.speedLimit >= 100 && styles.floatingRadarSignText3Digit,
            ]}
          >
            {warning.camera.speedLimit}
          </Text>
        </View>
      )}

      <Text style={styles.floatingRadarText} numberOfLines={1}>
        {warning.camera.name} ({warning.distanceMeters}m) • Max {warning.camera.speedLimit} km/h
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingRadarPill: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 52 : 62,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 27, 75, 0.95)',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 45,
    maxWidth: '90%',
  },
  floatingRadarPillUrgent: {
    backgroundColor: 'rgba(69, 10, 10, 0.95)',
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  floatingRadarEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  floatingRadarSign: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  floatingRadarSignText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: Platform.OS === 'ios' ? 11 : undefined,
  },
  floatingRadarSignText3Digit: {
    fontSize: 8,
    letterSpacing: -0.4,
  },
  floatingRadarText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#f8fafc',
  },
});

