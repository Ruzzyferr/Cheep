/**
 * 🛍️ Product Detail Screen
 * Product information and price comparison
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { productService, categoryService } from '../../services';
import { Card, Button } from '../../components/ui';
import { StoreChip } from '../../components/store/StoreChip';
import { SelectListModal } from '../../components/list/SelectListModal';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { Product, StorePrice } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';
import type { Category } from '../../services/category.service';

export function ProductDetailScreen({
  route,
  navigation,
}: HomeStackScreenProps<'ProductDetail'>) {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<StorePrice[]>([]);
  const [categoryWithParent, setCategoryWithParent] = useState<Category | null>(null);
  const [priceStats, setPriceStats] = useState<{
    cheapest: StorePrice | null;
    mostExpensive: StorePrice | null;
    averagePrice: number;
    priceDifference: number;
    savingsPercentage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showListModal, setShowListModal] = useState(false);

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const productData = await productService.getProductById(productId);
      
      setProduct(productData);
      
      // Fetch category with parent information if category exists
      if (productData.category_id) {
        try {
          const categoryData = await categoryService.getCategoryById(productData.category_id);
          setCategoryWithParent(categoryData);
        } catch (error) {
          console.warn('Could not fetch category details:', error);
          setCategoryWithParent(null);
        }
      }
      
      // Use store_prices from productData if available, otherwise fetch separately
      let pricesData: StorePrice[] = [];
      if (productData.store_prices && productData.store_prices.length > 0) {
        pricesData = productData.store_prices;
      } else {
        // Fallback: fetch prices separately if not included in product data
        try {
          pricesData = await productService.getProductPrices(productId);
        } catch (error) {
          console.warn('Could not fetch prices separately:', error);
        }
      }
      
      const sortedPrices = pricesData.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      setPrices(sortedPrices);

      // Calculate price statistics from prices data
      if (sortedPrices.length > 0) {
        const priceValues = sortedPrices.map((p) => parseFloat(p.price));
        const cheapest = sortedPrices[0];
        const mostExpensive = sortedPrices[sortedPrices.length - 1];
        const averagePrice = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
        const priceDifference = parseFloat(mostExpensive.price) - parseFloat(cheapest.price);
        const savingsPercentage = parseFloat(mostExpensive.price) > 0
          ? (priceDifference / parseFloat(mostExpensive.price)) * 100 
          : 0;

        setPriceStats({
          cheapest,
          mostExpensive,
          averagePrice,
          priceDifference,
          savingsPercentage,
        });
      } else {
        // Reset stats if no prices
        setPriceStats(null);
      }
    } catch (error) {
      console.error('Load product error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.error}>
        <Text>Ürün bulunamadı</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="inventory-2" size={48} color={colors.text.hint} />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        {product.brand && <Text style={styles.brand}>{product.brand}</Text>}
        <Text style={styles.name}>{product.name}</Text>
        {product.category && (
          <Text style={styles.category}>{product.category.name}</Text>
        )}

        {/* Price Statistics */}
        {priceStats && prices.length > 1 && (
          <Card padding="md" variant="elevated" style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>En Ucuz</Text>
                <Text style={[styles.statValue, styles.cheapestPrice]}>
                  ₺{parseFloat(priceStats.cheapest?.price || '0').toFixed(2)}
                </Text>
                {priceStats.cheapest?.store && (
                  <Text style={styles.statStore}>{priceStats.cheapest.store.name}</Text>
                )}
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>En Pahalı</Text>
                <Text style={[styles.statValue, styles.expensivePrice]}>
                  ₺{parseFloat(priceStats.mostExpensive?.price || '0').toFixed(2)}
                </Text>
                {priceStats.mostExpensive?.store && (
                  <Text style={styles.statStore}>{priceStats.mostExpensive.store.name}</Text>
                )}
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Fark</Text>
                <Text style={[styles.statValue, styles.differencePrice]}>
                  ₺{priceStats.priceDifference.toFixed(2)}
                </Text>
                <Text style={styles.savingsPercent}>
                  %{priceStats.savingsPercentage.toFixed(0)} tasarruf
                </Text>
              </View>
            </View>
            <View style={styles.avgPriceRow}>
              <Text style={styles.avgPriceLabel}>Ortalama Fiyat:</Text>
              <Text style={styles.avgPriceValue}>
                ₺{priceStats.averagePrice.toFixed(2)}
              </Text>
            </View>
          </Card>
        )}

        {/* Price Comparison */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Fiyatları</Text>
          {prices.length > 0 && (
            <Text style={styles.priceCount}>{prices.length} market</Text>
          )}
        </View>
        {prices.length > 0 ? (
          prices.map((storePrice, index) => {
            const isCheapest = priceStats?.cheapest?.id === storePrice.id;
            const priceValue = parseFloat(storePrice.price);
            const cheapestPrice = priceStats?.cheapest ? parseFloat(priceStats.cheapest.price) : priceValue;
            const savings = priceStats?.mostExpensive 
              ? ((parseFloat(priceStats.mostExpensive.price) - priceValue) / parseFloat(priceStats.mostExpensive.price)) * 100
              : 0;

            return (
              <TouchableOpacity
                key={storePrice.id}
                onPress={() => {
                  if (storePrice.store?.id) {
                    navigation.navigate('StoreDetail', { storeId: storePrice.store.id });
                  }
                }}
                activeOpacity={0.7}
              >
                <Card padding="md" style={[styles.priceCard, isCheapest && styles.cheapestCard]}>
                  <View style={styles.priceCardContent}>
                    <View style={styles.storeSection}>
                      {storePrice.store?.logo_url ? (
                        <Image
                          source={{ uri: storePrice.store.logo_url }}
                          style={styles.storeLogo}
                        />
                      ) : (
                        <View style={styles.storeLogoPlaceholder}>
                          <MaterialIcons name="store" size={24} color={colors.text.secondary} />
                        </View>
                      )}
                      <View style={styles.storeInfo}>
                        <Text style={styles.storeName}>
                          {storePrice.store?.name || 'Market'}
                        </Text>
                        <Text style={styles.unit}>{storePrice.unit}</Text>
                        {storePrice.last_updated_at && (
                          <Text style={styles.updateDate}>
                            {new Date(storePrice.last_updated_at).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.priceSection}>
                      {isCheapest && (
                        <View style={styles.bestDealBadge}>
                          <MaterialIcons name="local-offer" size={16} color={colors.secondary.main} />
                          <Text style={styles.bestDealText}>En İyi</Text>
                        </View>
                      )}
                      <Text style={[styles.price, isCheapest && styles.cheapestPriceText]}>
                        ₺{priceValue.toFixed(2)}
                      </Text>
                      {savings > 0 && !isCheapest && (
                        <Text style={styles.savingsBadge}>
                          %{savings.toFixed(0)} tasarruf
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        ) : (
          <Card padding="lg" variant="outlined">
            <View style={styles.noPriceContainer}>
              <MaterialIcons name="info-outline" size={48} color={colors.text.hint} />
              <Text style={styles.noPrice}>Fiyat bilgisi bulunmuyor</Text>
              <Text style={styles.noPriceSubtext}>
                Bu ürün için henüz fiyat bilgisi eklenmemiş
              </Text>
            </View>
          </Card>
        )}

        {/* Product Details */}
        {(product.ean_barcode || product.category || categoryWithParent) && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Ürün Bilgileri</Text>
            <Card padding="md" variant="outlined">
              {product.ean_barcode && (
                <View style={styles.detailRow}>
                  <MaterialIcons name="qr-code" size={20} color={colors.text.secondary} />
                  <Text style={styles.detailLabel}>Barkod:</Text>
                  <Text style={styles.detailValue}>{product.ean_barcode}</Text>
                </View>
              )}
              {(categoryWithParent || product.category) && (
                <View style={styles.detailRow}>
                  <MaterialIcons name="category" size={20} color={colors.text.secondary} />
                  <Text style={styles.detailLabel}>Kategori:</Text>
                  <View style={styles.categoryValue}>
                    {categoryWithParent?.parent && (
                      <>
                        <Text style={styles.detailValue}>{categoryWithParent.parent.name}</Text>
                        <MaterialIcons name="chevron-right" size={16} color={colors.text.secondary} style={styles.categorySeparator} />
                      </>
                    )}
                    <Text style={styles.detailValue}>
                      {categoryWithParent?.name || product.category?.name || 'Bilinmiyor'}
                    </Text>
                  </View>
                </View>
              )}
            </Card>
          </View>
        )}

        <Button
          title="Listeye Ekle"
          onPress={() => setShowListModal(true)}
          fullWidth
          style={styles.addButton}
        />
      </View>

      <SelectListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        onSelect={(listId) => {
          // Product added successfully
          console.log('Product added to list:', listId);
        }}
        productId={productId}
      />
    </ScrollView>
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

  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  imageContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.background.input,
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    fontSize: 100,
  },

  content: {
    padding: layout.screenPadding,
  },

  brand: {
    ...typography.styles.overline,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  name: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },

  category: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  sectionTitle: {
    ...typography.styles.h3,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },

  priceCount: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
  },

  statsCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.background.paper,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },

  statItem: {
    flex: 1,
    alignItems: 'center',
  },

  statLabel: {
    ...typography.styles.caption,
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  statValue: {
    ...typography.styles.h4,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs / 2,
  },

  cheapestPrice: {
    color: colors.secondary.main,
  },

  expensivePrice: {
    color: colors.error?.main || '#EF4444',
  },

  differencePrice: {
    color: colors.primary.main,
  },

  statStore: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.text.hint,
    textAlign: 'center',
  },

  savingsPercent: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.secondary.main,
    fontWeight: '600',
  },

  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },

  avgPriceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  avgPriceLabel: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },

  avgPriceValue: {
    ...typography.styles.h4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },

  priceCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background.card,
  },

  cheapestCard: {
    borderWidth: 2,
    borderColor: colors.secondary.main,
    backgroundColor: `${colors.secondary.main}08`,
  },

  priceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  storeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  storeLogo: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background.input,
    resizeMode: 'contain',
  },

  storeLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background.input,
    justifyContent: 'center',
    alignItems: 'center',
  },

  storeInfo: {
    flex: 1,
  },

  storeName: {
    ...typography.styles.body1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },

  unit: {
    ...typography.styles.caption,
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: spacing.xs / 2,
  },

  updateDate: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.text.hint,
  },

  priceSection: {
    alignItems: 'flex-end',
  },

  bestDealBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.secondary.main}15`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },

  bestDealText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary.main,
    marginLeft: 2,
  },

  price: {
    ...typography.styles.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs / 2,
  },

  cheapestPriceText: {
    color: colors.secondary.main,
  },

  savingsBadge: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.secondary.main,
    fontWeight: '600',
    backgroundColor: `${colors.secondary.main}15`,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  noPriceContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },

  noPrice: {
    ...typography.styles.body1,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
  },

  noPriceSubtext: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.hint,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  detailsSection: {
    marginTop: spacing.lg,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  detailLabel: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },

  detailValue: {
    ...typography.styles.body1,
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },

  categoryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },

  categorySeparator: {
    marginHorizontal: spacing.xs,
  },

  addButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },

  scrollContent: {
    paddingBottom: 100, // Tab bar height (72) + FAB space (20) + extra padding (8)
  },
});

