import { Platform, TextStyle, useColorScheme } from 'react-native';
import type { BlurTint } from 'expo-blur';

// iOS system colors (UIColor semantic colors), light + dark.
const light = {
  dark: false,
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.29)',
  background: '#FFFFFF',
  secondaryBackground: '#F2F2F7',
  groupedBackground: '#F2F2F7',
  card: '#FFFFFF', // secondarySystemGroupedBackground: rows/cards inside a sheet
  fill: 'rgba(120,120,128,0.2)',
  secondaryFill: 'rgba(120,120,128,0.16)',
  tertiaryFill: 'rgba(118,118,128,0.12)',
  // Sheet backing used where blur is unavailable (Android) or under the blur as a tint.
  sheet: 'rgba(242,242,247,0.97)',
  sheetTint: 'rgba(255,255,255,0.35)',
  blurTint: 'systemThickMaterialLight' as BlurTint,
  controlBlurTint: 'systemMaterialLight' as BlurTint,
  blue: '#007AFF',
  green: '#34C759',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  purple: '#AF52DE',
  teal: '#30B0C7',
  indigo: '#5856D6',
  pink: '#FF2D55',
  mint: '#00C7BE',
  brown: '#A2845E',
  gray: '#8E8E93',
  gray2: '#AEAEB2',
  // Map overlays
  routeMain: '#007AFF',
  routeAlt: 'rgba(0,122,255,0.38)',
  routeWalk: '#007AFF',
  fog: 'rgba(28,28,30,0.72)',
  navBanner: '#1C1C1E',
  navBannerText: '#FFFFFF',
  shadow: '#000000',
};

const dark: typeof light = {
  dark: true,
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.6)',
  background: '#000000',
  secondaryBackground: '#1C1C1E',
  groupedBackground: '#000000',
  card: '#2C2C2E',
  fill: 'rgba(120,120,128,0.36)',
  secondaryFill: 'rgba(120,120,128,0.32)',
  tertiaryFill: 'rgba(118,118,128,0.24)',
  sheet: 'rgba(28,28,30,0.97)',
  sheetTint: 'rgba(28,28,30,0.35)',
  blurTint: 'systemThickMaterialDark',
  controlBlurTint: 'systemMaterialDark',
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  purple: '#BF5AF2',
  teal: '#40C8E0',
  indigo: '#5E5CE6',
  pink: '#FF375F',
  mint: '#63E6E2',
  brown: '#AC8E68',
  gray: '#8E8E93',
  gray2: '#636366',
  routeMain: '#0A84FF',
  routeAlt: 'rgba(10,132,255,0.42)',
  routeWalk: '#0A84FF',
  fog: 'rgba(0,0,0,0.78)',
  navBanner: '#1C1C1E',
  navBannerText: '#FFFFFF',
  shadow: '#000000',
};

export type Theme = typeof light;
export type ThemeColor = Exclude<
  {
    [K in keyof Theme]: Theme[K] extends string ? K : never;
  }[keyof Theme],
  'blurTint' | 'controlBlurTint'
>;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

// iOS Dynamic Type sizes at the default "Large" setting.
export const text = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, fontWeight: '400', letterSpacing: 0.07 },
} satisfies Record<string, TextStyle>;

// Tabular digits for speeds, ETAs and distances that tick.
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const radius = {
  sheet: 32, // iOS 26 floating sheet
  card: 14, // inset-grouped list
  button: 14,
  control: 22, // floating map control capsule
};

export const spacing = {
  gutter: 16, // content inset inside sheets
  sheetMargin: 8, // floating sheet inset from screen edges
};

// Apple-ish springs for RN Animated.spring.
export const spring = {
  snappy: { stiffness: 320, damping: 32, mass: 1 },
  bouncy: { stiffness: 260, damping: 18, mass: 1 },
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 10 },
});

export const smallShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  default: { elevation: 4 },
});
