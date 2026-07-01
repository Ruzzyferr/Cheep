/**
 * 📋 Select List Modal
 * Modal to select a list to add product to
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
  Alert,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { listService } from '../../services';
import { Card, Button } from '../ui';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import type { ShoppingList } from '../../types';

interface SelectListModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (listId: number) => void;
  productId: number;
  quantity?: number;
  unit?: string;
}

export function SelectListModal({
  visible,
  onClose,
  onSelect,
  productId,
  quantity = 1,
  unit,
}: SelectListModalProps) {
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  const effectiveUnit = unit ?? t('common.unit_default');
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<number | null>(null);
  const [brandIndependent, setBrandIndependent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await listService.getLists('active');
        if (!alive) return;
        setLists(data);
      } catch (error) {
        if (!alive) return;
        console.error('Load lists error:', error);
        Alert.alert(t('common.error'), t('list.select_modal.load_error'));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [visible]);

  const handleSelectList = async (listId: number) => {
    try {
      setAdding(listId);
      await listService.addItem(listId, {
        product_id: productId,
        quantity,
        unit: effectiveUnit,
        brand_independent: brandIndependent,
      });
      Alert.alert(t('list.select_modal.add_success_title'), t('list.select_modal.add_success_body'), [
        {
          text: t('common.ok'),
          onPress: () => {
            onSelect(listId);
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    } finally {
      setAdding(null);
    }
  };

  const handleCreateNew = async () => {
    try {
      setAdding(-1);
      const newList = await listService.createList({ name: t('list.select_modal.default_new_list_name') });
      await listService.addItem(newList.id, { product_id: productId, quantity, unit: effectiveUnit, brand_independent: brandIndependent });
      onSelect(newList.id);
      onClose();
    } catch (error) {
      console.error('Create+add error:', error);
      Alert.alert(t('common.error'), t('list.select_modal.create_error'));
    } finally {
      setAdding(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('list.select_modal.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary.main} />
            </View>
          ) : (
            <>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{t('list.select_modal.brand_independent')}</Text>
                <Switch value={brandIndependent} onValueChange={setBrandIndependent} />
              </View>

              <FlatList
                data={lists}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <Card
                    padding="md"
                    style={styles.listCard}
                    onPress={() => handleSelectList(item.id)}
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
                            {t('list.budget_label')} {formatMoney(parseFloat(item.budget))}
                          </Text>
                        )}
                      </View>
                      {adding === item.id ? (
                        <ActivityIndicator size="small" color={colors.primary.main} />
                      ) : (
                        <Text style={styles.addIcon}>+</Text>
                      )}
                    </View>
                  </Card>
                )}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>{t('list.select_modal.no_active_lists')}</Text>
                  </View>
                }
              />

              <View style={styles.footer}>
                <Button
                  title={t('list.select_modal.create_new')}
                  onPress={handleCreateNew}
                  variant="outline"
                  fullWidth
                />
              </View>
            </>
          )}
        </View>
      </View>
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
    paddingBottom: layout.screenPadding,
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

  addIcon: {
    fontSize: 24,
    color: colors.primary.main,
    fontWeight: '300',
  },

  empty: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },

  emptyText: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },

  footer: {
    padding: layout.screenPadding,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  toggleLabel: {
    ...typography.styles.body1,
    color: colors.text.primary,
  },
});

