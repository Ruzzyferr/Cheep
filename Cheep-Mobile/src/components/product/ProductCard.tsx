/**
 * 🛍️ Product Card
 * Product display card with price
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui';
import { ProductThumb } from './ProductThumb';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, borderRadius } from '../../theme';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  showStore?: boolean;
}

export function ProductCard({ product, onPress, showStore = false }: ProductCardProps) {
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  // Get lowest price — geçersiz/boş fiyatları (NaN) ele ki formatMoney(NaN) render edilmesin.
  const validPrices = (product.store_prices ?? [])
    .map((sp) => parseFloat(sp.price))
    .filter((p) => Number.isFinite(p));
  const lowestPrice = validPrices.length ? Math.min(...validPrices) : null;

  const storeName = product.store_prices?.[0]?.store?.name;

  return (
    <Card onPress={onPress} padding="sm" style={styles.card}>
      {/* Product Image — görsel yoksa kategori-ikonlu placeholder */}
      <View style={styles.imageContainer}>
        <ProductThumb
          imageUrl={product.image_url}
          categoryName={product.category?.name}
          iconKey={product.category?.icon_key}
          iconSize={40}
        />
      </View>

      {/* Product Info */}
      <View style={styles.info}>
        {product.brand && (
          <Text style={styles.brand} numberOfLines={1}>
            {product.brand}
          </Text>
        )}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Category */}
        {product.category && (
          <Text style={styles.category} numberOfLines={1}>
            {product.category.name}
          </Text>
        )}

        {/* Price & Store */}
        <View style={styles.footer}>
          {lowestPrice ? (
            <View>
              <Text style={styles.price}>{formatMoney(lowestPrice)}</Text>
              {showStore && storeName && (
                <Text style={styles.store}>{storeName}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.noPrice}>{t('product.no_price_info')}</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    marginRight: spacing.sm,
  },

  imageContainer: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.background.card,
    marginBottom: spacing.sm,
  },

  info: {
    flex: 1,
  },

  brand: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: 2,
  },

  name: {
    ...typography.styles.body2,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  category: {
    ...typography.styles.caption,
    color: colors.text.hint,
    marginBottom: spacing.xs,
  },

  footer: {
    marginTop: 'auto',
  },

  price: {
    ...typography.styles.priceSmall,
    color: colors.text.primary,
    fontWeight: '700',
  },

  store: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },

  noPrice: {
    ...typography.styles.caption,
    color: colors.text.disabled,
  },
});

