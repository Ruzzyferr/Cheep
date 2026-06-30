/**
 * 📋 List Detail Screen
 * Shopping list items and actions
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listService } from '../../services';
import { useCart } from '../../context/CartContext';
import { Button, Card, ListSkeleton } from '../../components/ui';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { ShoppingList, ListItem } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';

export function ListDetailScreen({
  route,
  navigation,
}: ListsStackScreenProps<'ListDetail'>) {
  const { listId } = route.params;
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const cart = useCart();

  // Reload list when screen comes into focus (e.g., after adding a product)
  useFocusEffect(
    useCallback(() => {
      loadList();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listId])
  );

  const loadList = async () => {
    try {
      setLoading(true);
      const data = await listService.getListById(listId);
      setList(data);
      cart.refresh(); // sepet rozetini güncel tut (ekleme/silme sonrası)
    } catch (error) {
      console.error('Load list error:', error);
      Alert.alert('Hata', 'Liste yüklenirken bir hata oluştu');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBrandIndependent = async (item: ListItem) => {
    try {
      await listService.updateItem(item.id, { brand_independent: !item.brand_independent });
      await loadList();
    } catch {
      Alert.alert('Hata', 'Marka tercihi güncellenirken bir hata oluştu');
    }
  };

  const handleCompare = () => {
    if (!list) return;
    navigation.navigate('CompareResults', { listId: list.id });
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!list) return;
    
    Alert.alert(
      'Ürünü Sil',
      'Bu ürünü listeden kaldırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await listService.deleteItem(list.id, itemId);
              await loadList();
            } catch {
              Alert.alert('Hata', 'Ürün silinirken bir hata oluştu');
            }
          },
        },
      ]
    );
  };

  const handleDeleteList = () => {
    if (!list) return;

    Alert.alert(
      'Listeyi Sil',
      'Bu listeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await listService.deleteList(list.id);
              navigation.goBack();
            } catch {
              Alert.alert('Hata', 'Liste silinirken bir hata oluştu');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ListSkeleton count={5} />
      </View>
    );
  }

  if (!list) {
    return null;
  }

  const items = list.list_items || [];

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.listName}>{list.name}</Text>
          <TouchableOpacity onPress={handleDeleteList} style={styles.deleteButton}>
            <MaterialIcons name="delete-outline" size={22} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.itemCount}>{items.length} ürün</Text>
          {list.budget && (
            <Text style={styles.budget}>
              Bütçe: ₺{parseFloat(list.budget).toFixed(2)}
            </Text>
          )}
        </View>
      </View>

      {/* Items List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ListItemCard
            item={item}
            onDelete={handleDeleteItem}
            onToggleBrandIndependent={handleToggleBrandIndependent}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          items.length > 0 && { paddingBottom: 120 } // Space for button at bottom (72 tab bar + 48 button + padding)
        ]}
        ListEmptyComponent={
          <EmptyState
            mascot="search"
            title="Liste boş"
            description="Bu listeye henüz ürün eklenmemiş"
            actionLabel="Ürün Ekle"
            onAction={() => {
              // Navigate to Home tab to browse all products
              const parent = navigation.getParent();
              if (parent) {
                parent.navigate('Home', {
                  screen: 'HomeMain',
                });
              }
            }}
          />
        }
      />

      {/* Actions */}
      {items.length > 0 && (
        <View style={[styles.actions, { bottom: insets.bottom + 72 }]}>
          <Button
            title="Rotaları Göster"
            onPress={handleCompare}
            fullWidth
            icon={<MaterialIcons name="alt-route" size={18} color={colors.background.paper} style={styles.buttonIcon} />}
          />
        </View>
      )}
    </View>
  );
}

// List Item Card Component
function ListItemCard({
  item,
  onDelete,
  onToggleBrandIndependent,
}: {
  item: ListItem;
  onDelete: (id: number) => void;
  onToggleBrandIndependent: (item: ListItem) => void;
}) {
  const product = item.product;
  if (!product) return null;

  return (
    <TouchableOpacity
      onLongPress={() => onToggleBrandIndependent(item)}
      activeOpacity={0.8}
      accessibilityLabel="Marka tercihini değiştirmek için uzun basın"
    >
      <Card padding="md" style={styles.itemCard}>
        <View style={styles.itemContent}>
          <View style={styles.itemThumb}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={styles.itemThumbImg} />
            ) : (
              <MaterialIcons name="inventory-2" size={20} color={colors.text.hint} />
            )}
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            {product.brand && !item.brand_independent && (
              <Text style={styles.productBrand}>{product.brand}</Text>
            )}
            {item.brand_independent && (
              <Text style={styles.brandFreeBadge}>🏷️ marka farketmez</Text>
            )}
            <Text style={styles.quantity}>
              {item.quantity} {item.unit}
            </Text>
          </View>
          <Button
            title="Sil"
            onPress={() => onDelete(item.id)}
            variant="text"
            size="small"
          />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    backgroundColor: colors.background.paper,
    padding: layout.screenPadding,
    paddingTop: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    borderWidth: 1,
    borderColor: colors.border.main,
    borderRadius: borderRadius.lg,
    margin: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.md,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  listName: {
    ...typography.styles.h3,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  deleteButton: {
    padding: spacing.xs,
    marginLeft: spacing.md,
  },

  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  itemCount: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },

  budget: {
    ...typography.styles.body2,
    color: colors.text.primary,
    fontWeight: '600',
  },

  listContent: {
    padding: layout.screenPadding,
    flexGrow: 1,
  },

  itemCard: {
    marginBottom: spacing.xs,
  },

  itemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.md,
  },

  itemThumbImg: { width: '100%', height: '100%', resizeMode: 'contain' },

  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },

  productName: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },

  productBrand: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  quantity: {
    ...typography.styles.body2,
    color: colors.text.hint,
  },

  brandFreeBadge: {
    ...typography.styles.caption,
    color: colors.primary.main,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: layout.screenPadding,
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    ...shadows.md,
  },

  buttonIcon: {
    marginRight: spacing.xs,
  },
});

