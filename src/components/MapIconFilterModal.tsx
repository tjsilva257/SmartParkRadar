import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MapIconFilterSettings, DEFAULT_ICON_FILTERS } from '../types/parking';

interface MapIconFilterModalProps {
  visible: boolean;
  filters: MapIconFilterSettings;
  onUpdateFilters: (filters: MapIconFilterSettings) => void;
  onClose: () => void;
}

interface FilterRowConfig {
  key: keyof MapIconFilterSettings;
  title: string;
  subtitle: string;
  icon: string | React.ReactNode;
  isEmoji?: boolean;
  bubbleColor: string;
  borderColor?: string;
}

export const MapIconFilterModal: React.FC<MapIconFilterModalProps> = ({
  visible,
  filters,
  onUpdateFilters,
  onClose,
}) => {
  const sheetSlide = useRef(new Animated.Value(80)).current;
  const sheetScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(sheetSlide, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.spring(sheetScale, { toValue: 1, tension: 75, friction: 8, useNativeDriver: true }),
      ]).start();
    } else {
      sheetSlide.setValue(80);
      sheetScale.setValue(0.92);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(sheetSlide, { toValue: 80, duration: 170, useNativeDriver: true }),
      Animated.timing(sheetScale, { toValue: 0.94, duration: 170, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const toggleFilter = (key: keyof MapIconFilterSettings) => {
    onUpdateFilters({
      ...filters,
      [key]: !filters[key],
    });
  };

  const handleSelectAll = () => {
    onUpdateFilters({
      showSpeedCameras: true,
      showPolice: true,
      showWardens: true,
      showRoadworks: true,
      showHazards: true,
      showParking: true,
      showPois: true,
    });
  };

  const handleDeselectAll = () => {
    onUpdateFilters({
      showSpeedCameras: false,
      showPolice: false,
      showWardens: false,
      showRoadworks: false,
      showHazards: false,
      showParking: false,
      showPois: false,
    });
  };

  const countActive = Object.values(filters).filter(Boolean).length;

  const rows: FilterRowConfig[] = [
    {
      key: 'showSpeedCameras',
      title: 'Vaste Flitspalen & Traject',
      subtitle: 'Vaste camera\'s, trajectcontroles en flitsers',
      icon: '50',
      isEmoji: false,
      bubbleColor: '#ffffff',
      borderColor: '#ef4444',
    },
    {
      key: 'showPolice',
      title: 'Politiecontroles & Laser',
      subtitle: 'Mobiele lasercontroles en politie-inspecties',
      icon: '🚓',
      isEmoji: true,
      bubbleColor: '#1e3a8a',
    },
    {
      key: 'showWardens',
      title: 'Handhaving & Scan-auto\'s',
      subtitle: 'Scan-auto\'s en gemeentelijke parkeercontroleurs',
      icon: '👮',
      isEmoji: true,
      bubbleColor: '#0f766e',
    },
    {
      key: 'showRoadworks',
      title: 'Werkzaamheden & Afsluitingen',
      subtitle: 'Wegwerkzaamheden, afkruisingen en wegafsluitingen',
      icon: '🚧',
      isEmoji: true,
      bubbleColor: '#b45309',
    },
    {
      key: 'showHazards',
      title: 'Ongevallen & Weggevaren',
      subtitle: 'Stilstaande voertuigen, files en losliggend gevaar',
      icon: '⚠️',
      isEmoji: true,
      bubbleColor: '#b91c1c',
    },
    {
      key: 'showParking',
      title: 'Parkeerplekken & Zones',
      subtitle: 'Blauwe zones, gratis en goedkope parkeersuggesties',
      icon: '🅿️',
      isEmoji: true,
      bubbleColor: '#1d4ed8',
    },
    {
      key: 'showPois',
      title: 'Winkels, Horeca & POIs',
      subtitle: 'Cafés, restaurants en Apple Maps kaart-iconen',
      icon: '☕',
      isEmoji: true,
      bubbleColor: '#047857',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <BlurView intensity={Platform.OS === 'ios' ? 50 : 80} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          style={[
            styles.modalCard,
            {
              transform: [{ translateY: sheetSlide }, { scale: sheetScale }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.headerIcon}>👁️</Text>
                <Text style={styles.headerTitle}>KAART ICONEN & LAGEN</Text>
              </View>
              <Text style={styles.headerSub}>
                {countActive} van {rows.length} categorieën zichtbaar
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleDismiss}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Filter Actions Bar */}
          <View style={styles.quickBar}>
            <TouchableOpacity activeOpacity={0.8} onPress={handleSelectAll} style={styles.quickBtn}>
              <Text style={styles.quickBtnText}>✓ Alles tonen</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={handleDeselectAll} style={[styles.quickBtn, styles.quickBtnMuted]}>
              <Text style={[styles.quickBtnText, styles.quickBtnTextMuted]}>✕ Alles verbergen</Text>
            </TouchableOpacity>
          </View>

          {/* Toggle List */}
          <ScrollView
            style={styles.scrollList}
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {rows.map((row) => {
              const isEnabled = filters[row.key];
              return (
                <View key={row.key} style={[styles.filterRow, isEnabled && styles.filterRowActive]}>
                  {/* Icon Badge */}
                  {row.isEmoji ? (
                    <View style={[styles.iconBubble, { backgroundColor: row.bubbleColor }]}>
                      <Text style={styles.emojiText}>{row.icon}</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.signBubble,
                        { backgroundColor: row.bubbleColor, borderColor: row.borderColor },
                      ]}
                    >
                      <Text style={styles.signText}>{row.icon}</Text>
                    </View>
                  )}

                  {/* Texts */}
                  <View style={styles.textCol}>
                    <Text style={styles.itemTitle}>{row.title}</Text>
                    <Text style={styles.itemSubtitle} numberOfLines={1}>
                      {row.subtitle}
                    </Text>
                  </View>

                  {/* Switch Toggle */}
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleFilter(row.key)}
                    trackColor={{ false: '#334155', true: '#2563eb' }}
                    thumbColor={Platform.OS === 'android' ? (isEnabled ? '#ffffff' : '#94a3b8') : undefined}
                    ios_backgroundColor="#334155"
                  />
                </View>
              );
            })}
          </ScrollView>

          {/* Footer Action */}
          <TouchableOpacity activeOpacity={0.85} onPress={handleDismiss} style={styles.applyBtn}>
            <Text style={styles.applyBtnText}>Toepassen & Sluiten</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '84%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 0.6,
  },
  headerSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  quickBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickBtnMuted: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  quickBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
  },
  quickBtnTextMuted: {
    color: '#64748b',
  },
  scrollList: {
    maxHeight: 380,
  },
  scrollContainer: {
    gap: 8,
    paddingBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterRowActive: {
    borderColor: '#2563eb55',
    backgroundColor: '#1e293b',
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emojiText: {
    fontSize: 16,
  },
  signBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  signText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  textCol: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#f8fafc',
  },
  itemSubtitle: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 2,
  },
  applyBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
