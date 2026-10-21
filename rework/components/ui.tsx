// Apple Maps-flavoured UI primitives shared by every sheet and overlay.
import React, { ComponentProps } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { radius as R, shadow, smallShadow, text, Theme, ThemeColor, useTheme } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** "#RRGGBB" (or rgba passthrough) with alpha applied. */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#') || color.length !== 7) return color;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${a}`;
}

/** Resolve a theme color key or pass through a literal color. */
export function resolveColor(theme: Theme, color: ThemeColor | string): string {
  return (theme as Record<string, unknown>)[color] as string ?? color;
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return <Ionicons name={name} size={size} color={color ?? theme.label} />;
}

/**
 * Frosted material panel. Blur on iOS, near-opaque fill elsewhere.
 * `radius` clips the material; shadow stays outside the clip.
 */
export function Glass({
  radius = R.sheet,
  material = 'sheet',
  shadowed = true,
  style,
  children,
  pointerEvents,
}: {
  radius?: number;
  material?: 'sheet' | 'control' | 'dark';
  shadowed?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: ViewStyle['pointerEvents'];
}) {
  const theme = useTheme();
  const tint =
    material === 'dark' ? 'systemThickMaterialDark' : material === 'control' ? theme.controlBlurTint : theme.blurTint;
  const fallback = material === 'dark' ? 'rgba(28,28,30,0.96)' : theme.sheet;
  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius: radius }, shadowed && shadow, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} pointerEvents="none">
        {Platform.OS === 'ios' ? (
          <>
            <BlurView intensity={100} tint={tint} style={StyleSheet.absoluteFill} />
            {material !== 'dark' && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.sheetTint }]} />}
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]} />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.dark || material === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

/** Sheet grabber pill. */
export function Grabber() {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 4 }}>
      <View style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: theme.tertiaryLabel }} />
    </View>
  );
}

/** Filled circle with a white glyph: the leading icon of Apple Maps rows and place cards. */
export function IconBadge({
  icon,
  color,
  size = 30,
  glyphColor = '#FFFFFF',
}: {
  icon: IconName;
  color: string;
  size?: number;
  glyphColor?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.55)} color={glyphColor} />
    </View>
  );
}

/** Round gray button: close (xmark), share, more. */
export function CircleButton({
  icon,
  onPress,
  size = 30,
  color,
  background,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background ?? theme.tertiaryFill,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={Math.round(size * 0.58)} color={color ?? theme.secondaryLabel} />
    </Pressable>
  );
}

export function CloseButton({ onPress }: { onPress: () => void }) {
  return <CircleButton icon="close" onPress={onPress} accessibilityLabel="Close" />;
}

/**
 * Horizontal button. filled = solid color + white label (Directions, GO, End Route);
 * tinted = 15% color fill + colored label; plain = text only.
 */
