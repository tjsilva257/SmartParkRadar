// "6 & 7" easter egg: two vibrating number cards, a buzz pattern and a shouted "Six! Seven!".
import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StatusBar, StyleSheet, Text, Vibration, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Accelerometer } from 'expo-sensors';
import * as Speech from 'expo-speech';
import { shadow, text, useTheme } from '../theme';
import { Button, Glass, withAlpha } from './ui';

const OPEN_PATTERN = [0, 80, 40, 100, 40, 120, 50, 150];
const HARDER_PATTERN = [0, 100, 50, 150, 50, 200];
// Same tuning as the old useShakeDetector.
const SHAKE_DELTA = 2.3;
const SHAKE_FORCE = 2.8;
const SHAKE_INTERVAL_MS = 1600;

function shout(phrase: string, pitch: number, rate: number) {
  try {
    Speech.stop();
    Speech.speak(phrase, { language: 'en-US', pitch, rate });
  } catch {
    // Speech can be unavailable on emulators; the vibration still sells it.
  }
}

type Step = [toValue: number, duration: number];

function jitter(value: Animated.Value, steps: Step[]) {
  return Animated.sequence(
    steps.map(([toValue, duration]) => Animated.timing(value, { toValue, duration, useNativeDriver: true }))
  );
}

function useNumberShake(shake: Step[], rotate: Step[], scale: Step[]) {
  const x = useRef(new Animated.Value(0)).current;
  const r = useRef(new Animated.Value(0)).current;
  const s = useRef(new Animated.Value(1)).current;
  const transform = [
    { translateX: x },
    { rotate: r.interpolate({ inputRange: [-15, 15], outputRange: ['-15deg', '15deg'] }) },
    { scale: s },
  ];
  // A stopped Animated.loop can't be restarted, so each open builds a fresh one.
  const start = () => {
    const loop = Animated.loop(Animated.parallel([jitter(x, shake), jitter(r, rotate), jitter(s, scale)]));
    loop.start();
    return () => {
      loop.stop();
      x.setValue(0);
      r.setValue(0);
      s.setValue(1);
    };
  };
  return { start, transform };
}

