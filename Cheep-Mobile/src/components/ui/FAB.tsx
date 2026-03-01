/**
 * ➕ Floating Action Button
 * Main action button (create list)
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';
import { shadows } from '../../theme/shadows';

interface FABProps {
  onPress: () => void;
  icon: React.ReactNode;
  style?: ViewStyle;
}

export function FAB({ onPress, icon, style }: FABProps) {
  return (
    <TouchableOpacity
      style={[styles.fab, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 80, // Tab bar height + spacing
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 8, // Less rounded, more tool-like
    backgroundColor: colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
});

