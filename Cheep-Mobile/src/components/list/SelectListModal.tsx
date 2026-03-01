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
} from 'react-native';
import { listService } from '../../services';
import { Card, Button } from '../ui';
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
  unit = 'adet',
}: SelectListModalProps) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadLists();
    }
  }, [visible]);

  const loadLists = async () => {
    try {
      setLoading(true);
      const data = await listService.getLists('active');
      setLists(data);
    } catch (error) {
      console.error('Load lists error:', error);
      Alert.alert('Hata', 'Listeler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectList = async (listId: number) => {
    try {
      setAdding(listId);
      await listService.addItem(listId, {
        product_id: productId,
        quantity,
        unit,
      });
      Alert.alert('Başarılı', 'Ürün listeye eklendi', [
        {
          text: 'Tamam',
          onPress: () => {
            onSelect(listId);
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Add item error:', error);
      Alert.alert('Hata', 'Ürün eklenirken bir hata oluştu');
    } finally {
      setAdding(null);
    }
  };

  const handleCreateNew = () => {
    onClose();
    // TODO: Navigate to create list screen
    Alert.alert('Bilgi', 'Yeni liste oluşturma özelliği yakında eklenecek');
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
            <Text style={styles.title}>Liste Seç</Text>
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
                            {item.list_items.length} ürün
                          </Text>
                        )}
                        {item.budget && (
                          <Text style={styles.listBudget}>
                            Bütçe: ₺{parseFloat(item.budget).toFixed(2)}
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
                    <Text style={styles.emptyText}>Aktif liste bulunamadı</Text>
                  </View>
                }
              />

              <View style={styles.footer}>
                <Button
                  title="Yeni Liste Oluştur"
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
});

