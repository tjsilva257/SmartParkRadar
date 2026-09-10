import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';

interface MemeShakeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MemeShakeModal: React.FC<MemeShakeModalProps> = ({ visible, onClose }) => {
  // Animation values for 6
  const shake6Anim = useRef(new Animated.Value(0)).current;
  const rotate6Anim = useRef(new Animated.Value(0)).current;
  const scale6Anim = useRef(new Animated.Value(1)).current;

  // Animation values for 7
  const shake7Anim = useRef(new Animated.Value(0)).current;
  const rotate7Anim = useRef(new Animated.Value(0)).current;
  const scale7Anim = useRef(new Animated.Value(1)).current;

  // Global screen tremor
  const containerTremor = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Trigger physical phone vibration pattern
    Vibration.vibrate([0, 80, 40, 100, 40, 120, 50, 150]);

    // Meme voice announcement using expo-speech
    try {
      Speech.speak('Six! Seven!', {
        language: 'en-US',
        pitch: 1.3,
        rate: 1.15,
      });
    } catch {
      // Ignore if speech fails on emulator
    }

    // Continuous violent shake loop for 6
    const anim6 = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(shake6Anim, { toValue: -14, duration: 40, useNativeDriver: true }),
          Animated.timing(shake6Anim, { toValue: 14, duration: 40, useNativeDriver: true }),
          Animated.timing(shake6Anim, { toValue: -10, duration: 35, useNativeDriver: true }),
          Animated.timing(shake6Anim, { toValue: 10, duration: 35, useNativeDriver: true }),
          Animated.timing(shake6Anim, { toValue: 0, duration: 30, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rotate6Anim, { toValue: -12, duration: 45, useNativeDriver: true }),
          Animated.timing(rotate6Anim, { toValue: 12, duration: 45, useNativeDriver: true }),
          Animated.timing(rotate6Anim, { toValue: -8, duration: 40, useNativeDriver: true }),
          Animated.timing(rotate6Anim, { toValue: 8, duration: 40, useNativeDriver: true }),
          Animated.timing(rotate6Anim, { toValue: 0, duration: 35, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale6Anim, { toValue: 1.12, duration: 70, useNativeDriver: true }),
          Animated.timing(scale6Anim, { toValue: 0.92, duration: 70, useNativeDriver: true }),
          Animated.timing(scale6Anim, { toValue: 1, duration: 50, useNativeDriver: true }),
        ]),
      ])
    );

    // Continuous violent shake loop for 7 (slightly offset frequency for chaotic meme energy)
    const anim7 = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(shake7Anim, { toValue: 15, duration: 45, useNativeDriver: true }),
          Animated.timing(shake7Anim, { toValue: -15, duration: 45, useNativeDriver: true }),
          Animated.timing(shake7Anim, { toValue: 11, duration: 38, useNativeDriver: true }),
          Animated.timing(shake7Anim, { toValue: -11, duration: 38, useNativeDriver: true }),
          Animated.timing(shake7Anim, { toValue: 0, duration: 32, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rotate7Anim, { toValue: 14, duration: 42, useNativeDriver: true }),
          Animated.timing(rotate7Anim, { toValue: -14, duration: 42, useNativeDriver: true }),
          Animated.timing(rotate7Anim, { toValue: 9, duration: 36, useNativeDriver: true }),
          Animated.timing(rotate7Anim, { toValue: -9, duration: 36, useNativeDriver: true }),
          Animated.timing(rotate7Anim, { toValue: 0, duration: 30, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(scale7Anim, { toValue: 0.9, duration: 65, useNativeDriver: true }),
          Animated.timing(scale7Anim, { toValue: 1.14, duration: 65, useNativeDriver: true }),
          Animated.timing(scale7Anim, { toValue: 1, duration: 55, useNativeDriver: true }),
        ]),
      ])
    );

    // Global ambient tremor
    const tremorAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(containerTremor, { toValue: -4, duration: 30, useNativeDriver: true }),
        Animated.timing(containerTremor, { toValue: 4, duration: 30, useNativeDriver: true }),
        Animated.timing(containerTremor, { toValue: 0, duration: 25, useNativeDriver: true }),
      ])
    );

    anim6.start();
    anim7.start();
    tremorAnim.start();

    return () => {
      anim6.stop();
      anim7.stop();
      tremorAnim.stop();
      shake6Anim.setValue(0);
      rotate6Anim.setValue(0);
      scale6Anim.setValue(1);
      shake7Anim.setValue(0);
      rotate7Anim.setValue(0);
      scale7Anim.setValue(1);
      containerTremor.setValue(0);
    };
  }, [visible]);

  if (!visible) return null;

  const rotate6 = rotate6Anim.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg'],
  });

  const rotate7 = rotate7Anim.interpolate({
    inputRange: [-15, 15],
    outputRange: ['-15deg', '15deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.backdrop}>
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 90} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: containerTremor }],
            },
          ]}
        >
          {/* Top Meme Banner */}
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerEmoji}>🚨 💥 📱 💥 🚨</Text>
            <Text style={styles.bannerTitle}>6 & 7 SHAKING MEME</Text>
            <Text style={styles.bannerSubtitle}>POV: Je hebt je scherm geschud!</Text>
          </View>

          {/* Shaking Meme Characters Row */}
          <View style={styles.charactersRow}>
            {/* NUMBER 6: Shivering in pure panic */}
            <Animated.View
              style={[
                styles.characterBox,
                styles.box6,
                {
                  transform: [
                    { translateX: shake6Anim },
                    { rotate: rotate6 },
                    { scale: scale6Anim },
                  ],
                },
              ]}
            >
              <Text style={styles.sweatEmoji}>💦</Text>
              <View style={styles.eyesRow}>
                <Text style={styles.eyeEmoji}>👀</Text>
              </View>
              <Text style={styles.numberText6}>6</Text>
              <View style={styles.shiverTag}>
                <Text style={styles.shiverTagText}>BEVEND 🥶</Text>
              </View>
            </Animated.View>

            {/* Versus / Shake connector */}
            <View style={styles.shakeMiddle}>
              <Text style={styles.shakeVibeEmoji}>⚡</Text>
              <Text style={styles.shakeVibeText}>SHAKE</Text>
              <Text style={styles.shakeVibeEmoji}>⚡</Text>
            </View>

            {/* NUMBER 7: Aggressive vibrating menace */}
            <Animated.View
              style={[
                styles.characterBox,
                styles.box7,
                {
                  transform: [
                    { translateX: shake7Anim },
                    { rotate: rotate7 },
                    { scale: scale7Anim },
                  ],
                },
              ]}
            >
              <Text style={styles.devilEmoji}>😈</Text>
              <View style={styles.eyesRow}>
                <Text style={styles.eyeEmoji}>🕶️</Text>
              </View>
              <Text style={styles.numberText7}>7</Text>
              <View style={[styles.shiverTag, styles.shiverTag7]}>
                <Text style={styles.shiverTagText}>AGGRESSIVE 💥</Text>
              </View>
            </Animated.View>
          </View>

          {/* Meme Catchphrase & Soundboard action */}
          <View style={styles.punchlineCard}>
            <Text style={styles.punchlineText}>"Why was 6 afraid of 7...?"</Text>
            <Text style={styles.punchlineSub}>Because 7 8 9! But now both are just vibrating wildly 🤣</Text>
          </View>

          {/* Bottom Action Controls */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Vibration.vibrate([0, 100, 50, 150, 50, 200]);
                Speech.speak('Six! Seven! Shake it!', { pitch: 1.4, rate: 1.2 });
              }}
              style={styles.shakeAgainBtn}
            >
              <Text style={styles.shakeAgainText}>SCHUD NOG HARDER!</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Sluiten</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0f172a',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#38bdf8',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  bannerBadge: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bannerEmoji: {
    fontSize: 16,
    letterSpacing: 4,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#f8fafc',
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: '#38bdf8',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bannerSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 4,
  },
  charactersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 14,
    width: '100%',
  },
  characterBox: {
    width: 120,
    height: 160,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 3,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  box6: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
  },
  box7: {
    backgroundColor: '#be123c',
    borderColor: '#f43f5e',
    shadowColor: '#f43f5e',
  },
  sweatEmoji: {
    position: 'absolute',
    top: 6,
    right: 6,
    fontSize: 18,
  },
  devilEmoji: {
    position: 'absolute',
    top: 6,
    right: 6,
    fontSize: 18,
  },
  eyesRow: {
    marginBottom: -4,
  },
  eyeEmoji: {
    fontSize: 24,
  },
  numberText6: {
    fontSize: 72,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 6,
    lineHeight: 80,
  },
  numberText7: {
    fontSize: 72,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 6,
    lineHeight: 80,
  },
  shiverTag: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  shiverTag7: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  shiverTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  shakeMiddle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shakeVibeEmoji: {
    fontSize: 18,
  },
  shakeVibeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 1,
    marginVertical: 4,
  },
  punchlineCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  punchlineText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
    fontStyle: 'italic',
  },
  punchlineSub: {
    fontSize: 11,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  shakeAgainBtn: {
    flex: 1,
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  shakeAgainText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  closeBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f8fafc',
  },
});

