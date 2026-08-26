/**
 * 📋 ListActionCard
 * Inline card displayed when assistant creates / modifies a list
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { shadows } from '../../theme/shadows';
import { useTranslation } from 'react-i18next';

interface ListActionCardProps {
  title: string;
  itemCount?: number;
  onPress: () => void;
  /** Liste id'si henüz yoksa kart pasif olur (görüntüleme tıklanamaz). */
  disabled?: boolean;
}

export function ListActionCard({ title, itemCount, onPress, disabled }: ListActionCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.containerDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityLabel={t('list.view_list', { title })}
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
        <Text style={styles.actionLabel}>{t('list.view')}</Text>
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
  containerDisabled: {
    opacity: 0.6,
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
