import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Coordinate, HazardCategory, CarriagewayDirection, HectometerPosition, RoadHazard } from '../types/parking';
import {
  POPULAR_HIGHWAY_CODES,
  interpolateHectometerCoordinate,
  detectNearbyHectometerPost,
  formatHectometerLabel,
  DUTCH_HIGHWAYS,
} from '../services/hectometerService';
import { searchDestinations } from '../services/searchService';

interface HazardReportModalProps {
  visible: boolean;
  userLocation: Coordinate;
  onClose: () => void;
  onSubmitHazard: (hazard: {
    category: HazardCategory;
    title: string;
    roadName: string;
    coordinate: Coordinate;
    hectometerPost?: HectometerPosition;
    note?: string;
  }) => void;
}

const CATEGORIES: {
  category: HazardCategory;
  emoji: string;
  label: string;
  sub: string;
}[] = [
  { category: 'mobile_camera', emoji: '📸', label: 'Mobiele Flitser', sub: 'Laser / Politiecontrole' },
  { category: 'mobile_camera', emoji: '🚓', label: 'Politiecontrole / Laser', sub: 'Mobiele inspectie / Flitser' },
  { category: 'parking_warden', emoji: '👮', label: 'Handhaving', sub: 'Scan-auto / Parkeerwachter' },
  { category: 'accident', emoji: '🚗', label: 'Ongeval / Pech', sub: 'Stilstaand voertuig op rijbaan' },
  { category: 'road_work', emoji: '🚧', label: 'Werkzaamheden', sub: 'Wegafsluiting / Pionnen' },
  { category: 'debris', emoji: '⚠️', label: 'Gevaar op de weg', sub: 'Voorwerp / Losliggend puin' },
  { category: 'traffic_jam', emoji: '🚙', label: 'File / Spookfile', sub: 'Plotselinge vertraging' },
];

