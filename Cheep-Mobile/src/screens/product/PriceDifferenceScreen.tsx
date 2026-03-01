/**
 * 💰 Price Difference Screen
 * En büyük fiyat farkına sahip ürünler listesi
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { productService } from '../../services';
import { SmartDealCard } from '../../components/home';
import { colors, typography, spacing, layout } from '../../theme';
import type { Product } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';

export function PriceDifferenceScreen({
  navigation,
}: HomeStackScreenProps<'PriceDifferenceList'>) {
  const [products, setProducts] = useState<(Product & { priceDifference?: number; minPrice?: number; maxPrice?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const allProducts = await productService.getProducts({ limit: 200 }); // Daha fazla ürün çekiyoruz

      // Fiyat farkına göre sırala (en büyük fark en üstte)
      const productsWithPriceDifference = allProducts
        .filter((product) => product.store_prices && product.store_prices.length >= 2) // En az 2 fiyat olmalı
        .map((product) => {
          const prices = product.store_prices!.map((sp) => parseFloat(sp.price));
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceDifference = maxPrice - minPrice;
          return {
            ...product,
            priceDifference,
            minPrice,
            maxPrice,
          };
        })
        .sort((a, b) => b.priceDifference - a.priceDifference) // Büyükten küçüğe sırala
        .slice(0, 50); // İlk 50 ürünü al

      setProducts(productsWithPriceDifference);
    } catch (error) {
      console.error('❌ Load products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const getLowestPrice = (product: Product) => {
    if (!product.store_prices?.length) return null;
    const prices = product.store_prices.map((sp) => parseFloat(sp.price));
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Akıllı Fırsatlar</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          En büyük fiyat farkına sahip {products.length} ürün
        </Text>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
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
                  price={price || '0.00'}
                  unit={item.store_prices?.[0]?.unit || 'adet'}
                  storeName={storeName}
                  imageUrl={item.image_url || undefined}
                  discountPercent={discountPercent > 0 ? discountPercent : undefined}
                  onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
                />
              </View>
              {/* Fiyat farkı bilgisi */}
              {priceDiff > 0 && (
                <View style={styles.priceDiffInfo}>
                  <Text style={styles.priceDiffText}>
                    Fiyat farkı: {priceDiff.toFixed(2)}₺
                  </Text>
                  <Text style={styles.priceRangeText}>
                    {item.minPrice?.toFixed(2)}₺ - {item.maxPrice?.toFixed(2)}₺
                  </Text>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory-2" size={64} color={colors.text.hint} />
            <Text style={styles.emptyText}>Ürün bulunamadı</Text>
          </View>
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
      />
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
    paddingBottom: spacing['3xl'],
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

