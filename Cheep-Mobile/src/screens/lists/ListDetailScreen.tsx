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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { listService } from '../../services';
import { ProductThumb } from '../../components/product/ProductThumb';
import { ListActionsSheet } from '../../components/list/ListActionsSheet';
import { SelectSourceListModal } from '../../components/list/SelectSourceListModal';
import { ImportModeModal } from '../../components/list/ImportModeModal';
import { NameInputModal } from '../../components/list/NameInputModal';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLocale } from '../../context/LocaleContext';
import { Button, ListSkeleton } from '../../components/ui';
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
  const [nameModal, setNameModal] = useState<null | 'clone' | 'rename'>(null);
  const insets = useSafeAreaInsets();
  // Alt tab-bar position:absolute (float) → ekran onun altına uzanır. Alt aksiyon
  // çubuğunu ve liste boşluğunu tab-bar YÜKSEKLİĞİNCE yukarı almazsak butonlar
  // tab-bar'ın arkasında kalır. Bu hook safe-area dahil gerçek yüksekliği verir.
  const tabBarHeight = useBottomTabBarHeight();
  const cart = useCart();
  const toast = useToast();
  const { formatMoney } = useLocale();

  // iOS: bir Modal kapanırken diğerini AYNI tick'te açmak iOS tarafından yutulabilir.
  // Kapanma animasyonu bittikten sonra aç (Android'de bir sonraki frame yeterli).
  const openAfterDismiss = (fn: () => void) => {
    setTimeout(fn, Platform.OS === 'ios' ? 350 : 0);
  };

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
      Alert.alert(t('common.error'), t('common.something_went_wrong'));
    }
  };

  const handleCompare = () => {
    if (!list) return;
    navigation.navigate('CompareResults', { listId: list.id });
  };

  // "Ürün Ekle" → doğrudan KATEGORİLER sayfası (arama değil), hedefi BU liste.
  // Lists stack içinde kalır; liste aktif olmasa da o listeye ekler.
  const handleAddProducts = () => {
    if (!list) return;
    navigation.navigate('CategoryProducts', {
      categoryId: 0,
      categoryName: t('product.all_categories'),
      targetListId: list.id,
      targetListName: list.name,
    });
  };

  const handleSetActive = async () => {
    if (!list) return;
    try {
      await listService.activate(list.id);
      await loadList();
    } catch {
      Alert.alert(t('common.error'), t('common.something_went_wrong'));
    }
  };

  // Klonla ve Yeniden Adlandır aynı isim-modalını paylaşır (mode ile ayrılır).
  const submitName = async (name: string) => {
    if (!list) return;
    const mode = nameModal;
    setNameModal(null);
    try {
      if (mode === 'clone') {
        const clone = await listService.clone(list.id);
        // clone endpoint "(Kopya)" verir; kullanıcının seçtiği adı uygula.
        if (name && name !== clone.name) {
          await listService.updateList(clone.id, { name });
        }
        toast.show(t('list.clone_done'));
      } else if (mode === 'rename') {
        await listService.updateList(list.id, { name });
        await loadList();
        cart.refresh();
      }
    } catch {
      Alert.alert(t('common.error'), t('common.something_went_wrong'));
    }
  };

  // Import akışı: ⋮ "Başka listeden aktar" → kaynak seç → mod seç → içe aktar.
  // Kaynak modalını kapatıp mod modalını AYNI tick'te açma (iOS yutabilir); sıraya al.
  const handleSelectSource = (sourceId: number) => {
    setPendingSourceId(sourceId);
    setShowSource(false);
    openAfterDismiss(() => setShowImportMode(true));
  };

  const runImport = async (mode: 'merge' | 'replace') => {
    if (!list || pendingSourceId == null) return;
    try {
      await listService.importFromList(list.id, pendingSourceId, mode);
      toast.show(t('list.import_done'));
      await loadList();
    } catch {
      Alert.alert(t('common.error'), t('common.something_went_wrong'));
    } finally {
      setPendingSourceId(null);
    }
  };

  const handleImport = (mode: 'merge' | 'replace') => {
    setShowImportMode(false);
    if (!list || pendingSourceId == null) return;
    // "Değiştir" tüm listeyi silip yeniden yazar; yıkıcı olduğu için önce onayla.
    if (mode === 'replace') {
      Alert.alert(
        t('list.import_mode.replace_confirm_title'),
        t('list.import_mode.replace_confirm_body'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setPendingSourceId(null) },
          {
            text: t('list.import_mode.replace_confirm_action'),
            style: 'destructive',
            onPress: () => { void runImport('replace'); },
          },
        ]
      );
      return;
    }
    void runImport(mode);
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!list) return;

    Alert.alert(
      t('list.delete_item_title'),
      t('list.delete_item_confirm'),
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
              Alert.alert(t('common.error'), t('common.something_went_wrong'));
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
              Alert.alert(t('common.error'), t('common.something_went_wrong'));
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.listContent,
          // Son kalemler hem alt aksiyon çubuğunun hem tab-bar'ın altında kalmasın:
          // tab-bar yüksekliği + aksiyon çubuğu yüksekliği (~76) kadar boşluk bırak.
          items.length > 0 && { paddingBottom: tabBarHeight + 92 },
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

      {/* Bottom sticky bar: two equal buttons — tab-bar'ın ÜSTÜNE yerleşir (arkasında kalmaz) */}
      {items.length > 0 && (
        <View style={[styles.actions, { bottom: tabBarHeight }]}>
          <View style={styles.actionRow}>
            <Button
              title={t('list.add_products')}
              onPress={handleAddProducts}
              variant="outline"
              style={styles.actionBtn}
            />
            <Button
              title={t('list.show_routes')}
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
        onRename={() => openAfterDismiss(() => setNameModal('rename'))}
        onClone={() => openAfterDismiss(() => setNameModal('clone'))}
        onImport={() => openAfterDismiss(() => setShowSource(true))}
        onDelete={handleDeleteList}
      />

      <NameInputModal
        visible={nameModal !== null}
        title={nameModal === 'clone' ? t('list.clone_title') : t('list.rename_title')}
        label={t('list.name_label')}
        confirmLabel={nameModal === 'clone' ? t('list.clone') : t('list.rename_save')}
        initialValue={nameModal === 'clone' ? `${list.name} (Kopya)` : list.name}
        onClose={() => setNameModal(null)}
        onSubmit={submitName}
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

  // Alt satır: marka bağımsızsa marka gösterilmez, sadece adet; aksi halde "Marka · adet".
  const subtitle =
    product.brand && !item.brand_independent
      ? `${product.brand} · ${item.quantity} ${item.unit}`
      : `${item.quantity} ${item.unit}`;

  return (
    <TouchableOpacity
      onLongPress={() => onToggleBrandIndependent(item)}
      activeOpacity={0.7}
      accessibilityLabel="Marka tercihini değiştirmek için uzun basın"
      style={styles.itemRow}
    >
      <View style={styles.itemThumb}>
        <ProductThumb imageUrl={product.image_url} categoryName={product.category?.name} iconSize={18} />
      </View>
      <View style={styles.itemInfo}>
        <View style={styles.itemNameRow}>
          <Text style={styles.productName} numberOfLines={1}>
            {product.name}
          </Text>
          {item.brand_independent && <Text style={styles.brandFreeBadge}> 🏷️</Text>}
        </View>
        <Text style={styles.itemSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Sil"
        style={styles.deleteBtn}
      >
        <MaterialIcons name="delete-outline" size={22} color={colors.error.main} />
      </TouchableOpacity>
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
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },

  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  listName: {
    ...typography.styles.h4,
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
    ...typography.styles.body2,
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

  // Ultra-kompakt ürün satırı: kart yok, satırlar arası ince ayraç (separator).
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  separator: {
    height: 1,
    backgroundColor: colors.border.light,
  },

  itemThumb: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.md,
  },

  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },

  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  productName: {
    ...typography.styles.body2,
    color: colors.text.primary,
    fontWeight: '600',
    flexShrink: 1,
  },

  itemSub: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },

  brandFreeBadge: {
    ...typography.styles.caption,
    color: colors.primary.main,
    fontWeight: '600',
  },

  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
