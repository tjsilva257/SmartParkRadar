// Browse-mode search sheet: Apple Maps search field, Favorites row, Recents and Popular,
// live search results. Saved state lives in the parent; this sheet only reports intents.
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Coordinate, Place, SavedPlace, SavedState } from '../types';
import { spacing, text, Theme, useTheme } from '../theme';
import { distanceMeters, formatDistance } from '../lib/geo';
import { isMemeQuery, POPULAR_PLACES, searchPlaces } from '../services/places';
import { isFavorite } from '../services/saved';
import { poiGlyph } from './glyphs';
import { CircleButton, Icon, IconName, InsetGroup, Row, SectionHeader, withAlpha } from './ui';
import { Sheet } from './Sheet';

type Slot = 'home' | 'work';
const SLOT_LABEL: Record<Slot, string> = { home: 'Home', work: 'Work' };
const COLLAPSED = 0;
const MEDIUM = 1;
const LARGE = 2;
const MAX_RECENTS = 8;

export function SearchSheet(props: {
  userLocation: Coordinate;
  /** false while userLocation is only the fallback coordinate (no GPS fix yet). */
  hasLocation: boolean;
  saved: SavedState;
  onSelectPlace: (place: Place) => void;
  onRoutePlace: (place: Place) => void;
  onSetSlot: (slot: Slot, place: Place | null) => void;
  onToggleFavorite: (place: Place) => void;
  onClearRecents: () => void;
  onTriggerMeme: () => void;
  onHeightChange?: (h: number) => void;
}): React.JSX.Element {
  const { userLocation, saved, onSelectPlace, onRoutePlace, onSetSlot, onToggleFavorite } = props;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const detents = [76, Math.round(screenH * 0.46), screenH - insets.top - 16];

  const [index, setIndex] = useState(COLLAPSED);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickSlot, setPickSlot] = useState<Slot | null>(null);
  const [keyboardH, setKeyboardH] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const requestId = useRef(0);
  // The query `results` belong to; they stay rendered while a newer query is still searching.
  const resultsFor = useRef('');
  // Read through a ref so GPS fixes don't re-run the search every 1.5 s.
  const locationRef = useRef(userLocation);
  locationRef.current = userLocation;

  const trimmed = query.trim();

  useEffect(() => {
    const id = ++requestId.current;
    if (!trimmed) {
      resultsFor.current = '';
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      let places: Place[] = [];
      try {
        places = await searchPlaces(trimmed, locationRef.current);
      } catch {
        places = [];
      }
      if (id !== requestId.current) return; // a newer query superseded this one
      resultsFor.current = trimmed;
      setResults(places);
      setSearching(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [trimmed]);

  // The keyboard would cover most of a medium/collapsed sheet, so it only lives at the large detent.
  useEffect(() => {
    if (index < LARGE) Keyboard.dismiss();
  }, [index]);

  // The sheet is anchored to the screen bottom, so pad the list by the part the keyboard overlaps.
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKeyboardH(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const keyboardOverlap = Math.max(0, keyboardH - Math.max(insets.bottom, spacing.sheetMargin));

  const focusSearch = () => {
    setIndex(LARGE);
    // Delay so a just-dismissed Alert doesn't steal focus back on iOS.
    setTimeout(() => inputRef.current?.focus(), 250);
  };

  const reset = (toIndex: number) => {
    setQuery('');
    setPickSlot(null);
    inputRef.current?.blur();
    Keyboard.dismiss();
    setIndex(toIndex);
  };

  const triggerMeme = () => {
    props.onTriggerMeme();
    reset(COLLAPSED);
  };

  const choose = (place: Place) => {
    if (pickSlot) {
      onSetSlot(pickSlot, place);
      reset(MEDIUM);
      return;
    }
    reset(COLLAPSED);
    onSelectPlace(place);
  };

  const onChangeText = (value: string) => {
    if (isMemeQuery(value)) {
      triggerMeme();
      return;
    }
    setQuery(value);
    if (index !== LARGE) setIndex(LARGE);
  };

  const onSubmit = () => {
    if (isMemeQuery(query)) triggerMeme();
    // Mid-debounce the list still shows the previous query; leave it to the user to tap then.
    else if (results.length > 0 && resultsFor.current === trimmed) choose(results[0]);
  };

  const enterPickMode = (slot: Slot) => {
    setPickSlot(slot);
    focusSearch();
  };

  const promptSetSlot = (slot: Slot) => {
    const label = SLOT_LABEL[slot];
    const useCurrent = {
      text: 'Use Current Location',
      onPress: () =>
        onSetSlot(slot, {
          id: `${slot}-current`,
          name: label,
          subtitle: 'Current Location',
          coordinate: userLocation,
          poiCategory: slot,
        }),
    };
    Alert.alert(`Set ${label}`, `Choose how to set your ${label} address.`, [
      // Without a GPS fix userLocation is just the fallback coordinate; don't save that as Home/Work.
      ...(props.hasLocation ? [useCurrent] : []),
      { text: 'Search for an Address', onPress: () => enterPickMode(slot) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const slotOptions = (slot: Slot, place: SavedPlace) => {
    Alert.alert(SLOT_LABEL[slot], [place.name, place.subtitle].filter(Boolean).join('\n'), [
      { text: 'Directions', onPress: () => onRoutePlace(place) },
      { text: 'Change Address', onPress: () => enterPickMode(slot) },
      { text: 'Remove', style: 'destructive', onPress: () => onSetSlot(slot, null) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const favoriteOptions = (fav: SavedPlace) => {
    Alert.alert('Remove from Favorites?', fav.customLabel || fav.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onToggleFavorite(fav) },
    ]);
  };

  const distanceTo = (place: Place) => formatDistance(distanceMeters(userLocation, place.coordinate));
  const detail = (place: Place, locality: string | undefined) =>
    [distanceTo(place), locality].filter(Boolean).join(' · ');
  const cityLine = (place: Place) => [place.city, place.state].filter(Boolean).join(', ') || place.subtitle;

  const slotItem = (slot: Slot) => {
    const place = saved[slot];
    const g = poiGlyph(slot);
    return (
      <FavoriteCircle
        key={slot}
        icon={g.icon}
        color={theme[g.color]}
        label={SLOT_LABEL[slot]}
        sublabel={place ? distanceTo(place) : 'Add'}
        onPress={() => (place ? onRoutePlace(place) : promptSetSlot(slot))}
        onLongPress={() => (place ? slotOptions(slot, place) : promptSetSlot(slot))}
      />
    );
  };

  const recents = saved.recents.slice(0, MAX_RECENTS);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: 4, paddingBottom: 12 }}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        // Not one grouped element: the TextInput and the Clear button stay reachable by screen readers.
        accessible={false}
        style={{
          flex: 1,
          height: 44,
          borderRadius: 12,
          backgroundColor: theme.tertiaryFill,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
        }}
      >
        <Icon name="search" size={19} color={theme.secondaryLabel} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onChangeText}
          onFocus={() => {
            setFocused(true);
            setIndex(LARGE);
          }}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          placeholder="Search Maps"
          placeholderTextColor={theme.secondaryLabel}
          selectionColor={theme.blue}
          returnKeyType="search"
          autoCorrect={false}
          enablesReturnKeyAutomatically
          accessibilityLabel="Search Maps"
          style={[text.body, { flex: 1, color: theme.label, marginLeft: 6, paddingVertical: 0, height: 44 }]}
        />
        {searching && results.length > 0 && <ActivityIndicator size="small" color={theme.secondaryLabel} style={{ marginRight: 6 }} />}
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear text">
            <Icon name="close-circle" size={18} color={theme.tertiaryLabel} />
          </Pressable>
        )}
      </Pressable>
      {(focused || query.length > 0) && (
        <Pressable onPress={() => reset(COLLAPSED)} hitSlop={8} accessibilityRole="button" style={{ marginLeft: 12 }}>
          <Text style={[text.body, { color: theme.blue }]}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <Sheet detents={detents} index={index} onIndexChange={setIndex} onHeightChange={props.onHeightChange} header={header}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: keyboardOverlap + 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {pickSlot && <PickBanner slot={pickSlot} theme={theme} onCancel={() => setPickSlot(null)} />}

        {trimmed ? (
          <View style={{ paddingTop: 4 }}>
            {trimmed.startsWith('6') && (
              <InsetGroup style={{ marginBottom: 12 }}>
                <Row
                  icon="sparkles"
                  iconColor={theme.purple}
                  title="6 & 7"
                  subtitle="Secret easter egg — tap or type 6-7"
                  onPress={triggerMeme}
                />
              </InsetGroup>
            )}
            {results.length > 0 ? (
              <InsetGroup>
                {results.map((place, i) => {
                  const g = poiGlyph(place.poiCategory);
                  const fav = isFavorite(place, saved.favorites);
                  return (
                    <Row
                      key={`${place.id}-${i}`}
                      icon={g.icon}
                      iconColor={theme[g.color]}
                      title={place.name}
                      subtitle={detail(place, cityLine(place))}
                      onPress={() => choose(place)}
                      separator={i < results.length - 1}
                      trailing={
                        <Pressable
                          onPress={() => onToggleFavorite(place)}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={fav ? 'Remove from Favorites' : 'Add to Favorites'}
                          style={{ paddingLeft: 10 }}
                        >
                          <Icon name={fav ? 'star' : 'star-outline'} size={22} color={fav ? theme.yellow : theme.gray} />
                        </Pressable>
                      }
                    />
                  );
                })}
              </InsetGroup>
            ) : searching ? (
              <InsetGroup>
                <Row leading={<ActivityIndicator size="small" color={theme.secondaryLabel} />} title="Searching…" titleColor={theme.secondaryLabel} />
              </InsetGroup>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32 }}>
                <Icon name="search" size={36} color={theme.tertiaryLabel} />
                <Text style={[text.title3, { fontWeight: '700', color: theme.label, marginTop: 10 }]}>No Results</Text>
                <Text style={[text.subhead, { color: theme.secondaryLabel, marginTop: 4, textAlign: 'center' }]}>
                  Try a street, city or place name.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
            <SectionHeader title="Favorites" style={{ paddingTop: 8 }} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: spacing.gutter - 4, gap: 6 }}
            >
              {slotItem('home')}
              {slotItem('work')}
              {saved.favorites.map((fav) => {
                const g = poiGlyph(fav.poiCategory);
                return (
                  <FavoriteCircle
                    key={fav.id}
                    icon={g.icon}
                    color={theme[g.color]}
                    label={fav.customLabel || fav.name}
                    sublabel={distanceTo(fav)}
                    onPress={() => onRoutePlace(fav)}
                    onLongPress={() => favoriteOptions(fav)}
                  />
                );
              })}
              <FavoriteCircle icon="add" color={theme.tertiaryFill} glyphColor={theme.gray} label="Add" onPress={focusSearch} />
            </ScrollView>

            {recents.length > 0 && (
              <>
                <SectionHeader title="Recents" actionLabel="Clear" onAction={props.onClearRecents} />
                <InsetGroup>
                  {recents.map((place, i) => (
                    <Row
                      key={`${place.id}-${i}`}
                      icon="time"
                      iconColor={theme.gray}
                      title={place.name}
                      subtitle={detail(place, place.subtitle || place.city)}
                      onPress={() => choose(place)}
                      separator={i < recents.length - 1}
                    />
                  ))}
                </InsetGroup>
              </>
            )}

            <SectionHeader title="Popular Destinations" />
            <InsetGroup>
              {POPULAR_PLACES.map((place: Place, i: number) => {
                const g = poiGlyph(place.poiCategory);
                return (
                  <Row
                    key={place.id}
                    icon={g.icon}
                    iconColor={theme[g.color]}
                    title={place.name}
                    subtitle={detail(place, place.city || place.subtitle)}
                    onPress={() => choose(place)}
                    separator={i < POPULAR_PLACES.length - 1}
                  />
                );
              })}
            </InsetGroup>
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}

/** Apple Maps favorites item: 60 pt glyph circle with label and secondary sublabel under it. */
function FavoriteCircle({
  icon,
  color,
  glyphColor = '#FFFFFF',
  label,
  sublabel,
  onPress,
  onLongPress,
}: {
  icon: IconName;
  color: string;
  glyphColor?: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => ({ width: 72, alignItems: 'center', paddingVertical: 2, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={glyphColor} />
      </View>
      <Text style={[text.footnote, { fontWeight: '600', color: theme.label, marginTop: 6 }]} numberOfLines={1}>
        {label}
      </Text>
      {!!sublabel && (
        <Text style={[text.caption1, { color: theme.secondaryLabel, marginTop: 1 }]} numberOfLines={1}>
          {sublabel}
        </Text>
      )}
    </Pressable>
  );
}

/** Blue banner shown while the next tapped place will become Home/Work. */
function PickBanner({ slot, theme, onCancel }: { slot: Slot; theme: Theme; onCancel: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.gutter,
        marginTop: 4,
        marginBottom: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: withAlpha(theme.blue, 0.14),
      }}
    >
      <Icon name={slot === 'home' ? 'home' : 'briefcase'} size={18} color={theme.blue} />
      <Text style={[text.subhead, { fontWeight: '600', color: theme.blue, flex: 1, marginLeft: 8 }]} numberOfLines={2}>
        Choose a result to set as {SLOT_LABEL[slot]}
      </Text>
      <CircleButton icon="close" size={24} onPress={onCancel} accessibilityLabel="Cancel" />
    </View>
  );
}
