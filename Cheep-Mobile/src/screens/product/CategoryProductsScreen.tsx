/**
 * 📂 Kategori ürünleri
 *
 * Veri katmanı tamamen React Query'de. Bu ekran eskiden şunları elle
 * yönetiyordu ve her biri bir hata kaynağıydı:
 *  - Eşzamanlı isteklerde eski yanıtın yenisini ezmesine karşı istek-kimliği
 *    guard'ı (`loadProductsReqId`)
 *  - Sayfalama durumu (`hasMore`, `loadingMore`, offset hesabı)
 *  - Kategori/alt kategori değişiminde el ile yeniden yükleme zinciri
 *  - Sepet sayısını tazelemek için `cart.refresh()` çağrıları
 *
 * `useInfiniteQuery` yarışları ve sayfalamayı kendi çözüyor; listeye ekleme
 * mutasyonu `['lists']` önekini geçersizleştirdiği için sepet rozeti de
 * kendiliğinden güncelleniyor.
 */

import React, { useState } from 'react';
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
import { ProductGridCard } from '../../components/product/ProductGridCard';
import { CategoryChip } from '../../components/common/CategoryChip';
import { GridSkeleton, RefreshBar, ErrorState } from '../../components/ui';
import {
  useActiveList,
  useListMutations,
  useParentCategories,
  useProductsInfinite,
  useSubcategories,
  flattenProducts,
} from '../../queries';
import { useToast } from '../../context/ToastContext';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import type { Product } from '../../types';
import type { HomeStackScreenProps, ListsStackScreenProps } from '../../navigation/types';
import { useBottomSpacing, useTopSpacing } from '../../hooks/useScreenSpacing';

// Aynı bileşen hem Home hem Lists stack'inde kayıtlı (liste detayından "Ürün Ekle"
// akışı kullanıcıyı Listeler sekmesinde tutar). İki stack'in param'ı özdeş.
type CategoryProductsProps =
  | HomeStackScreenProps<'CategoryProducts'>
  | ListsStackScreenProps<'CategoryProducts'>;

/** Sonsuz kaydırmada sayfa başına ürün. */
const PAGE_SIZE = 24;

/** "Tüm Kategoriler" sanal seçimi — gerçek bir kategori değil. */
const ALL_CATEGORIES = 0;

