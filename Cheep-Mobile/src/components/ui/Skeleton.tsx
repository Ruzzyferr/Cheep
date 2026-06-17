/**
 * 💀 Skeleton
 * Cross-platform shimmer placeholder (RN Animated opacity pulse — works on web too).
 * Use the base <Skeleton/> for boxes, or the composed layouts below for whole screens.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle, StyleProp, ScrollView } from 'react-native';
import { colors, spacing, borderRadius, layout } from '../../theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, radius = borderRadius.sm, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { width: width as ViewStyle['width'], height, borderRadius: radius, backgroundColor: colors.border.main, opacity: pulse },
        style,
      ]}
    />
  );
}

/** Horizontal row of deal-card skeletons (Home · Akıllı Fırsatlar). */
export function DealCardsSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false}
      contentContainerStyle={{ paddingHorizontal: layout.screenPadding, gap: spacing.sm }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={sk.dealCard}>
          <Skeleton height={80} radius={0} />
          <View style={{ padding: spacing.sm, gap: spacing.xs }}>
            <Skeleton width="90%" height={13} />
            <Skeleton width="50%" height={10} />
            <Skeleton width="60%" height={18} style={{ marginTop: spacing.xs }} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** Vertical stack of list/row skeletons (Lists · Deals · search results). */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={{ padding: layout.screenPadding, gap: spacing.md }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={sk.row}>
          <Skeleton width={56} height={56} radius={borderRadius.md} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Skeleton width="70%" height={15} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={64} height={24} radius={borderRadius.sm} />
        </View>
      ))}
    </View>
  );
}

/** Two-column product grid skeleton (Category products). */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={sk.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={sk.gridCard}>
          <Skeleton height={110} radius={borderRadius.md} />
          <Skeleton width="85%" height={13} style={{ marginTop: spacing.sm }} />
          <Skeleton width="50%" height={11} style={{ marginTop: spacing.xs }} />
          <Skeleton width="60%" height={18} style={{ marginTop: spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  dealCard: {
    width: 144,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  gridCard: {
    width: '47%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.sm,
  },
});
