// Apple Maps directions card: drive → park → walk strip, route options with
// GO pills, the chosen parking and the max walking distance preference.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { ParkingSpot, Place, RouteOption } from '../types';
import { tabular, text, useTheme } from '../theme';
import { formatDistance, formatDuration, walkMinutes } from '../lib/geo';
import { facilityLabel, parkingGlyph } from './glyphs';
import { Button, CloseButton, GroupLabel, Icon, IconBadge, InsetGroup, resolveColor, Row, Segmented, withAlpha } from './ui';
import { Sheet } from './Sheet';

const WALK_OPTIONS = [
  { value: 250, label: '250 m' },
  { value: 500, label: '500 m' },
  { value: 750, label: '750 m' },
  { value: 1200, label: '1.2 km' },
];

/** Rounded-square "P" in the parking type's color, same mark as the map overlay. */
function ParkingMark({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.62, includeFontPadding: false }}>P</Text>
    </View>
  );
}

function RouteRow({
  route,
  selected,
  onSelect,
  onGo,
}: {
  route: RouteOption;
  selected: boolean;
  onSelect: () => void;
  onGo: () => void;
}) {
  const theme = useTheme();
  const tag = route.isFallback
    ? { label: 'Estimate (offline)', color: theme.orange }
    : route.isFastest
      ? { label: 'Fastest', color: theme.green }
      : { label: `+${Math.max(1, Math.round(route.delaySeconds / 60))} min`, color: theme.secondaryLabel };
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 8,
        paddingLeft: 16,
        paddingRight: 12,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: pressed ? theme.secondaryFill : theme.card,
        // Always 2 pt so selecting doesn't shift the layout.
        borderWidth: 2,
        borderColor: selected ? theme.blue : 'transparent',
      })}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={[text.title2, tabular, { color: theme.label }]} numberOfLines={1}>
          {formatDuration(route.durationSeconds)}
        </Text>
        <Text style={[text.footnote, { color: theme.secondaryLabel, marginTop: 2 }]} numberOfLines={1}>
          {`${formatDistance(route.distanceMeters)} · ${route.summary}`}
        </Text>
        <Text style={[text.footnote, { fontWeight: '600', color: tag.color, marginTop: 2 }]}>{tag.label}</Text>
      </View>
      <Button
        title="GO"
        color="green"
        size="small"
        onPress={onGo}
        accessibilityLabel={`Go, ${formatDuration(route.durationSeconds)} route`}
        style={{ height: 36, borderRadius: 18, minWidth: 68 }}
      />
    </Pressable>
  );
}

