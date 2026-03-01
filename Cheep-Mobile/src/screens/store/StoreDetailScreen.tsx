/**
 * 🏪 Store Detail Screen
 * Store information and products
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../theme';
import type { HomeStackScreenProps } from '../../navigation/types';

export function StoreDetailScreen({
  route,
}: HomeStackScreenProps<'StoreDetail'>) {
  const { storeId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Store Detail - ID: {storeId}</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    padding: spacing.xl,
  },
  text: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },
});

