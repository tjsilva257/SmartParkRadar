// Apple Maps "Choose Map" card: map modes on top, grouped layer/filter switches below.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import type { CameraDisplayMode, MapIconFilters, MapMode, MapSettings } from '../types';
import { text, ThemeColor, useTheme } from '../theme';
import { Sheet } from './Sheet';
import { cameraGlyph, Glyph, hazardGlyph, poiGlyph } from './glyphs';
import {
  AppleSwitch,
  CircleButton,
  CloseButton,
  GroupLabel,
  Icon,
  IconBadge,
  IconName,
  InsetGroup,
  Row,
  Segmented,
  withAlpha,
} from './ui';

const MODES: { mode: MapMode; label: string; icon: IconName; color: ThemeColor }[] = [
  { mode: 'explore', label: 'Explore', icon: 'map', color: 'green' },
  { mode: 'driving', label: 'Driving', icon: 'car', color: 'orange' },
  { mode: 'satellite', label: 'Satellite', icon: 'globe', color: 'indigo' },
];

const CAMERA_OPTIONS: { value: CameraDisplayMode; label: string }[] = [
  { value: 'always', label: 'Always' },
  { value: 'trip_only', label: 'During Trips' },
  { value: 'off', label: 'Off' },
];

// `glyph` undefined = the parking "P" plate, which has no Ionicons equivalent.
const FILTERS: { key: keyof MapIconFilters; title: string; subtitle: string; glyph?: Glyph }[] = [
  {
    key: 'showSpeedCameras',
    title: 'Speed Cameras',
    subtitle: 'Fixed cameras, average speed checks and red light cameras',
    glyph: cameraGlyph('fixed'),
  },
  {
    key: 'showPolice',
    title: 'Police & Speed Checks',
    subtitle: 'Mobile speed checks and police controls',
    glyph: cameraGlyph('police'),
  },
  {
    key: 'showWardens',
    title: 'Parking Enforcement',
    subtitle: 'Scan cars and municipal parking wardens',
    glyph: hazardGlyph('parking_warden'),
  },
  {
    key: 'showRoadworks',
    title: 'Road Works & Closures',
    subtitle: 'Road works, lane closures and closed roads',
    glyph: hazardGlyph('road_work'),
  },
  {
    key: 'showHazards',
    title: 'Accidents & Hazards',
    subtitle: 'Breakdowns, traffic jams and debris on the road',
    glyph: hazardGlyph('accident'),
  },
  {
    key: 'showParking',
    title: 'Parking',
    subtitle: 'Free, blue zone and low-cost parking suggestions',
  },
  {
    key: 'showPois',
    title: 'Points of Interest',
    subtitle: 'Cafés, restaurants, shops and landmarks',
    glyph: poiGlyph('cafe'),
  },
];

const ATTRIBUTION = 'Map data © OpenStreetMap contributors · Routing © OSRM · Hectometer posts © PDOK/RWS';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function setAll(on: boolean): Partial<MapIconFilters> {
  return Object.fromEntries(FILTERS.map((f) => [f.key, on])) as Partial<MapIconFilters>;
}

