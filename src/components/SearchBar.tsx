import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
  Animated,
  PanResponder,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { DestinationTarget, Coordinate, SavedLocation } from '../types/parking';
import { searchDestinations, POPULAR_DESTINATIONS } from '../services/searchService';
import {
  getHomeLocation,
  setHomeLocation,
  removeHomeLocation,
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  getRecents,
  addRecent,
  clearRecents,
} from '../services/favoritesService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = Platform.OS === 'ios' ? 90 : 82;
const EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.72, 580);

interface SearchBarProps {
  currentDestination: DestinationTarget | null;
  userLocation: Coordinate;
  onSelectDestination: (destination: DestinationTarget) => void;
  onClearDestination: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  currentDestination,
  userLocation,
  onSelectDestination,
  onClearDestination,
}) => {
  const [query, setQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationTarget[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Home, Favorites & Recents state
  const [homeLocation, setHomeLoc] = useState<SavedLocation | null>(null);
  const [favorites, setFavs] = useState<SavedLocation[]>([]);
  const [recents, setRecentList] = useState<SavedLocation[]>([]);

  // Animated height for smooth sliding
  const animatedHeight = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const inputRef = useRef<TextInput>(null);

  // Load Home, Favorites, and Recents on mount
  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    const [home, favs, rec] = await Promise.all([
      getHomeLocation(),
      getFavorites(),
      getRecents(),
    ]);
    if (home) setHomeLoc(home);
    setFavs(favs);
    setRecentList(rec);
  };

  // Sync query when currentDestination changes externally
  useEffect(() => {
    if (currentDestination) {
      setQuery(currentDestination.name);
    } else {
      setQuery('');
    }
  }, [currentDestination]);

  // Execute live search when typing
  useEffect(() => {
    let isMounted = true;
    if (!query.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchDestinations(query, userLocation);
      if (isMounted) {
        setSuggestions(results);
        setIsSearching(false);
      }
    }, 280);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, userLocation]);

  // Expansion / Collapse animation helpers
  const expandSheet = () => {
    setIsExpanded(true);
    Animated.spring(animatedHeight, {
      toValue: EXPANDED_HEIGHT,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const collapseSheet = () => {
    setIsExpanded(false);
    Keyboard.dismiss();
    Animated.spring(animatedHeight, {
      toValue: COLLAPSED_HEIGHT,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  // PanResponder for drag handle
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isExpandedRef.current) {
          if (gestureState.dy > 0) {
            animatedHeight.setValue(EXPANDED_HEIGHT - gestureState.dy);
          }
        } else {
          if (gestureState.dy < 0) {
            animatedHeight.setValue(COLLAPSED_HEIGHT - gestureState.dy);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isExpandedRef.current) {
          if (gestureState.dy > 80 || gestureState.vy > 0.5) {
            collapseSheet();
          } else {
            expandSheet();
          }
        } else {
          if (gestureState.dy < -40 || gestureState.vy < -0.5) {
            expandSheet();
          } else {
            collapseSheet();
          }
        }
      },
    })
  ).current;

  const handleSelect = async (dest: DestinationTarget) => {
    setQuery(dest.name);
    collapseSheet();
    onSelectDestination(dest);

    // Save to recents
    const updatedRecents = await addRecent(dest);
    setRecentList(updatedRecents);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    onClearDestination();
  };

  // Home Location management
  const handleSetHomePrompt = () => {
    Alert.alert(
      '🏠 Set Home Location',
      'Choose how you would like to set your Home address:',
      [
        {
          text: '📍 Use Current GPS Location',
          onPress: async () => {
            const homeTarget: DestinationTarget = {
              id: 'home',
              name: 'Home',
              subtitle: 'Current Location',
              city: 'Current Location',
              coordinate: userLocation,
            };
            const saved = await setHomeLocation(homeTarget);
            setHomeLoc(saved);
            Alert.alert('Home Saved', 'Your current location is now set as Home.');
          },
        },
        {
          text: '🔍 Search for Address',
          onPress: () => {
            expandSheet();
            setTimeout(() => inputRef.current?.focus(), 150);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleHomeOptions = () => {
    if (!homeLocation) {
      handleSetHomePrompt();
      return;
    }

    Alert.alert('🏠 Home Location', `${homeLocation.name}\n${homeLocation.subtitle}`, [
      {
        text: '🚗 Navigate to Home',
        onPress: () => handleSelect(homeLocation),
      },
      {
        text: '✏️ Change Home Address',
        onPress: handleSetHomePrompt,
      },
      {
        text: '🗑️ Remove Home',
        style: 'destructive',
        onPress: async () => {
          await removeHomeLocation();
          setHomeLoc(null);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Toggle Favorite
  const handleToggleFavorite = async (dest: DestinationTarget) => {
    const isFav = isFavorite(dest, favorites);
    if (isFav) {
      const updated = await removeFavorite(dest.id || dest.name);
      setFavs(updated);
    } else {
      const updated = await addFavorite(dest);
      setFavs(updated);
    }
  };

  const handleClearRecents = async () => {
    await clearRecents();
    setRecentList([]);
  };

  return (
    <Animated.View style={[styles.bottomSheet, { height: animatedHeight }]}>
      {/* Apple Liquid Glass Frosted Blur Foundation */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 82 : 96}
        tint="systemUltraThinMaterialLight"
        style={StyleSheet.absoluteFill}
      />
      {/* Liquid Glass Translucent Tint Overlay */}
      <View style={styles.glassTintOverlay} pointerEvents="none" />
      {/* Specular Edge Refraction Line */}
      <View style={styles.specularSheen} pointerEvents="none" />

      {/* 1. Drag Handle Header */}
      <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
        <View style={styles.dragHandleBar} />
      </View>

      {/* 2. Main Liquid Search Capsule Row */}
      <View style={styles.searchRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (!isExpanded) expandSheet();
            inputRef.current?.focus();
          }}
          style={styles.inputContainer}
        >
          <View style={styles.iconBubble}>
            <Text style={styles.searchIcon}>{currentDestination ? '🏁' : '🔍'}</Text>
          </View>

          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (!isExpanded) expandSheet();
            }}
            onFocus={() => {
              if (!isExpanded) expandSheet();
            }}
            placeholder="Where to? Search street, city..."
            placeholderTextColor="#64748b"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (suggestions.length > 0) {
                handleSelect(suggestions[0]);
              }
            }}
          />

          {isSearching && (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 6 }} />
          )}

          {(currentDestination || query.length > 0) && (
            <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Liquid Circular Chevron Toggle */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => (isExpanded ? collapseSheet() : expandSheet())}
          style={styles.expandToggleBtn}
        >
          <Text style={styles.expandToggleText}>{isExpanded ? '⌵' : '⌃'}</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Expanded Glass Sheet Content */}
      {isExpanded && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* A. Live Search Suggestions (When typing) */}
          {query.trim().length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {suggestions.length > 0
                    ? `MATCHING STREETS & CITIES (${suggestions.length})`
                    : isSearching
                    ? 'SEARCHING ACROSS CITIES...'
                    : 'NO MATCHES FOUND'}
                </Text>
              </View>

              {suggestions.map((item, index) => {
                const favStatus = isFavorite(item, favorites);
                return (
                  <TouchableOpacity
                    key={`${item.name}-${item.city || ''}-${index}`}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item)}
                    style={styles.resultCard}
                  >
                    <View style={styles.resultIconBubble}>
                      <Text style={styles.resultPinIcon}>📍</Text>
                    </View>

                    <View style={styles.resultTextCol}>
                      <Text style={styles.resultStreetName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultCitySubtitle} numberOfLines={1}>
                        {item.city ? `${item.city}${item.state ? ` (${item.state})` : ''}` : item.subtitle}
                      </Text>
                    </View>

                    {item.distanceKm && (
                      <View style={styles.distBadge}>
                        <Text style={styles.distBadgeText}>{item.distanceKm}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => handleToggleFavorite(item)}
                      style={styles.starBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={favStatus ? styles.starBtnTextActive : styles.starBtnText}>
                        {favStatus ? '★' : '☆'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <>
              {/* B. Favorites Section (In columns underneath each other) */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>FAVORITES</Text>
                  <TouchableOpacity onPress={handleSetHomePrompt}>
                    <Text style={styles.headerActionText}>+ Set Home</Text>
                  </TouchableOpacity>
                </View>

                {/* Column Card 1: Dedicated HOME Card */}
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    if (homeLocation) {
                      handleSelect(homeLocation);
                    } else {
                      handleSetHomePrompt();
                    }
                  }}
                  onLongPress={handleHomeOptions}
                  style={[styles.favoriteCard, styles.homeCard]}
                >
                  <View style={[styles.favIconBubble, { backgroundColor: 'rgba(219, 234, 254, 0.7)' }]}>
                    <Text style={styles.favIconEmoji}>🏠</Text>
                  </View>

                  <View style={styles.resultTextCol}>
                    <View style={styles.rowAlign}>
                      <Text style={styles.favTitle}>Home</Text>
                      <View style={styles.homeBadge}>
                        <Text style={styles.homeBadgeText}>HOME</Text>
                      </View>
                    </View>
                    <Text style={styles.favSub} numberOfLines={1}>
                      {homeLocation
                        ? `${homeLocation.name}${homeLocation.city ? ` • ${homeLocation.city}` : ''}`
                        : 'Tap to set your Home address'}
                    </Text>
                  </View>

                  {homeLocation && (
                    <TouchableOpacity
                      onPress={handleHomeOptions}
                      style={styles.editBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.editBtnText}>⚙️</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Column Cards 2+: Saved Custom Favorites */}
                {favorites.map((fav) => (
                  <TouchableOpacity
                    key={fav.id || fav.name}
                    activeOpacity={0.75}
                    onPress={() => handleSelect(fav)}
                    style={styles.favoriteCard}
                  >
                    <View style={[styles.favIconBubble, { backgroundColor: 'rgba(254, 243, 199, 0.75)' }]}>
                      <Text style={styles.favIconEmoji}>⭐</Text>
                    </View>

                    <View style={styles.resultTextCol}>
                      <Text style={styles.favTitle} numberOfLines={1}>
                        {fav.customLabel || fav.name}
                      </Text>
                      <Text style={styles.favSub} numberOfLines={1}>
                        {fav.subtitle || fav.city || 'Saved Favorite'}
                      </Text>
                    </View>

                    {fav.distanceKm && (
                      <View style={styles.distBadge}>
                        <Text style={styles.distBadgeText}>{fav.distanceKm}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => removeFavorite(fav.id || fav.name).then(setFavs)}
                      style={styles.starBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.starBtnTextActive}>★</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}

                {favorites.length === 0 && !homeLocation && (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>
                      ⭐ Star any street or destination in search results to pin it here.
                    </Text>
                  </View>
                )}
              </View>

              {/* C. Recent Searches Section (Underneath each other) */}
              {recents.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>RECENT SEARCHES</Text>
                    <TouchableOpacity onPress={handleClearRecents}>
                      <Text style={styles.headerActionText}>Clear All</Text>
                    </TouchableOpacity>
                  </View>

                  {recents.slice(0, 6).map((rec, idx) => (
                    <TouchableOpacity
                      key={`${rec.name}-${idx}`}
                      activeOpacity={0.7}
                      onPress={() => handleSelect(rec)}
                      style={styles.recentRow}
                    >
                      <View style={styles.recentIconBubble}>
                        <Text style={styles.recentIcon}>🕒</Text>
                      </View>
                      <View style={styles.resultTextCol}>
                        <Text style={styles.recentTitle} numberOfLines={1}>
                          {rec.name}
                        </Text>
                        <Text style={styles.recentSub} numberOfLines={1}>
                          {rec.city || rec.subtitle}
                        </Text>
                      </View>
                      {rec.distanceKm && (
                        <Text style={styles.recentDistance}>{rec.distanceKm}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* D. Popular City Hubs */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>POPULAR HUBS & CITIES</Text>
                </View>

                {POPULAR_DESTINATIONS.slice(0, 4).map((hub) => (
                  <TouchableOpacity
                    key={hub.name}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(hub)}
                    style={styles.hubRow}
                  >
                    <View style={styles.hubIconBubble}>
                      <Text style={styles.hubIcon}>🏛️</Text>
                    </View>
                    <View style={styles.resultTextCol}>
                      <Text style={styles.hubTitle} numberOfLines={1}>
                        {hub.name}
                      </Text>
                      <Text style={styles.hubSub} numberOfLines={1}>
                        {hub.subtitle}
                      </Text>
                    </View>
                    <View style={styles.quickScanBadge}>
                      <Text style={styles.quickScanText}>Scan Spots</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    zIndex: 50,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 20,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  glassTintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.42)' : 'rgba(255, 255, 255, 0.88)',
  },
  specularSheen: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 1,
  },
  dragHandleArea: {
    width: '100%',
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  dragHandleBar: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  searchIcon: {
    fontSize: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 2,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  expandToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  expandToggleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#334155',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  section: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  /* Results & Street Rows */
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 13,
    marginBottom: 8,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 246, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  resultPinIcon: {
    fontSize: 17,
  },
  resultTextCol: {
    flex: 1,
  },
  resultStreetName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultCitySubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  distBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  distBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  starBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  starBtnText: {
    fontSize: 18,
    color: '#94a3b8',
  },
  starBtnTextActive: {
    fontSize: 18,
    color: '#f59e0b',
  },
  /* Favorites Column Cards */
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 9,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  homeCard: {
    backgroundColor: 'rgba(224, 242, 254, 0.6)',
    borderColor: 'rgba(186, 230, 253, 0.95)',
    borderWidth: 1.5,
  },
  favIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  favIconEmoji: {
    fontSize: 18,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  homeBadge: {
    backgroundColor: 'rgba(219, 234, 254, 0.9)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    marginLeft: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(147, 197, 253, 0.6)',
  },
  homeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.5,
  },
  favSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  editBtn: {
    padding: 6,
    marginLeft: 4,
  },
  editBtnText: {
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: 'rgba(248, 250, 252, 0.6)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderStyle: 'dashed',
  },
  emptyCardText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  /* Recents Rows */
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.7)',
  },
  recentIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  recentIcon: {
    fontSize: 14,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  recentSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  recentDistance: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  /* Popular Hubs Rows */
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.7)',
  },
  hubIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  hubIcon: {
    fontSize: 14,
  },
  hubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  hubSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  quickScanBadge: {
    backgroundColor: 'rgba(209, 250, 229, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.8)',
  },
  quickScanText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
});
