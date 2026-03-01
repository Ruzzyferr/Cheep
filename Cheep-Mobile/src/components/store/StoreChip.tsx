/**
 * 🏪 Store Chip
 * Store badge/chip component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface StoreChipProps {
  storeName: string;
  onPress?: () => void;
  selected?: boolean;
}

export function StoreChip({ storeName, onPress, selected = false }: StoreChipProps) {
  const storeColor = getStoreColor(storeName);

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.chip,
        { backgroundColor: selected ? storeColor : colors.background.input },
        selected && styles.selected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.text,
          { color: selected ? colors.background.paper : colors.text.primary },
        ]}
      >
        {storeName}
      </Text>
    </Component>
  );
}

// Get store brand color
function getStoreColor(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('bim')) return colors.storeChips.bim;
  if (nameLower.includes('migros')) return colors.storeChips.migros;
  if (nameLower.includes('a101')) return colors.storeChips.a101;
  if (nameLower.includes('şok') || nameLower.includes('sok')) return colors.storeChips.sok;
  if (nameLower.includes('carrefour')) return colors.storeChips.carrefoursa;
  return colors.primary.main;
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },

  selected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  text: {
    ...typography.styles.body2,
    fontWeight: '600',
  },
});

