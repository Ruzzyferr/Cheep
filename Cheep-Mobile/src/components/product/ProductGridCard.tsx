/**
 * 🛍️ Product Grid Card
 * 2 kolonlu grid için ürün kartı - En ucuz 3 market gösterir
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { ProductThumb } from './ProductThumb';
import type { ProductConstraint } from '../../types';

interface PriceInfo {
  storeName: string;
  /** Already formatted via formatMoney() by the caller — includes the currency symbol. */
  price: string;
}

interface ProductGridCardProps {
  productName: string;
  categoryName?: string;
  imageUrl?: string;
  topThreePrices: PriceInfo[];
  onPress: () => void;
  onAddToCart: () => void;
  constraint?: ProductConstraint;
}

export function ProductGridCard({
  productName,
  categoryName,
  imageUrl,
  topThreePrices,
  onPress,
  onAddToCart,
  constraint,
}: ProductGridCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Product Image — görsel yoksa kategori-ikonlu placeholder */}
      <View style={styles.imageContainer}>
        <ProductThumb imageUrl={imageUrl} categoryName={categoryName} iconSize={40} />

        {/* Constraint rozetleri görselin ÜSTÜNDE (overlay) — dikey akışı bozmaz,
            böylece aşağıdaki fiyat bloğu her kartta aynı hizada sabit kalır. */}
        {constraint?.warnings && constraint.warnings.length > 0 && (
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeText}>{t('product.check_label')}</Text>
          </View>
        )}
        {constraint?.hidden && (
          <View style={styles.dietBadge}>
            <Text style={styles.dietBadgeText}>{t('product.diet_mismatch')}</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.content}>
        {/* Kategori satırı her kartta rezerve (boş olsa da) → adlar hep aynı Y'de başlar */}
        <Text style={styles.categoryLabel} numberOfLines={1}>
          {categoryName || ' '}
        </Text>
        {/* Ürün adı tam 2 satır yüksekliği → 1 satırlık adlar da 2 satır yer kaplar */}
        <Text style={styles.productName} numberOfLines={2}>
          {productName}
        </Text>

        {/* Top 3 Prices — sabit konum */}
        <View style={styles.pricesContainer}>
          <Text style={styles.pricesLabel}>{t('product.top_three_stores')}</Text>
          <View style={styles.pricesList}>
            {topThreePrices.slice(0, 3).map((priceInfo, index) => (
              <Text key={index} style={[styles.priceItem, index > 0 && { marginTop: 2 }]} numberOfLines={1}>
                {priceInfo.storeName}: <Text style={styles.priceValue}>{priceInfo.price}</Text>
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
    backgroundColor: colors.background.card,
    marginBottom: spacing.sm,
    position: 'relative',
  },

  content: {
    flex: 1,
  },

  categoryLabel: {
    ...typography.styles.caption,
    fontSize: 12,
    lineHeight: 14,
    height: 14,               // sabit → boş kategori de aynı yer kaplar
    color: colors.text.secondary,
    marginBottom: 2,
  },

  productName: {
    ...typography.styles.body2,
    fontWeight: '600',
    lineHeight: 18,
    height: 36,               // tam 2 satır → tüm kartlarda eşit yükseklik
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

  warningBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.warning.bg,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },

  warningBadgeText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '600',
    color: colors.warning.dark,
  },

  dietBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(20,33,27,0.72)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },

  dietBadgeText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    fontStyle: 'italic',
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

