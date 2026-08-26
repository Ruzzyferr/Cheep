/**
 * 💰 Price Difference Screen
 * En büyük fiyat farkına sahip ürünler listesi
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useProductsList } from '../../queries';
import { GridSkeleton, RefreshBar, ErrorState } from '../../components/ui';
import { SmartDealCard } from '../../components/home';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout } from '../../theme';
import type { Product } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import { useBottomSpacing, useTopSpacing } from '../../hooks/useScreenSpacing';

export function PriceDifferenceScreen({
  navigation,
}: HomeStackScreenProps<'PriceDifferenceList'>) {
  // headerShown:false — ust guvenli alani ekran kendisi birakmali.
  const topSpacing = useTopSpacing();
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { t } = useTranslation();
  const { formatMoney } = useLocale();

  // Bu ekranın hiç yükleme göstergesi yoktu: kullanıcı veri gelene kadar boş
  // bir listeye bakıyordu.
  const productsQ = useProductsList({ limit: 200 });

  /** Marketler arası farkı en büyük olan ilk 50 ürün. */
  const products = useMemo(() => {
    return (productsQ.data ?? [])
      .map((product) => ({
        product,
        // Geçersiz/boş fiyatları (NaN) ele: ₺NaN / Infinity render etmeyi önler.
        prices: (product.store_prices ?? [])
          .map((sp) => parseFloat(sp.price))
          .filter((n) => Number.isFinite(n)),
      }))
      .filter(({ prices }) => prices.length >= 2)
      .map(({ product, prices }) => {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        return { ...product, priceDifference: maxPrice - minPrice, minPrice, maxPrice };
      })
      .sort((a, b) => b.priceDifference - a.priceDifference)
      .slice(0, 50);
  }, [productsQ.data]);

  const handleRefresh = () => {
    void productsQ.refetch();
  };

  const getLowestPrice = (product: Product) => {
    const prices = (product.store_prices ?? [])
      .map((sp) => parseFloat(sp.price))
      .filter((p) => Number.isFinite(p));
    if (prices.length === 0) return null;
    return Math.min(...prices).toFixed(2);
  };

  const getStoreName = (product: Product) => {
    if (!product.store_prices?.length) return '';
    const lowestPriceItem = product.store_prices.reduce((prev, curr) =>
      parseFloat(prev.price) < parseFloat(curr.price) ? prev : curr
    );
    return lowestPriceItem.store?.name || '';
  };

  const getPriceDifferencePercent = (product: Product & { priceDifference?: number; maxPrice?: number }) => {
    if (!product.maxPrice || product.maxPrice === 0) return 0;
    const difference = product.priceDifference || 0;
    return Math.round((difference / product.maxPrice) * 100);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topSpacing }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('product.smart_deals')}</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          En büyük fiyat farkına sahip {products.length} ürün
        </Text>
      </View>

      <RefreshBar visible={!productsQ.isPending && productsQ.isFetching && !productsQ.isRefetching} />

      {/* Products List */}
      {productsQ.isPending ? (
        <GridSkeleton count={6} />
      ) : productsQ.isError ? (
        <ErrorState onRetry={handleRefresh} />
      ) : (
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.listContainer, { paddingBottom: bottomSpacing }]}
        refreshControl={
          <RefreshControl
            refreshing={productsQ.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary.main}
          />
        }
        renderItem={({ item }) => {
          const price = getLowestPrice(item);
          const storeName = getStoreName(item);
          const discountPercent = getPriceDifferencePercent(item);
          const priceDiff = item.priceDifference || 0;

          return (
            <View style={styles.cardWrapper}>
              <View style={styles.cardContainer}>
                <SmartDealCard
                  productName={item.name}
                  price={price ? formatMoney(parseFloat(price)) : formatMoney(0)}
                  unit={item.store_prices?.[0]?.unit || 'adet'}
                  storeName={storeName}
                  imageUrl={item.image_url || undefined}
                  categoryName={item.category?.name}
                  discountPercent={discountPercent > 0 ? discountPercent : undefined}
                  onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                />
              </View>
              {/* Fiyat farkı bilgisi */}
              {priceDiff > 0 && (
                <View style={styles.priceDiffInfo}>
                  <Text style={styles.priceDiffText}>
                    Fiyat farkı: {formatMoney(priceDiff)}
                  </Text>
                  <Text style={styles.priceRangeText}>
                    {item.minPrice != null ? formatMoney(item.minPrice) : ''} - {item.maxPrice != null ? formatMoney(item.maxPrice) : ''}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory-2" size={64} color={colors.text.hint} />
            <Text style={styles.emptyText}>{t('product.not_found')}</Text>
          </View>
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
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
    paddingBottom: spacing.md,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.xs,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },

  headerTitle: {
    ...typography.styles.h4,
    fontSize: 20,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
    paddingHorizontal: layout.screenPadding,
  },

  listContainer: {
    padding: layout.screenPadding,
  },

  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },

  cardWrapper: {
    width: '48%',
  },

  cardContainer: {
    width: '100%',
    alignItems: 'center',
  },

  priceDiffInfo: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.background.input,
    borderRadius: 8,
  },

  priceDiffText: {
    ...typography.styles.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondary.main,
    marginBottom: 2,
  },

  priceRangeText: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.text.secondary,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },

  emptyText: {
    ...typography.styles.body2,
    color: colors.text.hint,
    marginTop: spacing.md,
  },
});

