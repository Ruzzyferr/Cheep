/**
 * 🌵 Empty State
 * Premium empty state: tinted circular icon badge, refined copy, primary CTA.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '../ui';
import { CheepMascot, type MascotExpression } from '../brand/CheepMascot';
import { colors, typography, spacing } from '../../theme';

interface EmptyStateProps {
  /** MaterialIcons name (preferred) — falls back to emoji string if not found. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  /** Legacy emoji support. */
  emoji?: string;
  /** Show the Cheep mascot instead of an icon badge (friendlier empty states). */
  mascot?: MascotExpression;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = 'inbox',
  emoji,
  mascot,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [fade, lift]);

  return (
    <Animated.View style={[styles.container, { opacity: fade, transform: [{ translateY: lift }] }]}>
      {mascot ? (
        <View style={styles.mascotWrap}>
          <CheepMascot size={104} expression={mascot} />
        </View>
      ) : (
        <View style={styles.badge}>
          {emoji ? (
            <Text style={styles.emoji}>{emoji}</Text>
          ) : (
            <MaterialIcons name={icon} size={40} color={colors.primary.main} />
          )}
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} style={styles.button} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  mascotWrap: {
    marginBottom: spacing.lg,
  },

  emoji: {
    fontSize: 44,
  },

  title: {
    ...typography.styles.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontWeight: '700',
  },

  description: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 280,
    lineHeight: 22,
  },

  button: {
    marginTop: spacing.xs,
    minWidth: 200,
  },
});
