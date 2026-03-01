/**
 * 📋 List Card
 * Shopping list card component
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '../ui';
import {colors, typography, spacing, borderRadius} from '../../theme';
import type { ShoppingList } from '../../types';

interface ListCardProps {
  list: ShoppingList;
  onPress: () => void;
  onDelete?: (listId: number) => void;
}

export function ListCard({ list, onPress, onDelete }: ListCardProps) {
  const itemCount = list.list_items?.length || 0;
  const budget = list.budget ? parseFloat(list.budget) : null;
  const isCompleted = list.status === 'completed';

  const handleDelete = (e: any) => {
    e.stopPropagation();
    if (onDelete) {
      Alert.alert(
        'Listeyi Sil',
        'Bu listeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
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
              <Text style={styles.badgeText}>Şablon</Text>
            </View>
          )}
          {isCompleted && (
            <View style={[styles.badge, styles.completedBadge]}>
              <Text style={styles.badgeText}>Tamamlandı</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.itemCount}>{itemCount} ürün</Text>
          {onDelete && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
              <MaterialIcons name="delete-outline" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {budget && (
        <View style={styles.budget}>
          <Text style={styles.budgetLabel}>Bütçe:</Text>
          <Text style={styles.budgetAmount}>₺{budget.toFixed(2)}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.date}>
          {new Date(list.updated_at).toLocaleDateString('tr-TR')}
        </Text>
        {isCompleted && list.last_compared_at && (
          <Text style={styles.compareDate}>
            Son karşılaştırma: {new Date(list.last_compared_at).toLocaleDateString('tr-TR')}
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

