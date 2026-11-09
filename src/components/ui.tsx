import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated, Easing, Platform, Pressable, StyleSheet, Text,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { colors, fonts } from '../lib/theme';

export const native = Platform.OS !== 'web';

export const buzz = (kind: 'light' | 'medium' | 'heavy' | 'select' = 'light') => {
  if (!native) return;
  if (kind === 'select') { Haptics.selectionAsync().catch(() => {}); return; }
  const style = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy }[kind];
  Haptics.impactAsync(style).catch(() => {});
};

/* ───────────────────────── Press: tactile wrapper ───────────────────────── */

type PressProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Lift + deepen shadow on hover (cards). */
  lift?: boolean;
  depth?: number;
  haptic?: 'light' | 'medium' | 'none';
  label?: string;
  hitSlop?: number;
  /** Style for the outer touch target (e.g. flex: 1 in a row). */
  outerStyle?: StyleProp<ViewStyle>;
};

/**
 * Lifts on hover, sinks with a spring on press, ticks the haptic engine.
 * Every tappable thing in RotBlock goes through this.
 */
export function Press({ children, onPress, style, lift = false, depth = 0.96, haptic = 'light', label, hitSlop, outerStyle }: PressProps) {
  const press = useState(() => new Animated.Value(0))[0];
  const hover = useState(() => new Animated.Value(0))[0];
  const spring = (v: Animated.Value, toValue: number, snappy = false) =>
    Animated.spring(v, { toValue, useNativeDriver: false, speed: snappy ? 40 : 16, bounciness: snappy ? 0 : 8 }).start();

  const scale = Animated.add(
    press.interpolate({ inputRange: [0, 1], outputRange: [1, depth] }),
    hover.interpolate({ inputRange: [0, 1], outputRange: [0, lift ? 0.01 : 0.03] }),
  );
  const translateY = hover.interpolate({ inputRange: [0, 1], outputRange: [0, lift ? -4 : -1] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlop}
      style={outerStyle}
      onPress={onPress}
      onPressIn={() => { spring(press, 1, true); if (haptic !== 'none') buzz(haptic); }}
      onPressOut={() => spring(press, 0)}
      onHoverIn={() => spring(hover, 1)}
      onHoverOut={() => spring(hover, 0)}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ translateY }, { scale }] },
          lift && {
            shadowColor: colors.ink,
            shadowOffset: { width: 0, height: 10 },
            shadowRadius: hover.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) as unknown as number,
            shadowOpacity: hover.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] }) as unknown as number,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────────── Motion ───────────────────────── */

/** Fade + rise on mount. */
export function Rise({ children, delay = 0, style, distance = 16 }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Number that counts up whenever it changes. */
export function CountUp({ value, style }: { value: number; style?: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 1000);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <Text style={[style, { fontVariant: ['tabular-nums'] }]}>{shown}</Text>;
}

/* ───────────────────────── Toggle ───────────────────────── */

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const v = useState(() => new Animated.Value(value ? 1 : 0))[0];
  const p = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(v, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 16, bounciness: 8 }).start();
  }, [value, v]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPressIn={() => Animated.spring(p, { toValue: 1, useNativeDriver: false, speed: 40 }).start()}
      onPressOut={() => Animated.spring(p, { toValue: 0, useNativeDriver: false, speed: 20 }).start()}
      onPress={() => { buzz('select'); onChange(!value); }}
    >
      <Animated.View style={[s.track, { backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [colors.track, colors.accent] }) }]}>
        <Animated.View
          style={[
            s.knob,
            {
              width: p.interpolate({ inputRange: [0, 1], outputRange: [24, 30] }),
              // knob stretches on press; keep its right edge inside the track
              left: Animated.add(3, Animated.multiply(v, p.interpolate({ inputRange: [0, 1], outputRange: [22, 16] }))),
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ───────────────────────── Brand ───────────────────────── */

export function Wordmark({ size = 18 }: { size?: number }) {
  return <Text style={{ fontFamily: fonts.black, fontSize: size, letterSpacing: size * 0.14, color: colors.ink }}>ROTBLOCK</Text>;
}

const s = StyleSheet.create({
  track: { width: 54, height: 30, borderRadius: 999, justifyContent: 'center' },
  knob: { position: 'absolute', height: 24, borderRadius: 999, backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
