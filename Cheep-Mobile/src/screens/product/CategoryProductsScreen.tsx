/**
 * 📂 Category Products Screen
 * Kategori bazlı ürün listesi - En ucuz 3 market gösterir
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { productService, categoryService, listService } from '../../services';
import { ProductGridCard } from '../../components/product/ProductGridCard';
import { CategoryChip } from '../../components/common/CategoryChip';
import { GridSkeleton } from '../../components/ui';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import type { Product } from '../../types';
import type { Category } from '../../services/category.service';
import type { HomeStackScreenProps, ListsStackScreenProps } from '../../navigation/types';

// Aynı bileşen hem Home hem Lists stack'inde kayıtlı (liste detayından "Ürün Ekle"
// akışı kullanıcıyı Listeler sekmesinde tutar). İki stack'in param'ı özdeş.
type CategoryProductsProps =
  | HomeStackScreenProps<'CategoryProducts'>
  | ListsStackScreenProps<'CategoryProducts'>;

export function CategoryProductsScreen({
  navigation,
  route,
}: CategoryProductsProps) {
  const { categoryId, categoryName } = route.params;
  // Hedef liste verildiyse (liste detayından "Ürün Ekle") ekleme O listeye gider;
  // yoksa aktif listeye. Böylece aktif olmayan bir listeye de ürün eklenebilir.
  const targetListId = route.params.targetListId;
  const targetListName = route.params.targetListName;
  const cart = useCart();
  const toast = useToast();
  const { t } = useTranslation();
  const { formatMoney } = useLocale();

  const [selectedCategory, setSelectedCategory] = useState<number>(categoryId);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Sayfalama: her istekte PAGE_SIZE kadar çek; sona yaklaşınca bir sonraki sayfayı
  // ekle (sonsuz kaydırma). Önceden sabit 300/100 limit vardı → liste o noktada
  // "bitiyor" gibi görünüyordu.
  const PAGE_SIZE = 24;

  // FlatList scroll kontrolü için ref
  const flatListRef = React.useRef<FlatList>(null);

  // Eşzamanlı loadProducts isteklerinde sadece en son yanıtı uygulamak için
  // artan bir istek kimliği tutarız (eski yanıt yenisini ezemez).
  const loadProductsReqId = React.useRef(0);

  // Scroll'u en üste götür
  const scrollToTop = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  };

  useEffect(() => {
    loadCategories();
    cart.refresh(); // pill'deki aktif liste + sayı güncel olsun
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kategori değiştiğinde alt kategorileri yükle (loadSubcategories
  // selectedSubcategory'yi null'a çeker → aşağıdaki effect ürünleri yükler).
  useEffect(() => {
    loadSubcategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Kategori veya alt kategori değiştiğinde (null dahil) ürünleri yükle.
  // İki ayrı fetch effect'ini tek bir yere indirgedik; istek kimliği guard'ı
  // overlapping isteklerde sadece en güncel yanıtın uygulanmasını sağlar.
  useEffect(() => {
    loadProducts();
    scrollToTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedSubcategory]);

  const loadCategories = async () => {
    try {
      const parentCategories = await categoryService.getParentCategories();
      setCategories(parentCategories);
    } catch (error) {
      console.error('❌ Load categories error:', error);
    }
  };

  const loadSubcategories = async () => {
    // "Tüm Kategoriler" (id=0) bir gerçek kategori değil → alt kategorisi yok.
    // getSubcategories(0) backend'de 400 "Geçersiz 'id' parametresi" döner; hiç
    // isteme, doğrudan boşalt (aksi halde dev'de LogBox hatası + gereksiz istek).
    if (selectedCategory === 0) {
      setSubcategories([]);
      setSelectedSubcategory(null);
      return;
    }
    try {
      const subs = await categoryService.getSubcategories(selectedCategory);
      setSubcategories(subs);
      setSelectedSubcategory(null); // Reset subcategory selection
    } catch (error) {
      console.error('❌ Load subcategories error:', error);
      setSubcategories([]);
    }
  };

  const buildParams = (offset: number) => {
    const categoryIdToUse = selectedSubcategory || selectedCategory;
    const params: { limit: number; offset: number; category_id?: number } = {
      limit: PAGE_SIZE,
      offset,
    };
    // "Tüm Kategoriler" (id=0) DEĞİLSE, category_id ekle
    if (categoryIdToUse !== 0) {
      params.category_id = categoryIdToUse;
    }
    return params;
  };

  // İlk sayfa (kategori değişiminde sıfırdan yükle)
  const loadProducts = async () => {
    const reqId = ++loadProductsReqId.current;
    try {
      setLoading(true);
      const { items, hasMore: more } = await productService.getProductsPage(buildParams(0));
      // Sadece en son istek kazanır: eski yanıt geç gelirse yok say.
      if (reqId !== loadProductsReqId.current) return;
      setProducts(items);
      setHasMore(more);
    } catch (error) {
      if (reqId !== loadProductsReqId.current) return;
      console.error('❌ Load products error:', error);
    } finally {
      if (reqId === loadProductsReqId.current) setLoading(false);
    }
  };

  // Sonraki sayfa (sona yaklaşınca eklenir)
  const loadMore = async () => {
    if (loadingMore || loading || !hasMore) return;
    const reqId = loadProductsReqId.current; // mevcut kategori için geçerli olmalı
    setLoadingMore(true);
    try {
      const { items, hasMore: more } = await productService.getProductsPage(
        buildParams(products.length)
      );
      // Kategori arada değiştiyse bu sayfayı uygulama.
      if (reqId !== loadProductsReqId.current) return;
      setProducts((prev) => {
        // Aynı ürünleri iki kez eklememek için id'ye göre tekille.
        const seen = new Set(prev.map((p) => p.id));
        const fresh = items.filter((p) => !seen.has(p.id));
        return [...prev, ...fresh];
      });
      setHasMore(more);
    } catch (error) {
      console.error('❌ Load more error:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCategories(), loadSubcategories(), loadProducts()]);
    setRefreshing(false);
  };

  const getTopThreePrices = (product: Product) => {
    if (!product.store_prices || product.store_prices.length === 0) {
      return [];
    }

    // Sort by price ascending
    const sortedPrices = [...product.store_prices]
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      .slice(0, 3);

    return sortedPrices.map((sp) => ({
      storeName: sp.store?.name || t('product.unknown_store'),
      price: formatMoney(parseFloat(sp.price)),
    }));
  };

  const getCurrentCategoryName = () => {
    if (selectedCategory === 0) {
      return t('product.all_categories');
    }
    const category = categories.find((c) => c.id === selectedCategory);
    return category?.name || categoryName;
  };

  // Hızlı ekle: aktif listeye DOĞRUDAN ekle (her seferinde liste sormaz). Aktif
  // liste yoksa varsayılan bir tane oluşturup ona ekler. Hafif toast ile bildirir.
  // Farklı bir listeye eklemek isteyen kullanıcı ürün detayından seçebilir.
  const handleAddToCart = async (product: Product) => {
    const unit = product.store_prices?.[0]?.unit || t('common.unit_default');
    try {
      // Hedef liste öncelikli (liste detayından geldiyse); yoksa aktif liste.
      let listId = targetListId ?? cart.activeList?.id;
      let listName = targetListName ?? cart.activeList?.name;
      if (!listId) {
        const newList = await listService.createList({ name: t('list.select_modal.default_new_list_name') });
        listId = newList.id;
        listName = newList.name;
      }
      await listService.addItem(listId, { product_id: product.id, quantity: 1, unit });
      await cart.refresh();
      toast.show(t('list.added_to', { list: listName }));
    } catch (error) {
      console.error('Quick add error:', error);
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    }
  };

  const goToActiveList = () => {
    if (cart.activeList) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Lists',
          params: { screen: 'ListDetail', params: { listId: cart.activeList.id } },
        })
      );
    } else {
      navigation.dispatch(CommonActions.navigate({ name: 'Lists' }));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backButton, { marginRight: spacing.sm }]}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{getCurrentCategoryName()}</Text>

          {/* Arama: kategori gezmek yerine doğrudan ürün ara. Hedef liste varsa
              onu da taşı (arama sonuçları da o listeye eklensin). */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => (navigation as any).navigate('Search', targetListId ? { targetListId, targetListName } : undefined)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="search" size={22} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Sepet: hedef liste modunda gizli (o listeye ekliyoruz); aktif liste
              modunda kaç ürün eklendiğini gösterir, dokununca listeyi açar. */}
          {!targetListId && (
            <TouchableOpacity style={styles.cartPill} onPress={goToActiveList} activeOpacity={0.7}>
              <MaterialIcons name="shopping-cart" size={18} color={colors.primary.main} />
              {cart.count > 0 && (
                <View style={styles.cartPillBadge}>
                  <Text style={styles.cartPillBadgeText}>{cart.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
        {/* Hangi listeye eklendiği: hedef liste öncelikli, yoksa aktif liste. */}
        {(targetListName || cart.activeList) && (
          <Text style={styles.cartPillCaption} numberOfLines={1}>
            {t('product.target_list')}{' '}
            <Text style={styles.cartPillCaptionStrong}>{targetListName ?? cart.activeList?.name}</Text>
          </Text>
        )}

        {/* Main Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          <CategoryChip
            label={t('product.all_categories')}
            isActive={selectedCategory === 0}
            onPress={() => {
              setSelectedCategory(0);
              setSelectedSubcategory(null);
            }}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              isActive={selectedCategory === category.id}
              onPress={() => setSelectedCategory(category.id)}
            />
          ))}
        </ScrollView>

        {/* Subcategories */}
        {subcategories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcategoriesScroll}
          >
            <CategoryChip
              label={t('common.all')}
              isActive={selectedSubcategory === null}
              onPress={() => setSelectedSubcategory(null)}
            />
            {subcategories.map((subcategory) => (
              <CategoryChip
                key={subcategory.id}
                label={subcategory.name}
                isActive={selectedSubcategory === subcategory.id}
                onPress={() => setSelectedSubcategory(subcategory.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Products Grid */}
      {loading && products.length === 0 ? (
        <GridSkeleton count={6} />
      ) : (
      <FlatList
        ref={flatListRef}
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        style={styles.list}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
        renderItem={({ item }) => {
          const topThreePrices = getTopThreePrices(item);
          return (
            <View style={styles.gridItem}>
              <ProductGridCard
                productName={item.name}
                categoryName={item.category?.name}
                imageUrl={item.image_url || undefined}
                topThreePrices={topThreePrices}
                constraint={item.constraint}
                onPress={() => (navigation as any).navigate('ProductDetail', { productId: item.id })}
                onAddToCart={() => handleAddToCart(item)}
              />
            </View>
          );
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={colors.primary.main} />
            </View>
          ) : !hasMore && products.length > 0 ? (
            <Text style={styles.footerEnd}>{t('product.all_shown')}</Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('product.category_empty')}</Text>
          </View>
        }
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  header: {
    backgroundColor: `${colors.background.paper}CC`,
    paddingTop: spacing.xl,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    ...typography.styles.h4,
    fontSize: 18,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  searchButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },

  cartPill: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartPillBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cartPillBadgeText: {
    color: colors.background.paper,
    fontSize: 10,
    fontWeight: '700',
  },

  cartPillCaption: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  cartPillCaptionStrong: {
    color: colors.text.primary,
    fontWeight: '700',
  },

  categoriesScroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  subcategoriesScroll: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },

  list: {
    flex: 1,
  },

  gridContainer: {
    padding: layout.screenPadding,
    paddingBottom: spacing['3xl'],
  },

  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  gridItem: {
    width: '48%',
  },

  footerLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  footerEnd: {
    ...typography.styles.caption,
    color: colors.text.hint,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  emptyContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },

  emptyText: {
    ...typography.styles.body2,
    color: colors.text.hint,
  },
});