export function CategoryProductsScreen({ navigation, route }: CategoryProductsProps) {
  // headerShown:false — ust guvenli alani ekran kendisi birakmali.
  const topSpacing = useTopSpacing();
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { categoryId, categoryName } = route.params;
  // Hedef liste verildiyse (liste detayından "Ürün Ekle") ekleme O listeye gider;
  // yoksa aktif listeye. Böylece aktif olmayan bir listeye de ürün eklenebilir.
  const targetListId = route.params.targetListId;
  const targetListName = route.params.targetListName;

  const toast = useToast();
  const { t } = useTranslation();
  const { formatMoney } = useLocale();

  const [selectedCategory, setSelectedCategory] = useState<number>(categoryId);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);

  const categoriesQ = useParentCategories();
  const subcategoriesQ = useSubcategories(selectedCategory);
  const activeListQ = useActiveList();
  const { addItem, createList } = useListMutations();

  const categories = categoriesQ.data ?? [];
  const subcategories = subcategoriesQ.data ?? [];
  const activeList = activeListQ.data ?? null;
  const cartCount = activeList?.list_items?.length ?? 0;

  // Etkin kategori: alt kategori seçiliyse o, değilse üst kategori.
  const effectiveCategoryId = selectedSubcategory ?? selectedCategory;
  const productsQ = useProductsInfinite({
    limit: PAGE_SIZE,
    category_id: effectiveCategoryId === ALL_CATEGORIES ? undefined : effectiveCategoryId,
  });

  const products = flattenProducts(productsQ.data?.pages);

  const flatListRef = React.useRef<FlatList>(null);

  // Kategori değişince listeyi başa sar. Sorgu key'i değiştiği için veri
  // zaten yenilenir; burada yalnızca kaydırma konumu düzeltilir.
  React.useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [effectiveCategoryId]);

  // Üst kategori değişince alt kategori seçimi düşer.
  const selectCategory = (id: number) => {
    setSelectedCategory(id);
    setSelectedSubcategory(null);
  };

  const getTopThreePrices = (product: Product) => {
    if (!product.store_prices || product.store_prices.length === 0) return [];
    return [...product.store_prices]
      .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
      .slice(0, 3)
      .map((sp) => ({
        storeName: sp.store?.name || t('product.unknown_store'),
        price: formatMoney(parseFloat(sp.price)),
      }));
  };

  const getCurrentCategoryName = () => {
    if (selectedCategory === ALL_CATEGORIES) return t('product.all_categories');
    return categories.find((c) => c.id === selectedCategory)?.name || categoryName;
  };

  /**
   * Hızlı ekle: hedef liste öncelikli, yoksa aktif liste; hiç liste yoksa bir
   * tane oluşturur. Mutasyon başarısında `['lists']` geçersizleştiği için
   * sepet rozeti ve anasayfa kendiliğinden güncellenir.
   */
  const handleAddToCart = async (product: Product) => {
    const unit = product.store_prices?.[0]?.unit || t('common.unit_default');
    try {
      let listId = targetListId ?? activeList?.id;
      let listName = targetListName ?? activeList?.name;

      if (!listId) {
        const created = await createList.mutateAsync(
          t('list.select_modal.default_new_list_name'),
        );
        listId = created.id;
        listName = created.name;
      }

      await addItem.mutateAsync({ listId, data: { product_id: product.id, quantity: 1, unit } });
      toast.show(t('list.added_to', { list: listName }));
    } catch (error) {
      console.error('Quick add error:', error);
      Alert.alert(t('common.error'), t('list.select_modal.add_error'));
    }
  };

  const goToActiveList = () => {
    if (activeList) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Lists',
          params: { screen: 'ListDetail', params: { listId: activeList.id } },
        }),
      );
    } else {
      navigation.dispatch(CommonActions.navigate({ name: 'Lists' }));
    }
  };

  const handleRefresh = () => {
    void Promise.all([productsQ.refetch(), categoriesQ.refetch(), subcategoriesQ.refetch()]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topSpacing }]}>
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
            onPress={() =>
              (navigation as any).navigate(
                'Search',
                targetListId ? { targetListId, targetListName } : undefined,
              )
            }
            activeOpacity={0.7}
          >
            <MaterialIcons name="search" size={22} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Sepet: hedef liste modunda gizli (o listeye ekliyoruz); aktif liste
              modunda kaç ürün eklendiğini gösterir, dokununca listeyi açar. */}
          {!targetListId && (
            <TouchableOpacity style={styles.cartPill} onPress={goToActiveList} activeOpacity={0.7}>
              <MaterialIcons name="shopping-cart" size={18} color={colors.primary.main} />
              {cartCount > 0 && (
                <View style={styles.cartPillBadge}>
                  <Text style={styles.cartPillBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Hangi listeye eklendiği: hedef liste öncelikli, yoksa aktif liste. */}
        {(targetListName || activeList) && (
          <Text style={styles.cartPillCaption} numberOfLines={1}>
            {t('product.target_list')}{' '}
            <Text style={styles.cartPillCaptionStrong}>{targetListName ?? activeList?.name}</Text>
          </Text>
        )}

        {/* Ana kategoriler */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          <CategoryChip
            label={t('product.all_categories')}
            isActive={selectedCategory === ALL_CATEGORIES}
            onPress={() => selectCategory(ALL_CATEGORIES)}
          />
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              isActive={selectedCategory === category.id}
              onPress={() => selectCategory(category.id)}
            />
          ))}
        </ScrollView>

        {/* Alt kategoriler */}
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

      {/* Arka plan tazelemesi — ekran boşalmaz */}
      <RefreshBar visible={!productsQ.isPending && productsQ.isFetching && !productsQ.isFetchingNextPage} />

      {/* Ürünler */}
      {productsQ.isPending ? (
        <GridSkeleton count={6} />
      ) : productsQ.isError ? (
        <ErrorState onRetry={() => productsQ.refetch()} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={[styles.gridContainer, { paddingBottom: bottomSpacing }]}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={productsQ.isRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primary.main}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <ProductGridCard
                productName={item.name}
                categoryName={item.category?.name}
                imageUrl={item.image_url || undefined}
                topThreePrices={getTopThreePrices(item)}
                constraint={item.constraint}
                onPress={() => (navigation as any).navigate('ProductDetail', { productId: item.id })}
                onAddToCart={() => handleAddToCart(item)}
              />
            </View>
          )}
          onEndReached={() => {
            if (productsQ.hasNextPage && !productsQ.isFetchingNextPage) {
              void productsQ.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            productsQ.isFetchingNextPage ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary.main} />
              </View>
            ) : !productsQ.hasNextPage && products.length > 0 ? (
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
