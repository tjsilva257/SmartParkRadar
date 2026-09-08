import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { DestinationTarget, Coordinate } from '../types/parking';
import { detectPoiCategory, getPlaceDistanceInfo } from '../services/placesService';

interface PoiPreviewCardProps {
  place: DestinationTarget | null;
  userLocation: Coordinate;
  isFavorite?: boolean;
  onNavigate: (place: DestinationTarget) => void;
  onToggleFavorite: (place: DestinationTarget) => void;
  onClose: () => void;
}

export const PoiPreviewCard: React.FC<PoiPreviewCardProps> = ({
  place,
  userLocation,
  isFavorite = false,
  onNavigate,
  onToggleFavorite,
  onClose,
}) => {
  if (!place) return null;

  const categoryInfo = detectPoiCategory(place.name);
  const distanceInfo = getPlaceDistanceInfo(userLocation, place.coordinate);

  return (
    <View style={styles.container}>
      {/* Apple Liquid Glass Frosted Blur Layer */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 88 : 98}
        tint="systemUltraThinMaterialLight"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glassTintOverlay} pointerEvents="none" />
      <View style={styles.specularSheen} pointerEvents="none" />

      {/* Top Details Row */}
      <View style={styles.topRow}>
        <View style={styles.iconBubble}>
          <Text style={styles.emojiText}>{categoryInfo.emoji}</Text>
        </View>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.placeName} numberOfLines={1}>
              {place.name}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categoryInfo.categoryLabel}</Text>
            </View>
          </View>

          <Text style={styles.placeSubtitle} numberOfLines={1}>
            {place.subtitle || 'Bestemming'}
          </Text>

          <Text style={styles.distanceText}>
            📍 {distanceInfo.distanceText} van jou vandaan · 🚶 ca. {distanceInfo.walkingMin} min lopen
          </Text>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onNavigate(place)}
          style={styles.navigateBtn}
        >
          <Text style={styles.navigateBtnText}>🚗 Ga hierheen & Scan Parkeren</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onToggleFavorite(place)}
          style={[styles.favoriteBtn, isFavorite && styles.favoriteBtnActive]}
        >
          <Text style={[styles.favoriteBtnText, isFavorite && styles.favoriteBtnTextActive]}>
            {isFavorite ? '★ Opgeslagen' : '☆ Bewaar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 96,
    left: 14,
    right: 14,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
    zIndex: 55,
  },
  glassTintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.92)',
  },
  specularSheen: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  emojiText: {
    fontSize: 22,
  },
  textCol: {
    flex: 1,
    marginRight: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  categoryBadge: {
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563eb',
  },
  placeSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
    marginTop: 4,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(100, 116, 139, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navigateBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  navigateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  favoriteBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtnActive: {
    backgroundColor: 'rgba(254, 243, 199, 0.9)',
    borderColor: '#f59e0b',
  },
  favoriteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  favoriteBtnTextActive: {
    color: '#d97706',
  },
});

