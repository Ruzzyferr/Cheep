/**
 * 🛍️ Product Grid Card
 * 2 kolonlu grid için ürün kartı - En ucuz 3 market gösterir
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';

interface PriceInfo {
  storeName: string;
  price: string;
}

interface ProductGridCardProps {
  productName: string;
  categoryName?: string;
  imageUrl?: string;
  topThreePrices: PriceInfo[];
  onPress: () => void;
  onAddToCart: () => void;
}

export function ProductGridCard({
  productName,
  categoryName,
  imageUrl,
  topThreePrices,
  onPress,
  onAddToCart,
}: ProductGridCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="inventory-2" size={28} color={colors.text.hint} />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        {categoryName && (
          <Text style={styles.categoryLabel} numberOfLines={1}>
            {categoryName}
          </Text>
        )}
        <Text style={styles.productName} numberOfLines={2}>
          {productName}
        </Text>

        {/* Top 3 Prices */}
        <View style={styles.pricesContainer}>
          <Text style={styles.pricesLabel}>En ucuz 3 market:</Text>
          <View style={styles.pricesList}>
            {topThreePrices.slice(0, 3).map((priceInfo, index) => (
              <Text key={index} style={[styles.priceItem, index > 0 && { marginTop: 2 }]} numberOfLines={1}>
                {priceInfo.storeName}: <Text style={styles.priceValue}>₺{priceInfo.price}</Text>
              </Text>
            ))}
          </View>
        </View>

        {/* Add to Cart Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={(e) => {
              e.stopPropagation();
              onAddToCart();
            }}
          >
            <MaterialIcons name="add-shopping-cart" size={20} color={colors.background.paper} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    flex: 1,
  },

  imageContainer: {
    width: '100%',
    height: 96,
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


  content: {
    flex: 1,
  },

  categoryLabel: {
    ...typography.styles.caption,
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },

  productName: {
    ...typography.styles.body2,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },

  pricesContainer: {
    flex: 1,
    marginBottom: spacing.sm,
  },

  pricesLabel: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 4,
  },

  pricesList: {
    // gap replaced with marginTop in render
  },

  priceItem: {
    ...typography.styles.caption,
    fontSize: 12,
    color: colors.text.primary,
  },

  priceValue: {
    fontWeight: '600',
  },

  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  addButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

