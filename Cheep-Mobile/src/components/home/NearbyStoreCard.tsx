/**
 * 🏪 Nearby Store Card
 * Yakındaki market kartı
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface NearbyStoreCardProps {
  storeName: string;
  distance: string;
  logoUrl?: string;
  onPress: () => void;
}

export function NearbyStoreCard({
  storeName,
  distance,
  logoUrl,
  onPress,
}: NearbyStoreCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.logoContainer}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.placeholderLogo}>
            <MaterialIcons name="store" size={20} color={colors.text.secondary} />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.storeName}>{storeName}</Text>
        <View style={styles.distanceRow}>
          <MaterialIcons name="location-on" size={12} color={colors.text.secondary} />
          <Text style={styles.distance}>{distance}</Text>
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={20} color={colors.text.secondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.md,
  },

  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.paper,
    padding: spacing.xs,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  placeholderLogo: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
  },

  storeName: {
    ...typography.styles.body2,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },

  distance: {
    ...typography.styles.caption,
    fontSize: 12,
    color: colors.text.secondary,
  },
});

