import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Marker } from 'react-native-maps';
import { Coordinate } from '../types/parking';
import { detectPoiCategory } from '../services/placesService';

interface AnimatedPoiMarkerProps {
  coordinate: Coordinate;
  name: string;
  onPress?: () => void;
}

export const AnimatedPoiMarker: React.FC<AnimatedPoiMarkerProps> = ({
  coordinate,
  name,
  onPress,
}) => {
  // 1. Entrance drop & scale animation
  const dropAnim = useRef(new Animated.Value(-40)).current;
  const scaleAnim = useRef(new Animated.Value(0.2)).current;
  const hoverAnim = useRef(new Animated.Value(0)).current;

  // 2. Continuous pulsing radar wave animations
  const waveScale1 = useRef(new Animated.Value(0.8)).current;
  const waveOpacity1 = useRef(new Animated.Value(0.8)).current;
  const waveScale2 = useRef(new Animated.Value(0.8)).current;
  const waveOpacity2 = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // A. Entrance spring drop
    Animated.parallel([
      Animated.spring(dropAnim, {
        toValue: 0,
        tension: 90,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // B. Gentle floating hover bob
      Animated.loop(
        Animated.sequence([
          Animated.timing(hoverAnim, { toValue: -4, duration: 900, useNativeDriver: true }),
          Animated.timing(hoverAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    });

    // C. Pulse wave 1
    const waveLoop1 = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(waveScale1, { toValue: 2.2, duration: 1600, useNativeDriver: true }),
          Animated.timing(waveOpacity1, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.timing(waveScale1, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        Animated.timing(waveOpacity1, { toValue: 0.8, duration: 0, useNativeDriver: true }),
      ])
    );
    waveLoop1.start();

    // D. Pulse wave 2 (offset by 800ms)
    const timeout = setTimeout(() => {
      const waveLoop2 = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(waveScale2, { toValue: 2.2, duration: 1600, useNativeDriver: true }),
            Animated.timing(waveOpacity2, { toValue: 0, duration: 1600, useNativeDriver: true }),
          ]),
          Animated.timing(waveScale2, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(waveOpacity2, { toValue: 0.8, duration: 0, useNativeDriver: true }),
        ])
      );
      waveLoop2.start();
    }, 800);

    return () => {
      clearTimeout(timeout);
    };
  }, [coordinate.latitude, coordinate.longitude]);

  const category = detectPoiCategory(name);

  return (
    <Marker
      coordinate={coordinate}
      zIndex={50}
      anchor={{ x: 0.5, y: 0.88 }}
      onPress={onPress}
    >
      <View style={styles.wrapper}>
        {/* Radar Pulse Wave 1 */}
        <Animated.View
          style={[
            styles.pulseWave,
            {
              opacity: waveOpacity1,
              transform: [{ scale: waveScale1 }],
            },
          ]}
        />

        {/* Radar Pulse Wave 2 */}
        <Animated.View
          style={[
            styles.pulseWave,
            {
              opacity: waveOpacity2,
              transform: [{ scale: waveScale2 }],
            },
          ]}
        />

        {/* Dropping & Hovering Venue Pin */}
        <Animated.View
          style={[
            styles.pinContainer,
            {
              transform: [
                { translateY: Animated.add(dropAnim, hoverAnim) },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          {/* Glowing Pin Bubble */}
          <View style={styles.pinBubble}>
            <Text style={styles.pinEmoji}>{category.emoji}</Text>
          </View>

          {/* Pointer Triangle Arrow */}
          <View style={styles.pinArrow} />
        </Animated.View>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: 60,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseWave: {
    position: 'absolute',
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.9)',
  },
  pinContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  pinBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  pinEmoji: {
    fontSize: 22,
  },
  pinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2563eb',
    alignSelf: 'center',
    marginTop: -1,
  },
});

