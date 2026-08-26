/**
 * 📋 List Card
 * Shopping list card component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { useLocale } from '../../context/LocaleContext';
import {colors, typography, spacing, borderRadius} from '../../theme';
import type { ShoppingList } from '../../types';
import { appAlert } from '../../utils/dialog';

interface ListCardProps {
  list: ShoppingList;
  onPress: () => void;
  onDelete?: (listId: number) => void;
}

export function ListCard({ list, onPress, onDelete }: ListCardProps) {
  const { t } = useTranslation();
  const { formatMoney, formatDate } = useLocale();
  const itemCount = list.list_items?.length || 0;
  const budget = list.budget ? parseFloat(list.budget) : null;

  const handleDelete = (e: any) => {
    e.stopPropagation();
    if (onDelete) {
      appAlert(
        t('list.delete_title'),
        t('list.delete_confirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('list.delete_action'),
            style: 'destructive',
            onPress: () => onDelete(list.id),
          },
        ]
      );
    }
  };

  return (
    <Card onPress={onPress} padding="md" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name}>{list.name}</Text>
          {list.status === 'active' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('list.active_badge')}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.itemCount}>{t('list.item_count', { count: itemCount })}</Text>
          {onDelete && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <MaterialIcons name="delete-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {budget && (
        <View style={styles.budget}>
          <Text style={styles.budgetLabel}>{t('list.budget_display')}</Text>
          <Text style={styles.budgetAmount}>{formatMoney(budget)}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.date}>
          {formatDate(list.updated_at)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },

  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  deleteButton: {
    padding: spacing.xs,
  },

  name: {
    ...typography.styles.h4,
    color: colors.text.primary,
    marginRight: spacing.sm,
    fontWeight: '600',
  },

  badge: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginRight: spacing.xs,
  },

  badgeText: {
    ...typography.styles.caption,
    color: colors.background.paper,
    fontWeight: '600',
  },

  itemCount: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },

  budget: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  budgetLabel: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },

  budgetAmount: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
    fontWeight: '600',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  date: {
    ...typography.styles.caption,
    color: colors.text.hint,
  },
});

