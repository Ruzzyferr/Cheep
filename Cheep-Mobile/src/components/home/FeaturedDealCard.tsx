/**
 * 🎯 Featured Deal Card
 * Öne çıkan fırsat kartı
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';

interface FeaturedDealCardProps {
  productName: string;
  price: string;
  unit: string;
  storeName: string;
  imageUrl?: string;
  onPress: () => void;
}

export function FeaturedDealCard({
  productName,
  price,
  unit,
  storeName,
  imageUrl,
  onPress,
}: FeaturedDealCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>📦</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.productName} numberOfLines={1}>
          {productName}
        </Text>
        <Text style={styles.label}>En Düşük Fiyat</Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}₺</Text>
          <Text style={[styles.unit, { marginLeft: spacing.xs }]}>/{unit}</Text>
        </View>

        <Text style={styles.storeName} numberOfLines={1}>
          {storeName}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160, // w-40 = 160px
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    marginRight: spacing.md,
    ...shadows.card,
  },

  imageContainer: {
    width: '100%',
    height: 112, // h-28 = 112px
    backgroundColor: colors.background.input,
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

  placeholderText: {
    fontSize: 40,
  },

  content: {
    padding: 12, // p-3 = 12px
  },

  productName: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: colors.text.primary,
    marginBottom: 4,
  },

  label: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: 4, // mt-1 = 4px
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4, // mt-1 = 4px
    marginBottom: 4, // mt-1 = 4px
  },

  price: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.primary.main,
  },

  unit: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.text.secondary,
  },

  storeName: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: colors.text.secondary,
    marginTop: 4, // mt-1 = 4px
  },
});