export function RoutePlanner({
  destination,
  parking,
  nearestFree,
  routes,
  selectedRouteId,
  loading,
  walk,
  maxWalkMeters,
  onChangeMaxWalk,
  onSelectRoute,
  onGo,
  onClose,
  onHeightChange,
}: {
  destination: Place;
  parking: ParkingSpot | null;
  nearestFree: ParkingSpot | null;
  routes: RouteOption[];
  selectedRouteId: string | null;
  loading: boolean;
  walk: { distanceMeters: number; durationSeconds: number } | null;
  maxWalkMeters: number;
  onChangeMaxWalk: (m: number) => void;
  onSelectRoute: (id: string) => void;
  onGo: (id: string) => void;
  onClose: () => void;
  onHeightChange?: (h: number) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(1);

  const selected = routes.find((r) => r.id === selectedRouteId) ?? routes[0] ?? null;
  const pGlyph = parking ? parkingGlyph(parking.type) : null;
  const pColor = pGlyph ? resolveColor(theme, pGlyph.color) : theme.gray;

  const driveTime = selected && !loading ? formatDuration(selected.durationSeconds) : '…';
  const walkTime = walk
    ? formatDuration(walk.durationSeconds)
    : parking
      ? `${parking.walkMinutes} min`
      : '…';

  // Same rule as the old drawer: blue-zone (pricePerHour 0) counts as free.
  const parkingIsFree = !!parking && (parking.type === 'free' || parking.pricePerHour === 0);
  const showFreeHint =
    !!parking && !parkingIsFree && !!nearestFree && nearestFree.distanceToDestMeters > maxWalkMeters;
  const freeTarget = nearestFree ? ([500, 750, 1200].find((m) => m >= nearestFree.distanceToDestMeters) ?? 1200) : 1200;

  const header = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[text.footnote, { fontWeight: '600', color: theme.secondaryLabel }]}>Directions</Text>
          <Text style={[text.title2, { color: theme.label }]} numberOfLines={1}>
            {destination.name}
          </Text>
          <Text style={[text.subhead, { color: theme.secondaryLabel, marginTop: 1 }]}>From My Location</Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Icon name="car" size={17} color={theme.secondaryLabel} />
        <Text style={[text.subhead, tabular, { fontWeight: '600', color: theme.label }]}>{driveTime}</Text>
        <Icon name="chevron-forward" size={13} color={theme.tertiaryLabel} />
        <ParkingMark color={pColor} />
        <Text style={[text.subhead, { fontWeight: '600', color: theme.label, flexShrink: 1 }]} numberOfLines={1}>
          {parking?.priceLabel ?? '…'}
        </Text>
        <Icon name="chevron-forward" size={13} color={theme.tertiaryLabel} />
        <Icon name="walk" size={17} color={theme.secondaryLabel} />
        <Text style={[text.subhead, tabular, { fontWeight: '600', color: theme.label }]}>{walkTime}</Text>
      </View>
    </View>
  );

  return (
    <Sheet
      detents={[250, Math.max(300, Math.round(screenH * 0.52)), Math.max(360, Math.round(screenH * 0.88))]}
      index={index}
      onIndexChange={setIndex}
      onDismiss={onClose}
      onHeightChange={onHeightChange}
      header={header}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 }}>
            <ActivityIndicator color={theme.secondaryLabel} />
            <Text style={[text.subhead, { color: theme.secondaryLabel }]}>Finding the best route…</Text>
          </View>
        ) : (
          routes.map((r) => (
            <RouteRow
              key={r.id}
              route={r}
              selected={r.id === selected?.id}
              onSelect={() => onSelectRoute(r.id)}
              onGo={() => onGo(r.id)}
            />
          ))
        )}

        {parking && pGlyph && (
          <>
            <GroupLabel>Parking</GroupLabel>
            <InsetGroup>
              <Row
                leading={<IconBadge icon={pGlyph.icon} color={pColor} />}
                title={parking.title}
                subtitle={`${parking.priceLabel} · ${facilityLabel(parking.facility)} · ${formatDistance(
                  parking.distanceToDestMeters
                )} walk${parking.rules ? `\n${parking.rules}` : ''}`}
                numberOfLines={3}
              />
            </InsetGroup>
          </>
        )}

        {showFreeHint && nearestFree && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginHorizontal: 16,
              marginTop: 8,
              paddingVertical: 10,
              paddingLeft: 14,
              paddingRight: 10,
              borderRadius: 14,
              backgroundColor: withAlpha(theme.green, 0.15),
              gap: 10,
            }}
          >
            <Icon name="leaf" size={18} color={theme.green} />
            <Text style={[text.subhead, { flex: 1, color: theme.label }]}>
              {`Free parking ${formatDistance(nearestFree.distanceToDestMeters)} from your destination`}
            </Text>
            {freeTarget > maxWalkMeters && (
              <Button title="Walk farther" color="green" size="small" onPress={() => onChangeMaxWalk(freeTarget)} />
            )}
          </View>
        )}

        <GroupLabel>Max Walking Distance</GroupLabel>
        <Segmented
          options={WALK_OPTIONS}
          value={maxWalkMeters}
          onChange={onChangeMaxWalk}
          style={{ marginHorizontal: 16 }}
        />
        <Text style={[text.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginTop: 6 }]}>
          {`Park within about ${walkMinutes(maxWalkMeters)} min on foot from ${destination.name}.`}
        </Text>
      </ScrollView>
    </Sheet>
  );
}
