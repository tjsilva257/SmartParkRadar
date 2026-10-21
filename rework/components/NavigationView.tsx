// Apple Maps turn-by-turn overlay: dark guidance banner, speed cluster, floating trip card.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraWarning, Maneuver, ManeuverKind, ParkingSpot, Place, TripState } from '../types';
import { formatArrival, formatDistance } from '../lib/geo';
import { shadow, smallShadow, spacing, spring, tabular, text, useTheme } from '../theme';
import { AppleSwitch, Button, Icon, IconBadge, InsetGroup, Row, SpeedSign, resolveColor, withAlpha } from './ui';
import { Sheet } from './Sheet';
import { cameraGlyph, cameraUsesSign, facilityLabel, maneuverGlyph, parkingGlyph, poiGlyph } from './glyphs';

// Collapsed = grabber + stats row; expanded fits the controls, both stops and End Route.
const DETENTS = [92, 392];
const CLUSTER_GAP = 12;

// For plain turns Apple shows just the street; complex maneuvers keep the full instruction.
const STREET_ONLY = new Set<ManeuverKind>([
  'depart',
  'straight',
  'left',
  'right',
  'slight-left',
  'slight-right',
  'sharp-left',
  'sharp-right',
]);
const bannerText = (m: Maneuver) => (m.street && STREET_ONLY.has(m.kind) ? m.street : m.instruction);

function TurnGlyph({ kind, size, color }: { kind: ManeuverKind; size: number; color: string }) {
  const g = maneuverGlyph(kind);
  return (
    <View style={{ transform: [{ rotate: `${g.rotate}deg` }] }}>
      <Icon name={g.icon} size={size} color={color} />
    </View>
  );
}

function remainingTime(seconds: number): { value: string; label: string } {
  const mins = Math.max(0, Math.ceil(seconds / 60));
  if (mins < 60) return { value: String(mins), label: 'min' };
  return { value: `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`, label: 'hr' };
}

function remainingDistance(meters: number): { value: string; label: string } {
  if (meters < 1000) return { value: String(Math.round(meters / 10) * 10), label: 'm' };
  return { value: (meters / 1000).toFixed(meters < 10000 ? 1 : 0), label: 'km' };
}

