// Apple Maps place card: title + category, Directions / Save tiles, then
// nearby parking and details when the sheet is pulled up.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { Coordinate, Place } from '../types';
import { text, useTheme } from '../theme';
import { distanceMeters, formatDistance, formatDuration, walkMinutes } from '../lib/geo';
import { scanParking } from '../services/parking';
import { poiCategoryFor } from '../services/places';
import { parkingGlyph, poiGlyph } from './glyphs';
import { ActionTile, CloseButton, GroupLabel, Hairline, IconBadge, InsetGroup, resolveColor, Row } from './ui';
import { Sheet } from './Sheet';

const PEEK = 196;
// Rough door-to-door city estimate shown before a real route exists.
const ROAD_FACTOR = 1.35;
const CITY_KMH = 32;

function formatCoordinate(c: Coordinate): string {
  const lat = `${Math.abs(c.latitude).toFixed(5)}° ${c.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(c.longitude).toFixed(5)}° ${c.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}

/** Apple Maps "Details" row: small secondary label over the value. */
function Detail({ label, value, separator }: { label: string; value: string; separator?: boolean }) {
  const theme = useTheme();
  return (
    <View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={[text.footnote, { color: theme.secondaryLabel }]}>{label}</Text>
        <Text style={[text.body, { color: theme.label, marginTop: 2 }]} selectable>
          {value}
        </Text>
      </View>
      {separator && <Hairline inset={16} />}
    </View>
  );
}

export function PlaceCard({
  place,
  userLocation,
  isFavorite,
  onDirections,
  onToggleFavorite,
  onClose,
  onHeightChange,
}: {
  place: Place;
  userLocation: Coordinate;
  isFavorite: boolean;
  onDirections: (place: Place) => void;
  onToggleFavorite: (place: Place) => void;
  onClose: () => void;
  onHeightChange?: (h: number) => void;
}): React.JSX.Element {
  const theme = useTheme();
  const { height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  // A new pin while the card is open starts back at peek, like Apple Maps.
  useEffect(() => setIndex(0), [place.id]);

  const { latitude, longitude } = place.coordinate;
  const best = useMemo(() => scanParking({ latitude, longitude }, 500).best, [latitude, longitude]);

  const glyph = poiGlyph(place.poiCategory ?? poiCategoryFor(place.name));
  const where = place.city || place.subtitle;
  const away = distanceMeters(userLocation, place.coordinate);
  const driveTime = formatDuration((away * ROAD_FACTOR) / (CITY_KMH / 3.6));

  const header = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[text.title2, { color: theme.label }]} numberOfLines={2}>
            {place.name}
          </Text>
          <Text style={[text.subhead, { color: theme.secondaryLabel, marginTop: 2 }]} numberOfLines={1}>
            {where ? `${glyph.label} · ${where}` : glyph.label}
          </Text>
        </View>
        <CloseButton onPress={onClose} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <ActionTile
          icon="car"
          title={driveTime}
          accessibilityLabel={`Directions, ${driveTime} by car`}
          primary
          onPress={() => onDirections(place)}
        />
        <ActionTile
          icon={isFavorite ? 'star' : 'star-outline'}
          title={isFavorite ? 'Saved' : 'Save'}
          iconColor={isFavorite ? theme.yellow : undefined}
          onPress={() => onToggleFavorite(place)}
        />
      </View>
    </View>
  );

  const bestGlyph = best ? parkingGlyph(best.type) : null;

  return (
    <Sheet
      detents={[PEEK, Math.max(PEEK + 64, Math.round(screenH * 0.7))]}
      index={index}
      onIndexChange={setIndex}
      onDismiss={onClose}
      onHeightChange={onHeightChange}
      header={header}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {best && bestGlyph && (
          <>
            <GroupLabel>Parking Nearby</GroupLabel>
            <InsetGroup>
              <Row
                leading={<IconBadge icon={bestGlyph.icon} color={resolveColor(theme, bestGlyph.color)} />}
                title={best.title}
                subtitle={`${best.priceLabel} · ${formatDistance(best.distanceToDestMeters)} walk`}
              />
            </InsetGroup>
            <Text style={[text.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginTop: 6 }]}>
              Tap Directions to park here and walk the rest.
            </Text>
          </>
        )}

        <GroupLabel>Details</GroupLabel>
        <InsetGroup>
          {!!place.subtitle && <Detail label="Address" value={place.subtitle} separator />}
          <Detail
            label="Distance"
            value={`${formatDistance(away)} away · ${walkMinutes(away)} min walk`}
            separator
          />
          <Detail label="Coordinates" value={formatCoordinate(place.coordinate)} />
        </InsetGroup>
      </ScrollView>
    </Sheet>
  );
}