export function MapSettingsSheet({
  visible,
  onClose,
  settings,
  onChangeSettings,
  filters,
  onChangeFilters,
  live,
  onRefreshLive,
  onResetScratchMap,
  onOpenMeme,
}: {
  visible: boolean;
  onClose: () => void;
  settings: MapSettings;
  onChangeSettings: (s: MapSettings) => void;
  filters: MapIconFilters;
  onChangeFilters: (f: MapIconFilters) => void;
  live: { active: boolean; refreshing: boolean; cameraCount: number; hazardCount: number };
  onRefreshLive: () => void;
  onResetScratchMap: () => void;
  onOpenMeme: () => void;
}): React.JSX.Element | null {
  const theme = useTheme();
  const { height: screenH } = useWindowDimensions();
  const [detentIndex, setDetentIndex] = useState(0);
  const memeAfterDismiss = useRef(false);

  useEffect(() => {
    if (visible) setDetentIndex(0);
  }, [visible]);

  const update = (patch: Partial<MapSettings>) => onChangeSettings({ ...settings, ...patch });
  const allOn = FILTERS.every((f) => filters[f.key]);
  const allOff = FILTERS.every((f) => !filters[f.key]);

  const confirmReset = () =>
    Alert.alert('Reset Scratch Map?', "Every place you've revealed will be covered again. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: onResetScratchMap },
    ]);

  // iOS can't present the meme modal while this one is still on screen, so open it once we're dismissed.
  const openMeme = () => {
    if (Platform.OS === 'ios') {
      memeAfterDismiss.current = true;
      onClose();
    } else {
      onClose();
      onOpenMeme();
    }
  };

  const onModalDismiss = () => {
    if (!memeAfterDismiss.current) return;
    memeAfterDismiss.current = false;
    onOpenMeme();
  };

  const header = (
    <View style={styles.header}>
      <Text style={[text.title2, { color: theme.label, flex: 1 }]} accessibilityRole="header">
        Choose Map
      </Text>
      <CloseButton onPress={onClose} />
    </View>
  );

  const groupAction = (label: string, disabled: boolean, onPress: () => void) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
      <Text style={[text.footnote, { color: disabled ? theme.tertiaryLabel : theme.blue, fontWeight: '500' }]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={onModalDismiss}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.shadow, 0.18) }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Sheet
          detents={[Math.round(screenH * 0.62), Math.round(screenH * 0.92)]}
          index={detentIndex}
          onIndexChange={setDetentIndex}
          onDismiss={onClose}
          header={header}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <View style={styles.modes}>
              {MODES.map((m) => {
                const selected = settings.mode === m.mode;
                const color = theme[m.color];
                return (
                  <Pressable
                    key={m.mode}
                    onPress={() => update({ mode: m.mode })}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.label} map`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.modeTile, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View
                      style={[
                        styles.modeArt,
                        { backgroundColor: withAlpha(color, 0.18), borderColor: selected ? theme.blue : 'transparent' },
                      ]}
                    >
                      <Icon name={m.icon} size={34} color={color} />
                    </View>
                    <Text
                      style={[
                        text.footnote,
                        { marginTop: 6, color: selected ? theme.label : theme.secondaryLabel },
                        selected && { fontWeight: '600' },
                      ]}
                      numberOfLines={1}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <GroupLabel>Map Layers</GroupLabel>
            <InsetGroup>
              <Row
                icon={hazardGlyph('traffic_jam').icon}
                iconColor={theme.orange}
                title="Traffic"
                subtitle={settings.mode === 'driving' ? 'Always shown in Driving' : undefined}
                trailing={
                  <AppleSwitch
                    value={settings.showTraffic}
                    onValueChange={(v) => update({ showTraffic: v })}
                    accessibilityLabel="Traffic"
                  />
                }
                separator
              />
              <Row
                icon="cloudy"
                iconColor={theme.indigo}
                title="Scratch Map"
                subtitle="Reveal the places you've been"
                trailing={
                  <AppleSwitch
                    value={settings.showScratchMap}
                    onValueChange={(v) => update({ showScratchMap: v })}
                    accessibilityLabel="Scratch Map"
                  />
                }
                separator
              />
              <Row icon="trash" iconColor={theme.red} title="Reset Scratch Map" titleColor={theme.red} onPress={confirmReset} />
            </InsetGroup>

            <GroupLabel>Speed Cameras</GroupLabel>
            <Segmented
              options={CAMERA_OPTIONS}
              value={settings.cameraDisplay}
              onChange={(cameraDisplay) => update({ cameraDisplay })}
              style={{ marginHorizontal: 16 }}
            />

            <View style={styles.groupHeader}>
              <Text style={[text.footnote, { color: theme.secondaryLabel, flex: 1 }]}>SHOW ON MAP</Text>
              {groupAction('Show All', allOn, () => onChangeFilters({ ...filters, ...setAll(true) }))}
              {groupAction('Hide All', allOff, () => onChangeFilters({ ...filters, ...setAll(false) }))}
            </View>
            <InsetGroup>
              {FILTERS.map((f, i) => (
                <Row
                  key={f.key}
                  leading={
                    f.glyph ? (
                      <IconBadge icon={f.glyph.icon} color={theme[f.glyph.color]} />
                    ) : (
                      <View style={[styles.parkingPlate, { backgroundColor: theme.blue }]}>
                        <Text style={styles.parkingP}>P</Text>
                      </View>
                    )
                  }
                  title={f.title}
                  subtitle={f.subtitle}
                  numberOfLines={2}
                  trailing={
                    <AppleSwitch
                      value={filters[f.key]}
                      onValueChange={(v) => onChangeFilters({ ...filters, [f.key]: v })}
                      accessibilityLabel={f.title}
                    />
                  }
                  separator={i < FILTERS.length - 1}
                />
              ))}
            </InsetGroup>

            <GroupLabel>Live Data</GroupLabel>
            <InsetGroup>
              <Row
                leading={
                  <View style={styles.dotBox}>
                    <View
                      style={[
                        styles.dotHalo,
                        { backgroundColor: withAlpha(live.active ? theme.green : theme.gray, 0.25) },
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: live.active ? theme.green : theme.gray }]} />
                    </View>
                  </View>
                }
                title={live.active ? 'OpenStreetMap & PDOK' : 'Offline — built-in data'}
                subtitle={`${plural(live.cameraCount, 'camera')} · ${plural(live.hazardCount, 'incident')}`}
                trailing={
                  <View style={styles.dotBox}>
                    {live.refreshing ? (
                      <ActivityIndicator color={theme.secondaryLabel} />
                    ) : (
                      <CircleButton
                        icon="refresh"
                        color={theme.blue}
                        onPress={onRefreshLive}
                        accessibilityLabel="Refresh live data"
                      />
                    )}
                  </View>
                }
              />
            </InsetGroup>

            <GroupLabel>Just for Fun</GroupLabel>
            <InsetGroup>
              <Row
                icon="sparkles"
                iconColor={theme.purple}
                title="6 & 7"
                subtitle="Or type 6-7 in search"
                chevron
                onPress={openMeme}
              />
            </InsetGroup>

            <Text style={[text.caption1, styles.attribution, { color: theme.secondaryLabel }]}>{ATTRIBUTION}</Text>
          </ScrollView>
        </Sheet>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 },
  modes: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 4 },
  modeTile: { flex: 1, alignItems: 'center' },
  modeArt: {
    alignSelf: 'stretch',
    aspectRatio: 1 / 0.8,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 32,
    marginTop: 18,
    marginBottom: 6,
  },
  parkingPlate: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  parkingP: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', includeFontPadding: false },
  dotBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  attribution: { textAlign: 'center', marginHorizontal: 32, marginTop: 24 },
});