export function MemeShake({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element | null {
  const theme = useTheme();
  const white = theme.navBannerText;
  const secondary = withAlpha(white, 0.62);

  // Two slightly different rhythms so the pair never shakes in sync.
  const six = useNumberShake(
    [[-14, 40], [14, 40], [-10, 35], [10, 35], [0, 30]],
    [[-12, 45], [12, 45], [-8, 40], [8, 40], [0, 35]],
    [[1.12, 70], [0.92, 70], [1, 50]]
  );
  const seven = useNumberShake(
    [[15, 45], [-15, 45], [11, 38], [-11, 38], [0, 32]],
    [[14, 42], [-14, 42], [9, 36], [-9, 36], [0, 30]],
    [[0.9, 65], [1.14, 65], [1, 55]]
  );
  const tremor = useRef(new Animated.Value(0)).current;

  const shakeHarder = useCallback(() => {
    Vibration.vibrate(HARDER_PATTERN);
    shout('Six! Seven! Shake it!', 1.4, 1.2);
  }, []);

  useEffect(() => {
    if (!visible) return;
    Vibration.vibrate(OPEN_PATTERN);
    shout('Six! Seven!', 1.3, 1.15);
    const stopSix = six.start();
    const stopSeven = seven.start();
    const tremorLoop = Animated.loop(jitter(tremor, [[-4, 30], [4, 30], [0, 25]]));
    tremorLoop.start();

    // Shaking the phone while open goes again.
    let subscription: { remove: () => void } | null = null;
    try {
      let last: { x: number; y: number; z: number } | null = null;
      // Let the opening shout finish before a shake can re-trigger it.
      let lastShake = Date.now();
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener(({ x, y, z }) => {
        const now = Date.now();
        if (last) {
          const delta = Math.abs(x - last.x) + Math.abs(y - last.y) + Math.abs(z - last.z);
          const force = Math.sqrt(x * x + y * y + z * z);
          if ((delta > SHAKE_DELTA || force > SHAKE_FORCE) && now - lastShake > SHAKE_INTERVAL_MS) {
            lastShake = now;
            shakeHarder();
          }
        }
        last = { x, y, z };
      });
    } catch {
      // No accelerometer (simulator/web): the button still works.
    }

    return () => {
      subscription?.remove();
      stopSix();
      stopSeven();
      tremorLoop.stop();
      tremor.setValue(0);
      Vibration.cancel();
      Speech.stop();
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Light glyphs over the dark backdrop; RN restores MapScreen's style when this unmounts. */}
        <StatusBar barStyle="light-content" animated />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <BlurView intensity={70} tint="systemMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.shadow, 0.45) }]} />
        </Pressable>

        <Animated.View style={[styles.cardWrap, { transform: [{ translateY: tremor }] }]}>
          <Glass material="dark" radius={32} style={styles.card}>
            <Text style={styles.sirens}>🚨 📱 🚨</Text>
            <Text style={[text.largeTitle, { color: white, textAlign: 'center' }]} accessibilityRole="header">
              6 & 7
            </Text>
            <Text style={[text.subhead, { color: secondary, textAlign: 'center', marginTop: 2 }]}>
              POV: you searched “6-7” in Maps
            </Text>

            <View style={styles.numbers}>
              <NumberCard
                digit="6"
                corner="💦"
                eyes="👀"
                tag="SHIVERING 🥶"
                color={theme.blue}
                transform={six.transform}
              />
              <View style={styles.vs}>
                <Text style={styles.bolt}>⚡</Text>
                <Text style={[text.caption2, { color: theme.yellow, fontWeight: '800', letterSpacing: 1.2 }]}>SHAKE</Text>
                <Text style={styles.bolt}>⚡</Text>
              </View>
              <NumberCard
                digit="7"
                corner="😈"
                eyes="🕶️"
                tag="AGGRESSIVE 💥"
                color={theme.pink}
                transform={seven.transform}
              />
            </View>

            <View style={[styles.punchline, { backgroundColor: withAlpha(white, 0.08) }]}>
              <Text style={[text.headline, { color: white, fontStyle: 'italic', textAlign: 'center' }]}>
                “Why was 6 afraid of 7?”
              </Text>
              <Text style={[text.footnote, { color: secondary, textAlign: 'center', marginTop: 4 }]}>
                Because 7 8 9! Now they’re both just vibrating. 🤣
              </Text>
            </View>

            <Text style={[text.caption1, { color: secondary, textAlign: 'center', marginBottom: 12 }]}>
              Shake your phone to go again
            </Text>

            <View style={styles.actions}>
              <Button title="Shake Harder!" icon="flash" onPress={shakeHarder} style={{ flex: 1 }} />
              <Button title="Close" onPress={onClose} color={withAlpha(white, 0.16)} style={{ paddingHorizontal: 22 }} />
            </View>
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

function NumberCard({
  digit,
  corner,
  eyes,
  tag,
  color,
  transform,
}: {
  digit: string;
  corner: string;
  eyes: string;
  tag: string;
  color: string;
  transform: ReturnType<typeof useNumberShake>['transform'];
}) {
  const theme = useTheme();
  return (
    <Animated.View style={[styles.numberCard, shadow, { backgroundColor: color, shadowColor: color, transform }]}>
      <Text style={styles.corner}>{corner}</Text>
      <Text style={styles.eyes}>{eyes}</Text>
      <Text style={[styles.digit, { color: theme.navBannerText, textShadowColor: withAlpha(theme.shadow, 0.35) }]}>
        {digit}
      </Text>
      <View style={[styles.tag, { backgroundColor: withAlpha(theme.shadow, 0.3) }]}>
        <Text
          style={[text.caption2, { color: theme.navBannerText, fontWeight: '800', letterSpacing: 0.4 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {tag}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  cardWrap: { width: '100%', maxWidth: 380 },
  card: { padding: 20 },
  sirens: { fontSize: 18, letterSpacing: 4, textAlign: 'center', marginBottom: 2 },
  numbers: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  vs: { alignItems: 'center', gap: 4 },
  bolt: { fontSize: 18 },
  numberCard: {
    flex: 1,
    height: 168,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  corner: { position: 'absolute', top: 8, right: 8, fontSize: 18 },
  eyes: { fontSize: 24, marginBottom: -6 },
  digit: {
    fontSize: 76,
    lineHeight: 84,
    fontWeight: '900',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 6,
    includeFontPadding: false,
  },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, maxWidth: '100%' },
  punchline: { borderRadius: 16, padding: 14, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
});
