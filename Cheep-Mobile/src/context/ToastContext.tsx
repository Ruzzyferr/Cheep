/**
 * 🔔 Toast context
 *
 * Hafif, kesintisiz geri bildirim (ör. "X listesine eklendi") için küçük bir alt
 * bildirim. Alert gibi akışı kesmez. Tab çubuğunun ve sistem navigasyon çubuğunun
 * ÜSTÜNDE konumlanır (safe-area) — nav bar arkasında kalmaz.
 */
import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

interface ToastContextType {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 90 }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => finished && setMessage(null)
      );
    }, 1800);
  }, [anim]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              bottom: insets.bottom + 84, // tab çubuğu + safe-area üstü
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          <View style={styles.toast}>
            <MaterialIcons name="check-circle" size={18} color={colors.background.paper} />
            <Text style={styles.text} numberOfLines={2}>{message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  return ctx ?? { show: () => {} };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
    backgroundColor: colors.primary.dark,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.md,
  },
  text: {
    ...typography.styles.body2,
    color: colors.background.paper,
    fontWeight: '600',
    flexShrink: 1,
  },
});
