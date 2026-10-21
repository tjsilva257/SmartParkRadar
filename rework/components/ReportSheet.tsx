// Apple Maps-style "Report" sheet: pick what happened, say where (GPS, a Dutch
// highway hectometer post or a street), add an optional comment, send.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import type {
  Carriageway,
  Coordinate,
  HazardCategory,
  HectometerMatch,
  HectometerPosition,
  NewHazardReport,
} from '../types';
import { tabular, text, useTheme } from '../theme';
import { formatDistance } from '../lib/geo';
import {
  detectHectometer,
  detectHectometerLive,
  formatHectometer,
  highwayName,
  POPULAR_HIGHWAYS,
  resolveHectometer,
} from '../services/hectometer';
import { reverseGeocode, searchPlaces } from '../services/places';
import { HAZARD_CATEGORIES, hazardGlyph } from './glyphs';
import { Button, CloseButton, GroupLabel, Icon, IconBadge, InsetGroup, resolveColor, Row, Segmented, withAlpha } from './ui';
import { Sheet } from './Sheet';

interface ReportSheetProps {
  visible: boolean;
  userLocation: Coordinate;
  /** false while userLocation is only a fallback coordinate (no GPS fix). */
  locationKnown: boolean;
  onClose: () => void;
  onSubmit: (report: NewHazardReport) => void;
}

type LocationMode = 'current' | 'highway' | 'street';

const LOCATION_MODES: { value: LocationMode; label: string }[] = [
  { value: 'current', label: 'Current Location' },
  { value: 'highway', label: 'Highway Post' },
  { value: 'street', label: 'Street' },
];

const CARRIAGEWAYS: { value: Carriageway; label: string }[] = [
  { value: 'Li', label: 'Left (Li)' },
  { value: 'Re', label: 'Right (Re)' },
];