export const HazardReportModal: React.FC<HazardReportModalProps> = ({
  visible,
  userLocation,
  onClose,
  onSubmitHazard,
}) => {
  // Mode: 'highway' (hectometerpaaltjes) vs 'street' (urban street/city)
  const [locationMode, setLocationMode] = useState<'highway' | 'street'>('highway');

  // Highway Hectometerpaal state
  const [roadCode, setRoadCode] = useState('A10');
  const [hectometer, setHectometer] = useState(14.2);
  const [carriageway, setCarriageway] = useState<CarriagewayDirection>('Li');
  const [detectedHighwayNotice, setDetectedHighwayNotice] = useState<string | null>(null);

  // Street location state
  const [streetAddress, setStreetAddress] = useState('📍 Huidige GPS Locatie');
  const [customStreetQuery, setCustomStreetQuery] = useState('');
  const [isUsingCurrentLoc, setIsUsingCurrentLoc] = useState(true);

  // Hazard details
  const [selectedCategory, setSelectedCategory] = useState<HazardCategory>('mobile_camera');
  const [note, setNote] = useState('');

  // Attempt auto-detecting nearest highway when modal opens
  useEffect(() => {
    if (visible && userLocation) {
      const detected = detectNearbyHectometerPost(userLocation);
      if (detected) {
        setRoadCode(detected.road);
        setHectometer(detected.hectometer);
        setCarriageway(detected.carriageway);
        setDetectedHighwayNotice(`📍 Nabij ${detected.road} ${detected.carriageway} ${detected.hectometer} (${detected.distanceMeters}m)`);
        setLocationMode('highway');
      } else {
        setDetectedHighwayNotice(null);
      }
    }
  }, [visible, userLocation]);

  const handleAutoDetectHectometer = () => {
    const detected = detectNearbyHectometerPost(userLocation);
    if (detected) {
      setRoadCode(detected.road);
      setHectometer(detected.hectometer);
      setCarriageway(detected.carriageway);
      setDetectedHighwayNotice(`✅ Automatisch gesnapt: ${detected.road} ${detected.carriageway} ${detected.hectometer}`);
    } else {
      Alert.alert(
        'Geen snelweg gedetecteerd',
        'Je bevindt je momenteel niet direct binnen 850m van een Nederlandse snelweg. Je kunt handmatig een snelweg en hectometernummer kiezen, of overschakelen naar "Stad / Straat".'
      );
    }
  };

  const adjustHectometer = (delta: number) => {
    setHectometer((prev) => {
      const next = Math.max(0, Number((prev + delta).toFixed(1)));
      return next;
    });
  };

  const handleSubmit = async () => {
    const activeCategory = CATEGORIES.find((c) => c.category === selectedCategory)!;

    if (locationMode === 'highway') {
      const targetCoord = interpolateHectometerCoordinate(roadCode, hectometer, carriageway, userLocation);
      const hectoPost: HectometerPosition = {
        road: roadCode,
        hectometer,
        carriageway,
        description: DUTCH_HIGHWAYS.find((h) => h.road === roadCode)?.name,
      };

      onSubmitHazard({
        category: selectedCategory,
        title: activeCategory.label,
        roadName: formatHectometerLabel(hectoPost),
        hectometerPost: hectoPost,
        coordinate: targetCoord,
        note: note.trim() || undefined,
      });
    } else {
      // Street mode
      let targetCoord = userLocation;
      let finalRoadName = streetAddress;

      if (!isUsingCurrentLoc && customStreetQuery.trim()) {
        const searchResults = await searchDestinations(customStreetQuery, userLocation);
        if (searchResults.length > 0) {
          targetCoord = searchResults[0].coordinate;
          finalRoadName = `${searchResults[0].name}${searchResults[0].city ? `, ${searchResults[0].city}` : ''}`;
        } else {
          finalRoadName = customStreetQuery;
        }
      }

      onSubmitHazard({
        category: selectedCategory,
        title: activeCategory.label,
        roadName: finalRoadName,
        coordinate: targetCoord,
        note: note.trim() || undefined,
      });
    }

    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardWrap}>
          <View style={styles.sheetCard}>
            {/* Apple Liquid Glass Frosted Blur Layer */}
            <BlurView
              intensity={Platform.OS === 'ios' ? 88 : 98}
              tint="systemUltraThinMaterialLight"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.glassTintOverlay} pointerEvents="none" />
            <View style={styles.specularSheen} pointerEvents="none" />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.hazardHeaderIcon}>
                  <Text style={{ fontSize: 18 }}>⚠️</Text>
                </View>
                <View>
                  <Text style={styles.headerTitle}>Meld Verkeersgevaar</Text>
                  <Text style={styles.headerSubtitle}>Real-time community waarschuwing</Text>
                </View>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Location Mode Switcher: Highway (Hectometerpaal) vs City/Street */}
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setLocationMode('highway')}
                  style={[styles.modeTab, locationMode === 'highway' && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabText, locationMode === 'highway' && styles.modeTabTextActive]}>
                    🛣️ Snelweg (Hectometerpaal)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setLocationMode('street')}
                  style={[styles.modeTab, locationMode === 'street' && styles.modeTabActive]}
                >
                  <Text style={[styles.modeTabText, locationMode === 'street' && styles.modeTabTextActive]}>
                    🏙️ Stad / Straat
                  </Text>
                </TouchableOpacity>
              </View>

              {/* A. HIGHWAY MODE: Realistic Dutch Hectometerpaal */}
              {locationMode === 'highway' ? (
                <View style={styles.highwaySection}>
                  {/* Visual Dutch Green Hectometer Post */}
                  <View style={styles.hectoSignCard}>
                    <View style={styles.hectoTopRow}>
                      <View style={styles.hectoRoadBadge}>
                        <Text style={styles.hectoRoadBadgeText}>{roadCode}</Text>
                      </View>
                      <View style={styles.hectoLiReBadge}>
                        <Text style={styles.hectoLiReBadgeText}>{carriageway}</Text>
                      </View>
                    </View>

                    <Text style={styles.hectoNumberText}>{hectometer.toFixed(1)}</Text>

                    <Text style={styles.hectoFooterLabel}>
                      {DUTCH_HIGHWAYS.find((h) => h.road === roadCode)?.name || 'Rijkswaterstaat Traject'}
                    </Text>
                  </View>

                  {/* Auto-detect GPS button */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleAutoDetectHectometer}
                    style={styles.autoDetectBtn}
                  >
                    <Text style={styles.autoDetectBtnText}>
                      {detectedHighwayNotice || '📍 Auto-detecteer hectometerpaal vanaf GPS'}
                    </Text>
                  </TouchableOpacity>

                  {/* Snelweg Selectie Chips */}
                  <Text style={styles.inputLabel}>Snelweg:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                    {POPULAR_HIGHWAY_CODES.map((code) => (
                      <TouchableOpacity
                        key={code}
                        onPress={() => setRoadCode(code)}
                        style={[styles.roadChip, roadCode === code && styles.roadChipActive]}
                      >
                        <Text style={[styles.roadChipText, roadCode === code && styles.roadChipTextActive]}>
                          {code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Hectometer Stepper & Numeric Input */}
                  <Text style={styles.inputLabel}>Hectometernummer (km):</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity onPress={() => adjustHectometer(-1.0)} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>-1.0</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => adjustHectometer(-0.1)} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>-0.1</Text>
                    </TouchableOpacity>

                    <View style={styles.numericDisplay}>
                      <TextInput
                        value={String(hectometer)}
                        keyboardType="decimal-pad"
                        onChangeText={(txt) => {
                          const val = parseFloat(txt.replace(',', '.'));
                          if (!isNaN(val)) setHectometer(val);
                        }}
                        style={styles.numericInput}
                      />
                    </View>

                    <TouchableOpacity onPress={() => adjustHectometer(0.1)} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>+0.1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => adjustHectometer(1.0)} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>+1.0</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Rijbaan (Li / Re) Segmented Control */}
                  <Text style={styles.inputLabel}>Rijbaan / Richting:</Text>
                  <View style={styles.carriagewayRow}>
                    <TouchableOpacity
                      onPress={() => setCarriageway('Li')}
                      style={[styles.carryBtn, carriageway === 'Li' && styles.carryBtnActive]}
                    >
                      <Text style={[styles.carryBtnText, carriageway === 'Li' && styles.carryBtnTextActive]}>
                        Links (Li) • Hoofdrijbaan
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setCarriageway('Re')}
                      style={[styles.carryBtn, carriageway === 'Re' && styles.carryBtnActive]}
                    >
                      <Text style={[styles.carryBtnText, carriageway === 'Re' && styles.carryBtnTextActive]}>
                        Rechts (Re) • Tegenrijbaan
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* B. STREET / CITY MODE */
                <View style={styles.streetSection}>
                  <TouchableOpacity
                    onPress={() => {
                      setIsUsingCurrentLoc(true);
                      setCustomStreetQuery('');
                    }}
                    style={[styles.currentLocBtn, isUsingCurrentLoc && styles.currentLocBtnActive]}
                  >
                    <Text style={styles.currentLocBtnText}>📍 Huidige GPS Locatie</Text>
                    <Text style={styles.currentLocSub}>
                      ({userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)})
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Of zoek een straat / stad:</Text>
                  <TextInput
                    value={customStreetQuery}
                    onChangeText={(txt) => {
                      setCustomStreetQuery(txt);
                      setIsUsingCurrentLoc(false);
                    }}
                    placeholder="Bijv. Overtoom, Amsterdam of Appelstraat, Den Haag"
                    placeholderTextColor="#94a3b8"
                    style={styles.streetTextInput}
                  />
                </View>
              )}

              {/* Hazard Category Grid */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Soort Gevaar:</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((item) => {
                  const isSelected = selectedCategory === item.category;
                  return (
                    <TouchableOpacity
                      key={item.category}
                      onPress={() => setSelectedCategory(item.category)}
                      style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                    >
                      <Text style={styles.catEmoji}>{item.emoji}</Text>
                      <Text style={[styles.catLabel, isSelected && styles.catLabelActive]}>{item.label}</Text>
                      <Text style={styles.catSub} numberOfLines={1}>{item.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional Note */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Aanvullende opmerking (optioneel):</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Bijv. Staat achter viaduct, rechterrijstrook afgesloten..."
                placeholderTextColor="#94a3b8"
                style={styles.noteInput}
              />

              {/* Broadcast Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmit}
                style={styles.broadcastBtn}
              >
                <Text style={styles.broadcastBtnText}>📢 Zend Melding Uit (Live)</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
  },
  sheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 20,
  },
  glassTintOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.88)',
  },
  specularSheen: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hazardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.9)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  /* Mode Tabs */
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: '#0f172a',
  },
  /* Dutch Green Hectometer Post Preview */
  highwaySection: {},
  hectoSignCard: {
    backgroundColor: '#056636', // Official Rijkswaterstaat highway green
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#044e29',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    marginBottom: 10,
  },
  hectoTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hectoRoadBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hectoRoadBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
  },
  hectoLiReBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hectoLiReBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  hectoNumberText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
    marginVertical: 4,
  },
  hectoFooterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
  autoDetectBtn: {
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(191, 219, 254, 0.95)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  autoDetectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  roadChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  roadChipActive: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
  },
  roadChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  roadChipTextActive: {
    color: '#ffffff',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  numericDisplay: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#056636',
    paddingHorizontal: 14,
    paddingVertical: 4,
    minWidth: 72,
    alignItems: 'center',
  },
  numericInput: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  carriagewayRow: {
    flexDirection: 'row',
    gap: 8,
  },
  carryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  carryBtnActive: {
    backgroundColor: '#056636',
    borderColor: '#044e29',
  },
  carryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  carryBtnTextActive: {
    color: '#ffffff',
  },
  /* Street Section */
  streetSection: {},
  currentLocBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  currentLocBtnActive: {
    backgroundColor: 'rgba(239, 246, 255, 0.9)',
    borderColor: '#3b82f6',
  },
  currentLocBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  currentLocSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  streetTextInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },
  /* Category Grid */
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  categoryCardActive: {
    backgroundColor: 'rgba(254, 242, 242, 0.95)',
    borderColor: '#ef4444',
  },
  catEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  catLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  catLabelActive: {
    color: '#dc2626',
  },
  catSub: {
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  noteInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1.2,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  broadcastBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  broadcastBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});