function CameraStrip({ warning }: { warning: CameraWarning }) {
  const theme = useTheme();
  const { camera } = warning;
  const g = cameraGlyph(camera.type);
  const white = theme.navBannerText;
  return (
    <View
      style={[styles.strip, shadow, { backgroundColor: warning.isUrgent ? theme.red : theme.navBanner }]}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${g.label} in ${formatDistance(warning.distanceMeters)}, ${camera.name}`}
    >
      {cameraUsesSign(camera.type) && camera.speedLimit > 0 ? (
        <SpeedSign limit={camera.speedLimit} size={30} />
      ) : (
        <IconBadge icon={g.icon} color={resolveColor(theme, g.color)} size={30} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[text.headline, tabular, { color: white }]} numberOfLines={1}>
          {g.label} · {formatDistance(warning.distanceMeters)}
        </Text>
        <Text style={[text.footnote, { color: withAlpha(white, 0.75) }]} numberOfLines={1}>
          {camera.name}
        </Text>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[text.title2, tabular, { color: theme.label }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[text.footnote, { color: theme.secondaryLabel }]}>{label}</Text>
    </View>
  );
}

export function NavigationView({
  trip,
  destination,
  parking,
  voiceMuted,
  onToggleVoice,
  onEnd,
  onReport,
  onCycleSpeedTest,
}: {
  trip: TripState;
  destination: Place;
  parking: ParkingSpot | null;
  voiceMuted: boolean;
  onToggleVoice: () => void;
  onEnd: () => void;
  onReport: () => void;
  onCycleSpeedTest: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [cardIndex, setCardIndex] = useState(0);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, ...spring.snappy }).start();
  }, [enter]);

  // The speed cluster rides just above the trip card as it changes detent.
  const initialCard = DETENTS[0] + Math.max(insets.bottom - spacing.sheetMargin, 0) + spacing.sheetMargin;
  const lift = useRef(new Animated.Value(-(initialCard + CLUSTER_GAP))).current;
  const onCardHeight = (h: number) => {
    Animated.spring(lift, { toValue: -(h + CLUSTER_GAP), useNativeDriver: true, ...spring.snappy }).start();
  };

  const arrived = trip.phase === 'arrived';
  const driving = trip.phase === 'driving';
  const white = theme.navBannerText;
  const dim = withAlpha(white, 0.72);
  const next = trip.nextManeuver;
  const then = !arrived ? trip.thenManeuver : null;
  const distanceLabel = arrived ? 'Arrived' : formatDistance(trip.distanceToManeuver);
  const detail = arrived ? destination.name : bannerText(next);
  const over = trip.alert.level !== 'ok';

  const time = remainingTime(trip.remainingSeconds);
  const dist = remainingDistance(trip.remainingMeters);
  const caption = driving
    ? `Driving to ${parking?.title ?? 'parking'}`
    : arrived
    ? `You have arrived at ${destination.name}`
    : `Walking to ${destination.name}`;

  const parkingG = parking ? parkingGlyph(parking.type) : null;
  const destG = poiGlyph(destination.poiCategory);

  const header = arrived ? (
    <View style={styles.arrivedHeader}>
      <IconBadge icon="flag" color={theme.green} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[text.headline, { color: theme.label }]}>Arrived</Text>
        <Text style={[text.footnote, { color: theme.secondaryLabel }]} numberOfLines={1}>
          {destination.name}
        </Text>
      </View>
      <Button title="Done" color="green" size="medium" onPress={onEnd} />
    </View>
  ) : (
    <View style={styles.statsHeader}>
      <View style={{ flexDirection: 'row' }}>
        <Stat value={formatArrival(trip.remainingSeconds)} label="arrival" />
        <Stat value={time.value} label={time.label} />
        <Stat value={dist.value} label={dist.label} />
      </View>
      <Text style={[text.caption1, { color: theme.secondaryLabel, textAlign: 'center', marginTop: 4 }]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: insets.top + 4,
          left: spacing.sheetMargin,
          right: spacing.sheetMargin,
          gap: 8,
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }],
        }}
      >
        <View style={[{ borderRadius: 24 }, shadow]}>
          <View
            style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: theme.navBanner }}
            accessible
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${distanceLabel}, ${detail}`}
          >
            <View style={styles.bannerMain}>
              <View style={styles.bannerGlyph}>
                <TurnGlyph kind={arrived ? 'arrive' : next.kind} size={40} color={white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.title1, tabular, { color: white }]} numberOfLines={1}>
                  {distanceLabel}
                </Text>
                <Text style={[text.title3, { color: white }]} numberOfLines={2}>
                  {detail}
                </Text>
              </View>
            </View>
            {then && (
              <View style={[styles.thenStrip, { backgroundColor: withAlpha(theme.shadow, 0.3) }]}>
                <Text style={[text.subhead, { fontWeight: '600', color: dim }]}>Then</Text>
                <TurnGlyph kind={then.kind} size={18} color={white} />
              </View>
            )}
          </View>
        </View>

        {trip.cameraWarning && <CameraStrip warning={trip.cameraWarning} />}

        {trip.alert.level === 'fine' && (
          <View
            style={[styles.strip, shadow, { backgroundColor: theme.red }]}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={`Slow down. ${trip.alert.overBy} kilometers per hour over the limit.`}
          >
            <Icon name="speedometer" size={26} color={white} />
            <View style={{ flex: 1 }}>
              <Text style={[text.headline, { color: white }]}>Slow down</Text>
              <Text style={[text.footnote, tabular, { color: dim }]} numberOfLines={1}>
                +{trip.alert.overBy} km/h · fine about €{trip.alert.fineEur}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Like Apple Maps, the cluster only rides the collapsed card; expanded it would cover the strips. */}
      {driving && cardIndex === 0 && (
        <Animated.View pointerEvents="box-none" style={[styles.speedCluster, { transform: [{ translateY: lift }] }]}>
          {trip.speedLimit > 0 && <SpeedSign limit={trip.speedLimit} size={52} />}
          <Pressable
            onPress={onCycleSpeedTest}
            accessibilityRole="button"
            accessibilityLabel={`Current speed ${Math.round(trip.speed)} kilometers per hour`}
            accessibilityHint="Cycles a test speed to preview speeding alerts"
            style={({ pressed }) => [styles.speedBubble, smallShadow, { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.speedValue, tabular, { color: over ? theme.red : theme.label }]}>{Math.round(trip.speed)}</Text>
            <Text style={[text.caption2, { color: theme.secondaryLabel, marginTop: -2 }]}>km/h</Text>
          </Pressable>
        </Animated.View>
      )}

      <Sheet detents={DETENTS} index={cardIndex} onIndexChange={setCardIndex} onHeightChange={onCardHeight} header={header}>
        <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
          <InsetGroup>
            <Row
              leading={<IconBadge icon={voiceMuted ? 'volume-mute' : 'volume-high'} color={voiceMuted ? theme.gray : theme.blue} />}
              title="Audio"
              onPress={onToggleVoice}
              trailing={<AppleSwitch value={!voiceMuted} onValueChange={onToggleVoice} accessibilityLabel="Audio" />}
              separator
            />
            <Row icon="warning" iconColor={theme.orange} title="Report an Incident" onPress={onReport} chevron />
          </InsetGroup>

          <InsetGroup style={{ marginTop: 12 }}>
            {parking && parkingG && (
              <Row
                leading={<IconBadge icon={parkingG.icon} color={resolveColor(theme, parkingG.color)} />}
                title={parking.title}
                subtitle={`${parking.priceLabel} · ${facilityLabel(parking.facility)}`}
                trailing={!driving ? <Icon name="checkmark-circle" size={22} color={theme.green} /> : undefined}
                separator
              />
            )}
            <Row
              leading={<IconBadge icon={destG.icon} color={resolveColor(theme, destG.color)} />}
              title={destination.name}
              subtitle={destination.subtitle || destG.label}
              trailing={arrived ? <Icon name="checkmark-circle" size={22} color={theme.green} /> : undefined}
            />
          </InsetGroup>

          <Button
            title={arrived ? 'Done' : 'End Route'}
            color={arrived ? 'green' : 'red'}
            onPress={onEnd}
            style={{ marginHorizontal: spacing.gutter, marginTop: 16 }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerGlyph: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thenStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  speedCluster: {
    position: 'absolute',
    left: spacing.sheetMargin + 8,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  speedBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedValue: {
    fontSize: 20,
    fontWeight: '700',
    includeFontPadding: false,
  },
  statsHeader: {
    paddingHorizontal: spacing.gutter,
    paddingTop: 2,
    paddingBottom: 10,
  },
  arrivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.gutter,
    paddingTop: 2,
    paddingBottom: 12,
  },
});
