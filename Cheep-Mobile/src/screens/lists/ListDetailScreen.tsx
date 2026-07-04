/**
 * 📋 List Detail Screen
 * Shopping list items and actions.
 *
 * Layout (approved):
 *   header card: name + (if active) "✓ Aktif" chip + ⋮ overflow (40×40)
 *   (if NOT active) thin strip: "Bu liste aktif değil"  [Aktif Yap]
 *   items FlatList (flex:1, scrolls — ALL items reachable)
 *   bottom sticky bar: [ Ürün Ekle (outline) ] [ Rotaları Göster (primary) ]
 *   ⋮ menu (bottom-sheet): Aktif liste yap · Klonla · Başka listeden aktar · Sil
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { listService } from '../../services';
import { ProductThumb } from '../../components/product/ProductThumb';
import { ListActionsSheet } from '../../components/list/ListActionsSheet';
import { SelectSourceListModal } from '../../components/list/SelectSourceListModal';
import { ImportModeModal } from '../../components/list/ImportModeModal';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLocale } from '../../context/LocaleContext';
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
  const { t } = useTranslation();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showImportMode, setShowImportMode] = useState(false);
  const [pendingSourceId, setPendingSourceId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const cart = useCart();
  const toast = useToast();
  const { formatMoney } = useLocale();

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
      Alert.alert(t('common.error'), t('list.select_modal.load_error'));
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
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    }
  };

  const handleCompare = () => {
    if (!list) return;
    navigation.navigate('CompareResults', { listId: list.id });
  };

  // Hedefi BU liste olan arama akışı (Lists stack içinde kalır; aktif olmasa da ekler).
  const handleAddProducts = () => {
    if (!list) return;
    navigation.navigate('Search', { targetListId: list.id, targetListName: list.name });
  };

  const handleSetActive = async () => {
    if (!list) return;
    try {
      await listService.activate(list.id);
      await loadList();
      cart.refresh();
    } catch {
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    }
  };

  const handleClone = async () => {
    if (!list) return;
    try {
      await listService.clone(list.id);
      toast.show(t('list.clone_done'));
    } catch {
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    }
  };

  // Import akışı: ⋮ "Başka listeden aktar" → kaynak seç → mod seç → içe aktar.
  const handleSelectSource = (sourceId: number) => {
    setPendingSourceId(sourceId);
    setShowSource(false);
    setShowImportMode(true);
  };

  const handleImport = async (mode: 'merge' | 'replace') => {
    setShowImportMode(false);
    if (!list || pendingSourceId == null) return;
    try {
      await listService.importFromList(list.id, pendingSourceId, mode);
      toast.show(t('list.import_done'));
      await loadList();
      cart.refresh();
    } catch {
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    } finally {
      setPendingSourceId(null);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!list) return;

    Alert.alert(
      'Ürünü Sil',
      'Bu ürünü listeden kaldırmak istediğinize emin misiniz?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('list.delete_action'),
          style: 'destructive',
          onPress: async () => {
            try {
              await listService.deleteItem(list.id, itemId);
              await loadList();
            } catch {
              Alert.alert(t('common.error'), t('list.select_modal.add_error'));
            }
          },
        },
      ]
    );
  };

  const handleDeleteList = () => {
    if (!list) return;

    Alert.alert(
      t('list.delete_title'),
      t('list.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('list.delete_action'),
          style: 'destructive',
          onPress: async () => {
            try {
              await listService.deleteList(list.id);
              navigation.goBack();
            } catch {
              Alert.alert(t('common.error'), t('list.select_modal.add_error'));
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
  const isActive = list.status === 'active';

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.nameWrap}>
            <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
            {isActive && (
              <View style={styles.activeChip}>
                <MaterialIcons name="check" size={13} color={colors.primary.main} />
                <Text style={styles.activeChipText}>{t('list.active_badge')}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowActionsSheet(true)}
            style={styles.overflowButton}
            accessibilityRole="button"
            accessibilityLabel={t('list.menu_title')}
          >
            <MaterialIcons name="more-vert" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.itemCount}>{t('list.item_count', { count: items.length })}</Text>
          {list.budget && (
            <Text style={styles.budget}>
              {t('list.budget_label')} {formatMoney(parseFloat(list.budget))}
            </Text>
          )}
        </View>
      </View>

      {/* Not-active info strip */}
      {!isActive && (
        <View style={styles.activeStrip}>
          <Text style={styles.activeStripText} numberOfLines={1}>
            {t('list.not_active_hint')}
          </Text>
          <Button
            title={t('list.set_active')}
            onPress={handleSetActive}
            variant="outline"
            size="small"
            style={styles.activeStripBtn}
          />
        </View>
      )}

      {/* Items List */}
      <FlatList
        style={styles.list}
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
          // Alt sabit çubuğu (72 tab + ~48 buton + padding) aşan boşluk;
          // yoksa son kalemler çubuğun altında kalır.
          items.length > 0 && { paddingBottom: insets.bottom + 140 },
        ]}
        ListEmptyComponent={
          <EmptyState
            mascot="search"
            title={t('list.detail_empty_title')}
            description={t('list.detail_empty_desc')}
            actionLabel={t('list.add_products')}
            onAction={handleAddProducts}
          />
        }
      />

      {/* Bottom sticky bar: two equal buttons */}
      {items.length > 0 && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.actionRow}>
            <Button
              title={t('list.add_products')}
              onPress={handleAddProducts}
              variant="outline"
              style={styles.actionBtn}
            />
            <Button
              title="Rotaları Göster"
              onPress={handleCompare}
              style={styles.actionBtn}
            />
          </View>
        </View>
      )}

      <ListActionsSheet
        visible={showActionsSheet}
        isActive={isActive}
        onClose={() => setShowActionsSheet(false)}
        onSetActive={handleSetActive}
        onClone={handleClone}
        onImport={() => setShowSource(true)}
        onDelete={handleDeleteList}
      />

      <SelectSourceListModal
        visible={showSource}
        currentListId={list.id}
        onClose={() => setShowSource(false)}
        onSelect={handleSelectSource}
      />

      <ImportModeModal
        visible={showImportMode}
        onClose={() => { setShowImportMode(false); setPendingSourceId(null); }}
        onChoose={handleImport}
      />
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
            <ProductThumb imageUrl={product.image_url} categoryName={product.category?.name} iconSize={22} />
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

  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  listName: {
    ...typography.styles.h3,
    color: colors.text.primary,
    flexShrink: 1,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },

  activeChipText: {
    ...typography.styles.caption,
    color: colors.primary.main,
    fontWeight: '700',
  },

  overflowButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
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

  activeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.paper,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  activeStripText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    flexShrink: 1,
    marginRight: spacing.sm,
  },

  activeStripBtn: {
    paddingHorizontal: spacing.md,
  },

  // FlatList'in kendi görünüm alanı (viewport) ekranın kalan yüksekliğine SABİTLENMELİ;
  // yoksa liste içerik yüksekliğine büyür, parent onu kırpar ve kaydırma çalışmaz
  // (kullanıcı 3-4. üründen sonrasını göremez). flex:1 bunu düzeltir.
  list: {
    flex: 1,
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

  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  actionBtn: {
    flex: 1,
  },
});
