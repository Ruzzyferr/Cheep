/**
 * 📋 ListActionCard
 * Inline card displayed when assistant creates / modifies a list
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { shadows } from '../../theme/shadows';

interface ListActionCardProps {
  title: string;
  itemCount?: number;
  onPress: () => void;
}

export function ListActionCard({ title, itemCount, onPress }: ListActionCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${title} listesini görüntüle`}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.iconEmoji}>📋</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {itemCount !== undefined && (
          <Text style={styles.meta}>{itemCount} ürün</Text>
        )}
      </View>
      <View style={styles.action}>
        <Text style={styles.actionLabel}>Görüntüle</Text>
        <MaterialIcons name="chevron-right" size={18} color={colors.primary.main} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary['200'],
    ...shadows.sm,
  },
  iconWrap: {
    marginRight: spacing.sm,
  },
  iconEmoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
  },
  title: {
    ...typography.styles.subtitle2,
    color: colors.text.primary,
  },
  meta: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionLabel: {
    ...typography.styles.caption,
    color: colors.primary.main,
    fontWeight: '600',
    marginRight: 2,
  },
});
