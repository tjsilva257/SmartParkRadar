// Floating map chrome: the top-right control capsule and the browse-mode speed camera pill.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CameraWarning } from '../types';
import { radius, spring, tabular, text, useTheme } from '../theme';
import { formatDistance } from '../lib/geo';
import { cameraGlyph, cameraUsesSign } from './glyphs';
import { Glass, Hairline, Icon, IconBadge, IconName, SpeedSign, withAlpha } from './ui';

const SIZE = 44;
const RIGHT = 10;
const GAP = 8;
// Keep the centered pill clear of the control column on both sides.
const PILL_SIDE = RIGHT + SIZE + GAP;

function ControlButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name={icon} size={21} color={color} />
    </Pressable>
  );
}

export function MapControls({
  top,
  onOpenSettings,
  onRecenter,
  onReport,
  centered,
}: {
  top: number;
  onOpenSettings: () => void;
  onRecenter: () => void;
  onReport: () => void;
  centered: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, ...spring.snappy }).start();
  }, [appear]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.column,
        {
          top,
          opacity: appear,
          transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
        },
      ]}
    >
      <Glass material="control" radius={radius.control} style={styles.capsule}>
        <ControlButton icon="map" color={theme.secondaryLabel} label="Choose Map" onPress={onOpenSettings} />
        <Hairline />
        <ControlButton
          icon={centered ? 'navigate' : 'navigate-outline'}
          color={theme.blue}
          label="Show My Location"
          onPress={onRecenter}
        />
      </Glass>
      <Glass material="control" radius={SIZE / 2} style={styles.capsule}>
        <ControlButton icon="warning" color={theme.orange} label="Report an Incident" onPress={onReport} />
      </Glass>
    </Animated.View>
  );
}

export function RadarPill({ warning, top }: { warning: CameraWarning; top: number }): React.JSX.Element {
  const theme = useTheme();
  const { camera, distanceMeters, isUrgent } = warning;
  const glyph = cameraGlyph(camera.type);
  const showSign = cameraUsesSign(camera.type) && camera.speedLimit > 0;

  const drop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  // Drop in again whenever a different camera becomes the nearest one.
  useEffect(() => {
    drop.setValue(0);
    Animated.spring(drop, { toValue: 1, useNativeDriver: true, ...spring.bouncy }).start();
  }, [camera.id, drop]);

  useEffect(() => {
    if (!isUrgent) return;
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 500, easing: ease, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: ease, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(1);
    };
  }, [isUrgent, pulse]);

  const distance = formatDistance(distanceMeters);
  const pillRadius = 24;

  return (
    <View pointerEvents="none" style={[styles.pillTrack, { top }]}>
      <Animated.View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${glyph.label} in ${distance}, ${camera.name}`}
        style={{
          maxWidth: '100%',
          opacity: drop.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [
            { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
            { scale: pulse },
          ],
        }}
      >
        <Glass material="control" radius={pillRadius}>
          {isUrgent && (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: pillRadius,
                  backgroundColor: withAlpha(theme.red, 0.18),
                  borderWidth: 1,
                  borderColor: withAlpha(theme.red, 0.55),
                },
              ]}
            />
          )}
          <View style={styles.pillContent}>
            {showSign ? (
              <SpeedSign limit={camera.speedLimit} size={26} />
            ) : (
              <IconBadge icon={glyph.icon} color={theme[glyph.color]} size={26} />
            )}
            <View style={{ flexShrink: 1 }}>
              <Text
                style={[text.subhead, tabular, { fontWeight: '600', color: isUrgent ? theme.red : theme.label }]}
                numberOfLines={1}
              >
                {glyph.label} · {distance}
              </Text>
              <Text style={[text.footnote, { color: theme.secondaryLabel }]} numberOfLines={1}>
                {camera.name}
              </Text>
            </View>
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', right: RIGHT, gap: GAP },
  capsule: { width: SIZE },
  button: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  pillTrack: { position: 'absolute', left: PILL_SIDE, right: PILL_SIDE, alignItems: 'center' },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 7,
  },
});
