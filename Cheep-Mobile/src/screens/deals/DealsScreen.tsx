/**
 * 🎯 Deals Screen
 * Special offers and deals
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing, layout } from '../../theme';

export function DealsScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Fırsatlar</Text>
      </View>

      {/* Content */}
      <EmptyState
        icon="🎯"
        title="Fırsatlar Çok Yakında!"
        description="En iyi indirimleri ve kampanyaları burada bulacaksınız"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  header: {
    backgroundColor: colors.background.paper,
    padding: layout.screenPadding,
    paddingTop: spacing.xl,
  },

  title: {
    ...typography.styles.h1,
    color: colors.text.primary,
  },
});

