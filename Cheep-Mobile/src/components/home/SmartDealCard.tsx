/**
 * 🎯 Smart Deal Card
 * Akıllı fırsat kartı - horizontal scroll için
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface SmartDealCardProps {
  productName: string;
  price: string;
  unit: string;
  storeName: string;
  imageUrl?: string;
  discountPercent?: number;
  onPress: () => void;
}

export function SmartDealCard({
  productName,
  price,
  unit,
  storeName,
  imageUrl,
  discountPercent,
  onPress,
}: SmartDealCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.95}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="inventory-2" size={32} color={colors.text.hint} />
          </View>
        )}
        {discountPercent !== undefined && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discountPercent}%</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={1}>
          {productName}
        </Text>
        <Text style={styles.storeName} numberOfLines={1}>
          {storeName}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}₺</Text>
          <Text style={styles.unit}>/{unit}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 144, // w-36 = 144px
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },

  imageContainer: {
    width: '100%',
    height: 80, // h-20 = 80px
    backgroundColor: colors.background.input,
    position: 'relative',
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
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

  discountBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: `${colors.background.paper}E6`, // 90% opacity
    borderWidth: 1,
    borderColor: colors.secondary.main,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },

  discountText: {
    ...typography.styles.caption,
    fontSize: 9,
    fontWeight: '700',
    color: colors.secondary.main,
  },

  content: {
    padding: spacing.sm,
    paddingTop: spacing.xs,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  productName: {
    ...typography.styles.body2,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 18,
  },

  storeName: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '500',
    color: colors.text.secondary,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
  },

  price: {
    ...typography.styles.h4,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
  },

  unit: {
    ...typography.styles.caption,
    fontSize: 10,
    color: colors.text.secondary,
    marginLeft: spacing.xs / 2,
  },
});