// Real Rijkswaterstaat sign colours: a road sign, deliberately not themed.
const SIGN = {
  plate: '#0B6E3B',
  white: '#FFFFFF',
  aRoad: '#E3001B',
  nRoad: '#FFD200',
  nText: '#000000',
  faded: 'rgba(255,255,255,0.8)',
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const parseHecto = (s: string) => Math.max(0, round1(parseFloat(s.replace(',', '.')) || 0));
const sideOf = (c: Carriageway): Carriageway => (c === 'Re' ? 'Re' : 'Li');

export function ReportSheet(props: ReportSheetProps): React.JSX.Element | null {
  const { visible, onClose } = props;
  // The Modal unmounts its children once hidden, so every opening starts with a fresh form.
  // Its own SafeAreaProvider: a Modal is a separate native window and would otherwise report zero insets.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ReportForm {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ReportForm({ visible, userLocation, locationKnown, onClose, onSubmit }: ReportSheetProps) {
  const theme = useTheme();
  const { height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [category, setCategory] = useState<HazardCategory>(HAZARD_CATEGORIES[0]);
  // Instant local guess so the sheet opens on the right mode; PDOK refines it below.
  const [match, setMatch] = useState<HectometerMatch | null>(() => detectHectometer(userLocation));
  const [mode, setMode] = useState<LocationMode>(match ? 'highway' : 'current');
  const [road, setRoad] = useState(match?.road ?? 'A10');
  const [hectoText, setHectoText] = useState((match?.hectometer ?? 14.2).toFixed(1));
  const [carriageway, setCarriageway] = useState<Carriageway>(sideOf(match?.carriageway ?? 'Li'));
  const [street, setStreet] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  // Once the user touches the location fields, a late PDOK answer must not overwrite them.
  const edited = useRef(false);
  const mounted = useRef(true);
  // iOS keeps the form mounted through the Modal's fade-out, so `mounted` alone can't tell a cancel.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const [androidFocus, setAndroidFocus] = useState(false);

  const hectometer = parseHecto(hectoText);
  const touch = () => {
    edited.current = true;
  };
  const fill = (m: HectometerMatch) => {
    setRoad(m.road);
    setHectoText(m.hectometer.toFixed(1));
    setCarriageway(sideOf(m.carriageway));
  };

  useEffect(() => {
    mounted.current = true;
    detectHectometerLive(userLocation)
      .then((m) => {
        if (!mounted.current || !m) return;
        setMatch(m);
        if (!edited.current) {
          fill(m);
          setMode('highway');
        }
      })
      .catch(() => {});
    // Android draws edge-to-edge, so the keyboard overlaps the sheet instead of resizing it;
    // pad the scroll content so the inputs can be scrolled above it. iOS adjusts insets natively.
    const subs =
      Platform.OS === 'ios'
        ? []
        : [
            Keyboard.addListener('keyboardDidShow', (e) => setKeyboardInset(e.endCoordinates.height)),
            Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0)),
          ];
    return () => {
      mounted.current = false;
      subs.forEach((s) => s.remove());
    };
    // Once per opening: later GPS fixes must not reset what the user is editing.
  }, []);

  const detect = async () => {
    setDetecting(true);
    const m = await detectHectometerLive(userLocation).catch(() => null);
    if (!mounted.current) return;
    setDetecting(false);
    if (!m) {
      Alert.alert(
        'No Highway Nearby',
        "You're not within 850 m of a Dutch motorway. Choose a road and post number yourself, or report by street."
      );
      return;
    }
    touch();
    setMatch(m);
    fill(m);
  };

  const submit = async () => {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    const base = { category, title: hazardGlyph(category).label, note: note.trim() || undefined };
    let report: NewHazardReport;
    const query = street.trim();
    // Without a GPS fix "here" is only the fallback coordinate; don't publish a report there.
    if (!locationKnown && mode !== 'highway' && !(mode === 'street' && query)) {
      setBusy(false);
      Alert.alert(
        'Location Unavailable',
        'Your current location is not known yet. Report by highway post or street instead.'
      );
      return;
    }
    if (mode === 'highway') {
      const post: HectometerPosition = { road, hectometer, carriageway, description: highwayName(road) };
      const coordinate = await resolveHectometer(road, hectometer, carriageway, userLocation).catch(() => userLocation);
      report = { ...base, roadName: formatHectometer(post), hectometerPost: post, coordinate };
    } else if (mode === 'street' && query) {
      const [hit] = await searchPlaces(query, userLocation).catch(() => []);
      report = hit
        ? { ...base, roadName: hit.city ? `${hit.name}, ${hit.city}` : hit.name, coordinate: hit.coordinate }
        : { ...base, roadName: query, coordinate: userLocation };
    } else {
      // Name the street for other drivers; don't hold the report hostage to a slow geocoder.
      const here = await Promise.race([
        reverseGeocode(userLocation).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      report = { ...base, roadName: here?.subtitle || 'Current Location', coordinate: userLocation };
    }
    // Closed while resolving: treat as cancelled.
    if (!mounted.current || !visibleRef.current) return;
    onSubmit(report);
    onClose();
  };

  // Android: the edge-to-edge Modal never resizes for the keyboard and the ScrollView extends under it,
  // so the system sees the field as visible. Scroll it to the top of the sheet ourselves once the
  // keyboard is up; androidFocus pads the content in case keyboard events don't reach the Modal.
  const revealFocusedInput = () => {
    setAndroidFocus(true);
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!mounted.current || !input || !content) return;
      input.measureLayout(
        content,
        (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }),
        () => undefined
      );
    }, 300);
  };
  const bottomInset = Math.max(keyboardInset, androidFocus ? Math.round(screenH * 0.45) : 0);

  const inputProps = {
    placeholderTextColor: theme.tertiaryLabel,
    selectionColor: theme.blue,
    keyboardAppearance: theme.dark ? ('dark' as const) : ('light' as const),
    // More room above the keyboard on iOS; on Android the sheet would only be pushed off-screen.
    onFocus: () => {
      if (Platform.OS === 'ios') setIndex(1);
      else revealFocusedInput();
    },
    onBlur: () => Platform.OS === 'android' && setAndroidFocus(false),
  };
  const near = match ? ` · Near ${formatHectometer(match)}` : '';

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[text.title2, { color: theme.label }]}>Report</Text>
        <Text style={[text.subhead, { color: theme.secondaryLabel, marginTop: 2 }]}>
          Let other drivers know what's ahead
        </Text>
      </View>
      <CloseButton onPress={onClose} />
    </View>
  );

  const stepButton = (delta: number) => (
    <Pressable
      key={delta}
      onPress={() => {
        touch();
        setHectoText(Math.max(0, round1(hectometer + delta)).toFixed(1));
      }}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Plus' : 'Minus'} ${Math.abs(delta).toFixed(1)} kilometres`}
      style={({ pressed }) => [styles.step, { backgroundColor: theme.card, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[text.subhead, tabular, { color: theme.blue, fontWeight: '600' }]}>
        {delta > 0 ? '+' : '−'}
        {Math.abs(delta).toFixed(1)}
      </Text>
    </Pressable>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.shadow, 0.25) }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <Sheet
        detents={[Math.round(screenH * 0.7), Math.round(screenH * 0.92)]}
        index={index}
        onIndexChange={setIndex}
        onDismiss={onClose}
        header={header}
      >
        <ScrollView
          ref={scrollRef}
          // RN types this ref without `| null`.
          innerViewRef={contentRef as React.RefObject<View>}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 + bottomInset }}
        >
          <View style={styles.grid}>
            {HAZARD_CATEGORIES.map((c) => (
              <CategoryCell key={c} category={c} selected={c === category} onPress={() => setCategory(c)} />
            ))}
          </View>

          <GroupLabel>Location</GroupLabel>
          <Segmented
            options={LOCATION_MODES}
            value={mode}
            onChange={(m) => {
              touch();
              setMode(m);
            }}
            style={styles.inset}
          />

          {mode === 'current' && (
            <InsetGroup style={styles.gap}>
              <Row
                icon="location"
                iconColor={theme.blue}
                title="Current Location"
                subtitle={`${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}${near}`}
                numberOfLines={2}
              />
            </InsetGroup>
          )}

          {mode === 'highway' && (
            <>
              <HectometerSign road={road} carriageway={carriageway} hectometer={hectometer} />
              {match && (
                <Text style={[text.footnote, styles.caption, { color: theme.secondaryLabel, textAlign: 'center' }]}>
                  GPS: {formatHectometer(match)} · {formatDistance(match.distanceMeters)} away
                </Text>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chips}
              >
                {POPULAR_HIGHWAYS.map((code) => {
                  const selected = code === road;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => {
                        touch();
                        setRoad(code);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.chip,
                        { backgroundColor: selected ? theme.blue : theme.card, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={[text.subhead, { fontWeight: '600', color: selected ? '#FFFFFF' : theme.label }]}>
                        {code}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.stepper}>
                {stepButton(-1)}
                {stepButton(-0.1)}
                <TextInput
                  value={hectoText}
                  onChangeText={(t) => {
                    touch();
                    setHectoText(t.replace(/[^0-9.,]/g, ''));
                  }}
                  onEndEditing={() => setHectoText(hectometer.toFixed(1))}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  maxLength={6}
                  accessibilityLabel="Hectometer post"
                  style={[text.title3, tabular, styles.hectoInput, { color: theme.label, backgroundColor: theme.card }]}
                  {...inputProps}
                />
                {stepButton(0.1)}
                {stepButton(1)}
              </View>
              <Segmented
                options={CARRIAGEWAYS}
                value={carriageway}
                onChange={(c) => {
                  touch();
                  setCarriageway(c);
                }}
                style={styles.inset}
              />
              <Button
                title={detecting ? 'Detecting…' : 'Detect from GPS'}
                icon="locate"
                variant="tinted"
                size="medium"
                disabled={detecting}
                onPress={detect}
                style={[styles.inset, styles.gap]}
              />
            </>
          )}

          {mode === 'street' && (
            <>
              <InsetGroup style={styles.gap}>
                <View style={styles.searchRow}>
                  <Icon name="search" size={18} color={theme.secondaryLabel} />
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Street and city"
                    returnKeyType="done"
                    autoCorrect={false}
                    style={[text.body, styles.searchInput, { color: theme.label }]}
                    {...inputProps}
                  />
                </View>
              </InsetGroup>
              <Text style={[text.footnote, styles.caption, { color: theme.secondaryLabel }]}>
                The report is placed at the best match. Leave empty to use your current location.
              </Text>
            </>
          )}

          <GroupLabel>Comment</GroupLabel>
          <InsetGroup>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a comment (optional)"
              multiline
              style={[text.body, styles.note, { color: theme.label }]}
              {...inputProps}
            />
          </InsetGroup>

          <View style={styles.submit}>
            <Button title={busy ? '' : 'Report'} onPress={submit} disabled={busy} />
            {busy && <ActivityIndicator color="#FFFFFF" style={StyleSheet.absoluteFill} />}
          </View>
        </ScrollView>
      </Sheet>
    </View>
  );
}

function CategoryCell({
  category,
  selected,
  onPress,
}: {
  category: HazardCategory;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const glyph = hazardGlyph(category);
  const color = resolveColor(theme, glyph.color);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={glyph.label}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.ring, { borderColor: selected ? color : 'transparent' }]}>
        <IconBadge icon={glyph.icon} color={color} size={60} />
      </View>
      <Text
        numberOfLines={2}
        style={[text.caption1, styles.cellLabel, { color: theme.label, fontWeight: selected ? '700' : '400' }]}
      >
        {glyph.label}
      </Text>
    </Pressable>
  );
}

/** Green Dutch hectometer post: road shield, carriageway, post number, highway name. */
function HectometerSign({
  road,
  carriageway,
  hectometer,
}: {
  road: string;
  carriageway: Carriageway;
  hectometer: number;
}) {
  const nRoad = road.toUpperCase().startsWith('N');
  return (
    <View style={styles.plateOuter} accessibilityLabel={`${road} ${carriageway} ${hectometer.toFixed(1)}`}>
      <View style={styles.plate}>
        <View style={styles.plateTop}>
          <View style={[styles.shield, { backgroundColor: nRoad ? SIGN.nRoad : SIGN.aRoad }]}>
            <Text style={[styles.shieldText, { color: nRoad ? SIGN.nText : SIGN.white }]}>{road}</Text>
          </View>
          <Text style={styles.plateSide}>{carriageway}</Text>
        </View>
        <Text style={[styles.plateNumber, tabular]}>{hectometer.toFixed(1)}</Text>
        <Text style={styles.plateName} numberOfLines={1}>
          {highwayName(road) ?? 'Rijkswaterstaat'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell: { width: '25%', alignItems: 'center', paddingVertical: 8 },
  ring: { borderRadius: 36, borderWidth: 3, padding: 2 },
  cellLabel: { textAlign: 'center', marginTop: 6, paddingHorizontal: 2 },
  inset: { marginHorizontal: 16 },
  gap: { marginTop: 12 },
  caption: { marginHorizontal: 32, marginTop: 6 },
  plateOuter: { alignSelf: 'center', marginTop: 16, padding: 4, borderRadius: 14, backgroundColor: SIGN.plate },
  plate: {
    minWidth: 176,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: SIGN.white,
  },
  plateTop: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shield: { borderRadius: 5, borderWidth: 1.5, borderColor: SIGN.white, paddingHorizontal: 7, paddingVertical: 1 },
  shieldText: { fontSize: 15, fontWeight: '800' },
  plateSide: { color: SIGN.white, fontSize: 17, fontWeight: '700' },
  plateNumber: { color: SIGN.white, fontSize: 44, fontWeight: '800', letterSpacing: 1, includeFontPadding: false, marginVertical: 2 },
  plateName: { color: SIGN.faded, fontSize: 11, fontWeight: '600' },
  chips: { gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginVertical: 12 },
  step: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hectoInput: { width: 84, height: 40, borderRadius: 10, paddingVertical: 0, textAlign: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10 },
  note: { minHeight: 48, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 13, textAlignVertical: 'top' },
  submit: { marginHorizontal: 16, marginTop: 24, justifyContent: 'center' },
});
