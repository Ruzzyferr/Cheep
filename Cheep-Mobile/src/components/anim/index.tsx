/**
 * ✨ Animation primitives (premium micro-interactions)
 * Built on React Native's Animated API — no babel/worklets setup required,
 * reliable on both native and web. Inspired by reactbits.dev effects
 * (count-up, fade/slide reveal, springy press, idle float).
 */
import React, { useRef, useEffect, useState, ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  Text,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  type PressableProps,
} from 'react-native';

/** Fade + slide-up reveal on mount. Use `delay` to stagger a list/grid. */
export function FadeInUp({
  children,
  delay = 0,
  distance = 16,
  duration = 440,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(o, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [o, delay, duration]);
  const translateY = o.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  return (
    <Animated.View style={[style, { opacity: o, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

/** Count-up number (e.g. savings/prices). Eases from previous value to `value`. */
export function AnimatedNumber({
  value,
  duration = 900,
  delay = 0,
  format = (n: number) => String(Math.round(n)),
  style,
}: {
  value: number;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);
  return <Text style={style}>{format(display)}</Text>;
}

/** Springy scale-on-press wrapper for cards/buttons. */
export function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.97,
  disabled,
  ...rest
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
} & Omit<PressableProps, 'style' | 'children'>) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() =>
        Animated.spring(s, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start()
      }
      onPressOut={() =>
        Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 7 }).start()
      }
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Gentle idle float (for the mascot). */
export function Float({
  children,
  amplitude = 6,
  duration = 2200,
  style,
}: {
  children: ReactNode;
  amplitude?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}
