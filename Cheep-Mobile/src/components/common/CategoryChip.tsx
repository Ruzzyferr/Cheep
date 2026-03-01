/**
 * 🏷️ Category Chip
 * Kategori seçimi için yatay scroll chip
 */

import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface CategoryChipProps {
  label: string;
  isActive?: boolean;
  onPress: () => void;
}

export function CategoryChip({ label, isActive = false, onPress }: CategoryChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, isActive && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, isActive && styles.textActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, // Less rounded
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginRight: spacing.md,
  },

  chipActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },

  text: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },

  textActive: {
    color: colors.background.paper,
    fontWeight: '600',
  },
});

