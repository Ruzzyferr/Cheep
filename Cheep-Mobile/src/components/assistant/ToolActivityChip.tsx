/**
 * 🔧 ToolActivityChip
 * Faint inline chip indicating an assistant tool is running / ran
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface ToolActivityChipProps {
  label: string;
}

export function ToolActivityChip({ label }: ToolActivityChipProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🔧 {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.primary['50'],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary['200'],
  },
  text: {
    ...typography.styles.caption,
    color: colors.primary.dark,
  },
});
