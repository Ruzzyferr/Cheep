/**
 * 📊 Stats Card
 * Statistics card component (savings, price index, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface StatsCardProps {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
}

export function StatsCard({
  icon,
  iconColor,
  label,
  value,
  badge,
  badgeColor,
  onPress,
}: StatsCardProps) {
  const content = (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name={icon as any} size={24} color={iconColor} />
        {badge && (
          <View style={[styles.badge, badgeColor && { backgroundColor: badgeColor }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },

  badge: {
    backgroundColor: colors.secondary.main,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  badgeText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.background.paper,
  },

  label: {
    ...typography.styles.overline,
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },

  value: {
    ...typography.styles.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
});


