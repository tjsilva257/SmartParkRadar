import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { DestinationTarget, Coordinate } from '../types/parking';
import { searchDestinations } from '../services/searchService';

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
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationTarget[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Sync query when destination changes externally
  useEffect(() => {
    if (currentDestination) {
      setQuery(currentDestination.name);
    } else {
      setQuery('');
    }
  }, [currentDestination]);

  // Execute search when typing
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(async () => {
      if (isFocused) {
        setIsSearching(true);
        const results = await searchDestinations(query, userLocation);
        if (isMounted) {
          setSuggestions(results);
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, isFocused, userLocation]);

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    onClearDestination();
    Keyboard.dismiss();
  };

  const handleSelect = (dest: DestinationTarget) => {
    setQuery(dest.name);
    setIsFocused(false);
    Keyboard.dismiss();
    onSelectDestination(dest);
  };

  return (
    <View pointerEvents="box-none" style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.card}>
        <View style={styles.iconBubble}>
          <Text style={styles.icon}>{currentDestination ? '🏁' : '🔍'}</Text>
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsFocused(true)}
          placeholder="Search destination, street or city..."
          placeholderTextColor="#94a3b8"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={async () => {
            if (query.trim()) {
              setIsSearching(true);
              const results = await searchDestinations(query, userLocation);
              setIsSearching(false);
              if (results.length > 0) {
                handleSelect(results[0]);
              }
            }
          }}
        />

        {isSearching && (
          <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 6 }} />
        )}

        {(currentDestination || query.length > 0) && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearBtn}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Suggestions Dropdown */}
      {isFocused && (
        <View style={styles.suggestionsBox}>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.suggestionsTitle}>
              {query.trim() ? 'SEARCH RESULTS' : 'POPULAR DESTINATIONS'}
            </Text>
            <TouchableOpacity onPress={() => setIsFocused(false)}>
              <Text style={styles.closeBtn}>Close</Text>
            </TouchableOpacity>
          </View>

          {suggestions.map((item, index) => (
            <TouchableOpacity
              key={`${item.name}-${index}`}
              onPress={() => handleSelect(item)}
              style={styles.suggestionRow}
            >
              <View style={styles.pinCircle}>
                <Text style={styles.pinText}>📍</Text>
              </View>
              <View style={styles.textCol}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>Auto-Scan</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 58,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  card: {
    marginHorizontal: 14,
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 16,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 4,
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  suggestionsBox: {
    marginHorizontal: 14,
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.6,
  },
  closeBtn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pinText: {
    fontSize: 16,
  },
  textCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  scanBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  scanBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
});

