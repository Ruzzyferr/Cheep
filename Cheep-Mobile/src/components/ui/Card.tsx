/**
 * 🃏 Card Component
 * Reusable card container
 */

import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: keyof typeof spacing | 'none';
  style?: ViewStyle;
}

export function Card({
  children,
  onPress,
  variant = 'default',
  padding = 'md',
  style,
}: CardProps) {
  const cardStyles = [
    styles.card,
    styles[variant],
    padding !== 'none' && { padding: spacing[padding as keyof typeof spacing] },
    style,
  ].filter(Boolean);

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyles} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyles}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },

  default: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  outlined: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.main,
  },

  elevated: {
    backgroundColor: colors.background.card,
    ...shadows.card,
  },
});

