/**
 * 🛍️ Product Card
 * Product display card with price
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card } from '../ui';
import { colors, typography, spacing, borderRadius } from '../../theme';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  showStore?: boolean;
}

export function ProductCard({ product, onPress, showStore = false }: ProductCardProps) {
  // Get lowest price
  const lowestPrice = product.store_prices?.length
    ? Math.min(...product.store_prices.map(sp => parseFloat(sp.price)))
    : null;

  const storeName = product.store_prices?.[0]?.store?.name;

  return (
    <Card onPress={onPress} padding="sm" style={styles.card}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="inventory-2" size={32} color={colors.text.hint} />
          </View>
        )}
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
              <Text style={styles.price}>₺{lowestPrice.toFixed(2)}</Text>
              {showStore && storeName && (
                <Text style={styles.store}>{storeName}</Text>
              )}
            </View>
          ) : (
            <Text style={styles.noPrice}>Fiyat bilgisi yok</Text>
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
    backgroundColor: colors.background.input,
    marginBottom: spacing.sm,
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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