export function Button({
  title,
  icon,
  onPress,
  color = 'blue',
  variant = 'filled',
  size = 'large',
  disabled,
  style,
  accessibilityLabel,
}: {
  title: string;
  icon?: IconName;
  onPress: () => void;
  color?: ThemeColor | string;
  variant?: 'filled' | 'tinted' | 'gray' | 'plain';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const c = resolveColor(theme, color);
  const height = size === 'large' ? 50 : size === 'medium' ? 40 : 30;
  const bg =
    variant === 'filled' ? c : variant === 'tinted' ? withAlpha(c, 0.15) : variant === 'gray' ? theme.tertiaryFill : 'transparent';
  const fg = variant === 'filled' ? '#FFFFFF' : c;
  const label: TextStyle = size === 'small' ? { ...text.subhead, fontWeight: '600' } : { ...text.headline };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        {
          height,
          borderRadius: size === 'small' ? height / 2 : size === 'medium' ? 12 : R.button,
          backgroundColor: bg,
          paddingHorizontal: size === 'small' ? 12 : 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={size === 'small' ? 15 : 19} color={fg} />}
      <Text style={[label, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * Stacked icon-over-label tile, as in the Apple Maps place card action row
 * (Directions / Call / Website / More). flex: 1 so a row of them shares width.
 */
export function ActionTile({
  icon,
  title,
  onPress,
  primary,
  color = 'blue',
  iconColor,
  accessibilityLabel,
  style,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
  primary?: boolean;
  color?: ThemeColor | string;
  /** Glyph-only tint (e.g. a yellow "saved" star); the label keeps `color` for contrast. */
  iconColor?: string;
  /** Defaults to `title`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const c = resolveColor(theme, color);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        {
          flex: 1,
          height: 58,
          borderRadius: 12,
          backgroundColor: primary ? c : theme.card,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={21} color={primary ? '#FFFFFF' : iconColor ?? c} />
      <Text style={[text.footnote, { fontWeight: '600', color: primary ? '#FFFFFF' : c }]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Inset-grouped container (white/elevated rounded block inside a sheet). */
export function InsetGroup({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[{ backgroundColor: theme.card, borderRadius: R.card, overflow: 'hidden', marginHorizontal: 16 }, style]}>
      {children}
    </View>
  );
}

/**
 * List row. Pass `separator` on every row except the last of a group; it is
 * inset to the text column like UIKit.
 */
export function Row({
  icon,
  iconColor,
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  onPress,
  onLongPress,
  separator,
  titleColor,
  numberOfLines = 1,
}: {
  icon?: IconName;
  iconColor?: string;
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  separator?: boolean;
  titleColor?: string;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const lead = leading ?? (icon ? <IconBadge icon={icon} color={iconColor ?? theme.gray} /> : null);
  const textInset = lead ? 16 + 30 + 12 : 16;
  const pressable = !!(onPress || onLongPress);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!pressable}
      // A static row must not group its children: its Switch / trailing button stay focusable on their own.
      accessible={pressable}
      accessibilityRole={pressable ? 'button' : undefined}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.fill : 'transparent' })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingLeft: 16, paddingRight: 12, paddingVertical: 8 }}>
        {lead && <View style={{ marginRight: 12 }}>{lead}</View>}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={[text.body, { color: titleColor ?? theme.label }]} numberOfLines={numberOfLines}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[text.footnote, { color: theme.secondaryLabel, marginTop: 1 }]} numberOfLines={numberOfLines}>
              {subtitle}
            </Text>
          )}
        </View>
        {trailing}
        {chevron && <Ionicons name="chevron-forward" size={17} color={theme.tertiaryLabel} style={{ marginLeft: 6 }} />}
      </View>
      {separator && (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: textInset }} />
      )}
    </Pressable>
  );
}

/** Bold section title with optional trailing action ("More", "Clear"). */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }, style]}>
      <Text style={[text.title3, { fontWeight: '700', color: theme.label, flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={[text.subhead, { color: theme.blue }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Small caps-free footnote heading above an inset group, UIKit style. */
export function GroupLabel({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text style={[text.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginTop: 18, marginBottom: 6 }]}>
      {children.toUpperCase()}
    </Text>
  );
}

/** Round European speed-limit sign (white disc, red ring, black number). */
export function SpeedSign({ limit, size = 44 }: { limit: number; size?: number }) {
  const digits = String(limit).length;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: Math.max(2, Math.round(size * 0.11)),
          borderColor: '#E3001B',
          alignItems: 'center',
          justifyContent: 'center',
        },
        smallShadow,
      ]}
    >
      <Text
        style={{
          color: '#000000',
          fontWeight: '800',
          fontSize: size * (digits >= 3 ? 0.32 : 0.42),
          letterSpacing: digits >= 3 ? -0.6 : -0.3,
          includeFontPadding: false,
          textAlign: 'center',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {limit}
      </Text>
    </View>
  );
}

/** iOS segmented control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: theme.tertiaryFill, borderRadius: 9, padding: 2, height: 32 }, style]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              { flex: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
              selected && [{ backgroundColor: theme.dark ? '#636366' : '#FFFFFF' }, smallShadow],
            ]}
          >
            <Text
              style={[text.footnote, { fontWeight: selected ? '600' : '500', color: theme.label }]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Native switch with the iOS green track on every platform. */
export function AppleSwitch({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={Platform.OS === 'ios' ? undefined : { false: theme.fill, true: theme.green }}
      thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
    />
  );
}

export function Hairline({ inset = 0 }: { inset?: number }) {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: inset }} />;
}
