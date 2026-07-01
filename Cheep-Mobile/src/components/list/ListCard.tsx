/**
 * 📋 List Card
 * Shopping list card component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { useLocale } from '../../context/LocaleContext';
import {colors, typography, spacing, borderRadius} from '../../theme';
import type { ShoppingList } from '../../types';

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
  const isCompleted = list.status === 'completed';

  const handleDelete = (e: any) => {
    e.stopPropagation();
    if (onDelete) {
      Alert.alert(
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
          {list.is_template && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t('list.template_badge')}</Text>
            </View>
          )}
          {isCompleted && (
            <View style={[styles.badge, styles.completedBadge]}>
              <Text style={styles.badgeText}>{t('list.completed_badge')}</Text>
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
          <Text style={styles.budgetLabel}>{t('list.budget_label')}</Text>
          <Text style={styles.budgetAmount}>{formatMoney(budget)}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.date}>
          {formatDate(list.updated_at)}
        </Text>
        {isCompleted && list.last_compared_at && (
          <Text style={styles.compareDate}>
            {t('list.last_compared', { date: formatDate(list.last_compared_at) })}
          </Text>
        )}
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

  completedBadge: {
    backgroundColor: colors.success.main,
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

  compareDate: {
    ...typography.styles.caption,
    color: colors.success.main,
  },
});

