// Everything drawn inside <MapView>: route lines, place pin, parking area,
// speed cameras, hazards, the navigation puck and the scratch-map fog.
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import { Marker, Polygon, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type {
  Coordinate,
  ExploredGeometry,
  ParkingSpot,
  Place,
  RoadHazard,
  RouteOption,
  SpeedCamera,
  TravelPhase,
} from '../types';
import { smallShadow, spring, useTheme } from '../theme';
import { formatHectometer } from '../services/hectometer';
import { poiCategoryFor } from '../services/places';
import { exploredHoles } from '../services/scratchMap';
import { cameraGlyph, cameraUsesSign, hazardGlyph, parkingGlyph, poiGlyph } from './glyphs';
import { Icon, IconBadge, IconName, resolveColor, SpeedSign, withAlpha } from './ui';

const WHITE = '#FFFFFF';
const HECTO_GREEN = '#0B6E3B'; // Rijkswaterstaat sign green, same as the report sheet's post
// Views below are built to sit centered on their coordinate; Google Maps defaults to bottom-center.
const CENTER = { x: 0.5, y: 0.5 };
// Android takes dash/gap lengths in raw pixels (iOS in points), while strokeWidth is density-scaled.
const dp = (n: number) => (Platform.OS === 'android' ? n * PixelRatio.get() : n);
const WALK_DASH = [1, dp(10)];
const STALL_DASH = [dp(3), dp(3)];

// ---------- tracksViewChanges ----------

// Android's Google Maps rasterises a custom marker view into a bitmap. Tracking has to be on while
// the view first lays out (or it stays blank), while it animates and when its content changes, and
// off otherwise (or every marker re-rasterises continuously). Apple Maps on iOS ignores the prop.
// Glyphs drawn before the icon font has loaded would be frozen blank, so font readiness counts as
// a content change.
let iconFontReady = false;
const iconFont = Ionicons.loadFont().then(
  () => {
    iconFontReady = true;
  },
  () => {
    iconFontReady = true;
  }
);

function useTracksViewChanges(signature: string, ms = 500): boolean {
  const [fontReady, setFontReady] = useState(iconFontReady);
  useEffect(() => {
    if (!fontReady) iconFont.then(() => setFontReady(true));
  }, [fontReady]);

  const key = `${signature}|${fontReady}`;
  const [state, setState] = useState({ key, tracking: true });
  // Adjust during render so the changed view is never committed with tracking off.
  if (state.key !== key) setState({ key, tracking: true });
  useEffect(() => {
    if (!state.tracking) return;
    const timer = setTimeout(() => setState((s) => ({ ...s, tracking: false })), ms);
    return () => clearTimeout(timer);
  }, [state, ms]);
  return state.tracking || state.key !== key;
}

/** Darker shade of a "#RRGGBB" colour (route casing). */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const channel = (shift: number) =>
    Math.round(((n >> shift) & 255) * (1 - amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Glyph-in-circle with the white 2 pt map-marker border. */
function GlyphMarker({ icon, color, size }: { icon: IconName; color: string; size: number }) {
  return (
    <View style={[{ borderRadius: size / 2, borderWidth: 2, borderColor: WHITE, backgroundColor: color }, smallShadow]}>
      <IconBadge icon={icon} color={color} size={size - 4} />
    </View>
  );
}

// ---------- Routes ----------

export function RouteLines({
  routes,
  selectedId,
  walkPath,
  navigating,
  onSelectRoute,
}: {
  routes: RouteOption[];
  selectedId: string | null;
  walkPath: Coordinate[];
  navigating: boolean;
  onSelectRoute: (id: string) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const selected = routes.find((r) => r.id === selectedId) ?? routes[0];
  return (
    <>
      {!navigating &&
        routes
          .filter((r) => r !== selected && r.coordinates.length > 1)
          .map((r) => (
            <Polyline
              key={`alt-${r.id}`}
              coordinates={r.coordinates}
              strokeColor={theme.routeAlt}
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
              tappable
              onPress={() => onSelectRoute(r.id)}
              zIndex={10}
            />
          ))}
      {selected && selected.coordinates.length > 1 && (
        <>
          <Polyline
            key={`casing-${selected.id}`}
            coordinates={selected.coordinates}
            strokeColor={darken(theme.routeMain, 0.35)}
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
            zIndex={20}
          />
          <Polyline
            key={`main-${selected.id}`}
            coordinates={selected.coordinates}
            strokeColor={theme.routeMain}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
            zIndex={21}
          />
        </>
      )}
      {walkPath.length > 1 && (
        <Polyline
          coordinates={walkPath}
          strokeColor={theme.routeWalk}
          strokeWidth={5}
          lineDashPattern={WALK_DASH}
          lineCap="round"
          zIndex={22}
        />
      )}
    </>
  );
}

// ---------- Place pin ----------

const PIN = { head: 30, ball: 38, tail: 8, width: 44 }; // head = room for the drop-in inside the bitmap
const PIN_TIP = PIN.head + PIN.ball + PIN.tail - 1;
const PIN_H = PIN_TIP + 2;

export function PlacePin({ place, onPress }: { place: Place; onPress?: () => void }): React.JSX.Element {
  const theme = useTheme();
  const glyph = poiGlyph(place.poiCategory ?? poiCategoryFor(place.name));
  const color = resolveColor(theme, glyph.color);
  const { latitude, longitude } = place.coordinate;
  const drop = useRef(new Animated.Value(-PIN.head)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  // Covers the bouncy spring until it is visually settled.
  const tracking = useTracksViewChanges(`${latitude},${longitude},${glyph.icon},${color}`, 700);

  useEffect(() => {
    drop.setValue(-PIN.head);
    scale.setValue(0.3);
    const anim = Animated.parallel([
      Animated.spring(drop, { toValue: 0, useNativeDriver: true, ...spring.bouncy }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...spring.bouncy }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [latitude, longitude, drop, scale]);

  return (
    <Marker
      coordinate={place.coordinate}
      onPress={onPress}
      stopPropagation
      tracksViewChanges={tracking}
      anchor={{ x: 0.5, y: PIN_TIP / PIN_H }}
      centerOffset={{ x: 0, y: PIN_H / 2 - PIN_TIP }}
      zIndex={50}
    >
      <View style={styles.pinBox}>
        <View style={[styles.pinDot, { backgroundColor: withAlpha(theme.shadow, 0.3) }]} />
        <Animated.View style={[styles.pin, { transform: [{ translateY: drop }, { scale }] }]}>
          <View style={[styles.pinBall, { backgroundColor: color }, smallShadow]}>
            <Icon name={glyph.icon} size={20} color={WHITE} />
          </View>
          <View style={[styles.pinTail, { borderTopColor: color }]} />
        </Animated.View>
      </View>
    </Marker>
  );
}

// ---------- Parking ----------

const PARKING_LABEL_H = 16;

export function ParkingOverlay({ spot, onPress }: { spot: ParkingSpot; onPress?: () => void }): React.JSX.Element {
  const theme = useTheme();
  const color = resolveColor(theme, parkingGlyph(spot.type).color);
  const tracking = useTracksViewChanges(`${spot.priceLabel},${color},${theme.background}`);
  return (
    <>
      {spot.polygon && spot.polygon.length >= 3 && (
        <Polygon
          coordinates={spot.polygon}
          fillColor={withAlpha(color, 0.22)}
          strokeColor={color}
          strokeWidth={2}
          zIndex={18}
        />
      )}
      {spot.stallLines?.map(([a, b], i) => (
        <Polyline
          key={`${spot.id}-stall-${i}`}
          coordinates={[a, b]}
          strokeColor={WHITE}
          strokeWidth={1}
          lineDashPattern={STALL_DASH}
          lineCap="butt"
          zIndex={19}
        />
      ))}
      <Marker
        coordinate={spot.coordinate}
        onPress={onPress}
        stopPropagation
        tracksViewChanges={tracking}
        anchor={CENTER}
        zIndex={30}
      >
        {/* Top padding mirrors the label so the square, not the whole view, sits on the coordinate. */}
        <View style={{ alignItems: 'center', paddingTop: PARKING_LABEL_H }}>
          <View style={[styles.parkingSquare, { backgroundColor: color }, smallShadow]}>
            <Text style={styles.parkingP}>P</Text>
          </View>
          <Text
            numberOfLines={1}
            // The raw system green/orange is ~2.2:1 on light tiles; darken it like Apple's map labels.
            style={[styles.parkingLabel, { color: theme.dark ? color : darken(color, 0.35), textShadowColor: theme.background }]}
          >
            {spot.priceLabel}
          </Text>
        </View>
      </Marker>
    </>
  );
}

// ---------- Speed cameras ----------

export function CameraMarkers({
  cameras,
  onPress,
}: {
  cameras: SpeedCamera[];
  onPress: (c: SpeedCamera) => void;
}): React.JSX.Element {
  return (
    <>
      {cameras.map((c) => (
        <CameraMarker key={c.id} camera={c} onPress={onPress} />
      ))}
    </>
  );
}

const CameraMarker = memo(function CameraMarker({
  camera,
  onPress,
}: {
  camera: SpeedCamera;
  onPress: (c: SpeedCamera) => void;
}) {
  const theme = useTheme();
  const glyph = cameraGlyph(camera.type);
  const color = resolveColor(theme, glyph.color);
  // A sign needs a number; cameras without a known limit fall back to their glyph.
  const sign = cameraUsesSign(camera.type) && camera.speedLimit > 0;
  const tracking = useTracksViewChanges(`${sign ? camera.speedLimit : glyph.icon},${color}`);
  return (
    <Marker
      coordinate={camera.coordinate}
      onPress={() => onPress(camera)}
      stopPropagation
      tracksViewChanges={tracking}
      anchor={CENTER}
      zIndex={28}
    >
      {sign ? <SpeedSign limit={camera.speedLimit} size={26} /> : <GlyphMarker icon={glyph.icon} color={color} size={26} />}
    </Marker>
  );
});

// ---------- Hazards ----------

const HECTO_LABEL_H = 18;

export function HazardMarkers({
  hazards,
  onPress,
}: {
  hazards: RoadHazard[];
  onPress: (h: RoadHazard) => void;
}): React.JSX.Element {
  return (
    <>
      {hazards.map((h) => (
        <HazardMarker key={h.id} hazard={h} onPress={onPress} />
      ))}
    </>
  );
}

const HazardMarker = memo(function HazardMarker({
  hazard,
  onPress,
}: {
  hazard: RoadHazard;
  onPress: (h: RoadHazard) => void;
}) {
  const theme = useTheme();
  const glyph = hazardGlyph(hazard.category);
  const color = resolveColor(theme, glyph.color);
  const post = hazard.hectometerPost ? formatHectometer(hazard.hectometerPost) : null;
  const tracking = useTracksViewChanges(`${glyph.icon},${color},${post}`);
  return (
    <Marker
      coordinate={hazard.coordinate}
      onPress={() => onPress(hazard)}
      stopPropagation
      tracksViewChanges={tracking}
      anchor={CENTER}
      zIndex={30}
    >
      {/* Top padding mirrors the post label so the badge itself sits on the coordinate. */}
      <View style={{ alignItems: 'center', paddingTop: post ? HECTO_LABEL_H : 0 }}>
        <GlyphMarker icon={glyph.icon} color={color} size={28} />
        {post && (
          <View style={styles.hecto}>
            <Text style={styles.hectoText} numberOfLines={1}>
              {post}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
});

// ---------- Navigation puck ----------

export function VehiclePuck({
  position,
  phase,
}: {
  position: Coordinate;
  phase: TravelPhase | 'arrived';
}): React.JSX.Element {
  const theme = useTheme();
  const driving = phase === 'driving';
  const dot = driving ? 36 : 22;
  const halo = driving ? 60 : 40;
  // Only the look depends on these; position changes move the native marker without a redraw.
  const tracking = useTracksViewChanges(`${driving},${theme.blue}`);
  return (
    <Marker
      coordinate={position}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={false}
      tracksViewChanges={tracking}
      zIndex={40}
    >
      <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: halo / 2, backgroundColor: withAlpha(theme.blue, 0.2) },
          ]}
        />
        <View
          style={[
            styles.puck,
            { width: dot, height: dot, borderRadius: dot / 2, backgroundColor: theme.blue },
            smallShadow,
          ]}
        >
          {driving && (
            // The camera follows the heading, so "ahead" is always up; the glyph itself points north-east.
            <View style={{ transform: [{ rotate: '-45deg' }] }}>
              <Icon name="navigate" size={18} color={WHITE} />
            </View>
          )}
        </View>
      </View>
    </Marker>
  );
}

// ---------- Scratch map ----------

// The whole navigable globe; explored areas are cut out as holes. The 0° vertices stop
// the polygon from wrapping the short way around the antimeridian.
const WORLD_MASK: Coordinate[] = [
  { latitude: 84.9, longitude: -179.99 },
  { latitude: 84.9, longitude: 0 },
  { latitude: 84.9, longitude: 179.99 },
  { latitude: -84.9, longitude: 179.99 },
  { latitude: -84.9, longitude: 0 },
  { latitude: -84.9, longitude: -179.99 },
  { latitude: 84.9, longitude: -179.99 },
];

export const ScratchFog = memo(function ScratchFog({
  geometry,
}: {
  geometry: ExploredGeometry;
}): React.JSX.Element | null {
  const theme = useTheme();
  // Native maps reject degenerate rings.
  const holes = useMemo(() => exploredHoles(geometry).filter((ring) => ring.length >= 3), [geometry]);
  return (
    <Polygon
      coordinates={WORLD_MASK}
      holes={holes}
      fillColor={theme.fog}
      strokeColor="transparent"
      strokeWidth={0}
      zIndex={5}
    />
  );
});

const styles = StyleSheet.create({
  pinBox: { width: PIN.width, height: PIN_H },
  pinDot: { position: 'absolute', top: PIN_TIP - 2, left: PIN.width / 2 - 5, width: 10, height: 4, borderRadius: 5 },
  pin: { position: 'absolute', top: PIN.head, left: (PIN.width - PIN.ball) / 2, width: PIN.ball, alignItems: 'center' },
  pinBall: {
    width: PIN.ball,
    height: PIN.ball,
    borderRadius: PIN.ball / 2,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: PIN.tail,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  parkingSquare: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingP: { color: WHITE, fontSize: 15, fontWeight: '800', includeFontPadding: false },
  parkingLabel: {
    marginTop: 2,
    height: PARKING_LABEL_H - 2,
    lineHeight: PARKING_LABEL_H - 2,
    fontSize: 11,
    fontWeight: '700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  hecto: {
    marginTop: 3,
    height: HECTO_LABEL_H - 3,
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: WHITE,
    backgroundColor: HECTO_GREEN,
  },
  hectoText: { color: WHITE, fontSize: 9, lineHeight: 11, fontWeight: '800', includeFontPadding: false },
  puck: { borderWidth: 3, borderColor: WHITE, alignItems: 'center', justifyContent: 'center' },
});
