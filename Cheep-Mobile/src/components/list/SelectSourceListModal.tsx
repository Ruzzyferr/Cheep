/**
 * 📥 Select Source List Modal
 * Pick which OTHER list to import products from.
 * Reuses the SelectListModal visual language (slide-up sheet, safe-area, cards).
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { listService } from '../../services';
import { Card } from '../ui';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import type { ShoppingList } from '../../types';
import { appAlert } from '../../utils/dialog';

interface SelectSourceListModalProps {
  visible: boolean;
  currentListId: number;
  onClose: () => void;
  onSelect: (sourceId: number) => void;
}

export function SelectSourceListModal({
  visible,
  currentListId,
  onClose,
  onSelect,
}: SelectSourceListModalProps) {
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  const insets = useSafeAreaInsets();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await listService.getLists();
        if (!alive) return;
        setLists(data.filter((l) => l.id !== currentListId));
      } catch (error) {
        if (!alive) return;
        console.error('Load lists error:', error);
        appAlert(t('common.error'), t('list.select_modal.load_error'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible, currentListId, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.modal, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('list.import_source_title')}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
          ) : (
            <FlatList
              data={lists}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <Card
                  padding="md"
                  style={styles.listCard}
                  onPress={() => onSelect(item.id)}
                >
                  <View style={styles.listCardContent}>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName}>{item.name}</Text>
                      {item.list_items && (
                        <Text style={styles.listItemCount}>
                          {t('list.item_count', { count: item.list_items.length })}
                        </Text>
                      )}
                      {item.budget && Number.isFinite(parseFloat(item.budget)) && (
                        <Text style={styles.listBudget}>
                          {t('list.budget_display')} {formatMoney(parseFloat(item.budget))}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Card>
              )}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>{t('list.import_no_source')}</Text>
                </View>
              }
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modal: {
    backgroundColor: colors.background.paper,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  title: {
    ...typography.styles.h3,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },

  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeText: {
    fontSize: 24,
    color: colors.text.secondary,
  },

  loading: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },

  listContent: {
    padding: layout.screenPadding,
  },

  listCard: {
    marginBottom: spacing.sm,
  },

  listCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  listInfo: {
    flex: 1,
  },

  listName: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  listItemCount: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  listBudget: {
    ...typography.styles.caption,
    color: colors.primary.main,
  },

  chevron: {
    fontSize: 28,
    color: colors.text.hint,
    marginLeft: spacing.sm,
  },

  empty: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },

  emptyText: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});
