// Floating iOS 26-style sheet with snap detents, dragged by its header.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleProp, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, spring } from '../theme';
import { Glass, Grabber } from './ui';

export interface SheetProps {
  /** Content heights in px, ascending. The sheet adds the home-indicator inset on top of these. */
  detents: number[];
  /** Controlled detent index. */
  index: number;
  onIndexChange?: (index: number) => void;
  /** Called when dragged well below the lowest detent. Omit to make the sheet undismissable. */
  onDismiss?: () => void;
  /** Called after each settle with the sheet's total on-screen height (incl. bottom margin). */
  onHeightChange?: (height: number) => void;
  /** Drag-handle area content (search field, title row). Rendered under the grabber. */
  header?: React.ReactNode;
  children?: React.ReactNode;
  showGrabber?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Sheet({
  detents,
  index,
  onIndexChange,
  onDismiss,
  onHeightChange,
  header,
  children,
  showGrabber = true,
  style,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const bottomGap = spacing.sheetMargin;
  const bottomPad = Math.max(insets.bottom - bottomGap, 0);
  const maxHeight = screenH - insets.top - bottomGap - 8;
  // Larger Dynamic Type can make the header taller than a fixed detent; never cut it off.
  const [headerH, setHeaderH] = useState(0);

  const heights = useMemo(
    () => detents.map((d) => Math.min(Math.max(d, headerH) + bottomPad, maxHeight)),
    [detents.join(','), headerH, bottomPad, maxHeight]
  );
  const clampedIndex = Math.min(Math.max(index, 0), heights.length - 1);

  const height = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const dragStart = useRef(0);
  const latest = useRef({ heights, onIndexChange, onDismiss, onHeightChange, bottomGap });
  latest.current = { heights, onIndexChange, onDismiss, onHeightChange, bottomGap };

  const settle = (toValue: number, velocity = 0) => {
    current.current = toValue;
    Animated.spring(height, { toValue, velocity, useNativeDriver: false, ...spring.snappy }).start();
    latest.current.onHeightChange?.(toValue + latest.current.bottomGap);
  };

  useEffect(() => {
    settle(heights[clampedIndex]);
  }, [clampedIndex, heights]);

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      current.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        height.stopAnimation((v) => {
          dragStart.current = v;
        });
      },
      onPanResponderMove: (_, g) => {
        const { heights: hs } = latest.current;
        const next = dragStart.current - g.dy;
        const min = hs[0] * 0.5;
        const max = hs[hs.length - 1];
        // Rubber-band past the ends.
        const banded = next > max ? max + (next - max) * 0.2 : next < min ? min - (min - next) * 0.2 : next;
        height.setValue(banded);
      },
      onPanResponderRelease: (_, g) => {
        const { heights: hs, onIndexChange: change, onDismiss: dismiss } = latest.current;
        const projected = dragStart.current - g.dy - g.vy * 160;
        if (dismiss && projected < hs[0] - 70) {
          dismiss();
          return;
        }
        let best = 0;
        hs.forEach((h, i) => {
          if (Math.abs(h - projected) < Math.abs(hs[best] - projected)) best = i;
        });
        settle(hs[best], -g.vy);
        change?.(best);
      },
      onPanResponderTerminate: () => {
        const { heights: hs } = latest.current;
        let best = 0;
        hs.forEach((h, i) => {
          if (Math.abs(h - current.current) < Math.abs(hs[best] - current.current)) best = i;
        });
        settle(hs[best]);
        latest.current.onIndexChange?.(best);
      },
    })
  ).current;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: spacing.sheetMargin,
          right: spacing.sheetMargin,
          bottom: bottomGap,
          height,
        },
        style,
      ]}
    >
      <Glass radius={radius.sheet} style={{ flex: 1 }}>
        <View {...pan.panHandlers} onLayout={(e) => setHeaderH(Math.ceil(e.nativeEvent.layout.height))}>
          {showGrabber && <Grabber />}
          {header}
        </View>
        <View style={{ flex: 1, overflow: 'hidden', borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, paddingBottom: bottomPad }}>
          {children}
        </View>
      </Glass>
    </Animated.View>
  );
}
