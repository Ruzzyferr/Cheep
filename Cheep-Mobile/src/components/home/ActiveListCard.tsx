/**
 * 🛒 Active List Card
 * Aktif alışveriş listesi kartı
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { getStoreLogoAsset } from '../../utils/storeLogo';

interface ActiveListCardProps {
  listName: string;
  foundItems: number;
  totalItems: number;
  estimatedPrice?: { min: number; max: number };
  savingsPercent?: number;
  storeLogos?: string[]; // Deprecated: use storeNames instead
  storeNames?: string[]; // Market isimleri - logolar assets'ten yüklenecek
  onPress: () => void;
}

export function ActiveListCard({
  listName,
  foundItems,
  totalItems,
  estimatedPrice,
  savingsPercent,
  storeLogos = [],
  storeNames = [],
  onPress,
}: ActiveListCardProps) {
  // Store names varsa onları kullan, yoksa storeLogos'u kullan (backward compatibility)
  const stores = storeNames.length > 0 ? storeNames : storeLogos;
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.listName}>{listName}</Text>
            <Text style={styles.info}>
              {totalItems} Ürün
              {estimatedPrice && ` • Tahmini ${estimatedPrice.min}₺ - ${estimatedPrice.max}₺`}
            </Text>
          </View>
          {savingsPercent !== undefined && (
            <View style={styles.savingsBadge}>
              <MaterialIcons name="trending-down" size={14} color={colors.secondary.main} />
              <Text style={styles.savingsText}>%{savingsPercent} Tasarruf</Text>
            </View>
          )}
        </View>

        {totalItems > 0 && stores.length > 0 ? (
          <View style={styles.storeLogos}>
            {stores.slice(0, 3).map((store, index) => {
              // Eğer storeNames kullanılıyorsa, asset'ten logo yükle
              const logoAsset = storeNames.length > 0 ? getStoreLogoAsset(store) : null;
              const isUri = storeNames.length === 0 && store && typeof store === 'string' && store.startsWith('http');
              
              return (
                <View key={index} style={[styles.logoContainer, index > 0 && styles.logoOverlap]}>
                  {logoAsset ? (
                    <Image source={logoAsset} style={styles.logo} resizeMode="contain" />
                  ) : isUri ? (
                    <Image source={{ uri: store }} style={styles.logo} />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <MaterialIcons name="store" size={16} color={colors.text.secondary} />
                    </View>
                  )}
                </View>
              );
            })}
            {stores.length > 3 && (
              <View style={[styles.logoContainer, styles.logoOverlap, styles.moreLogos]}>
                <Text style={styles.moreText}>+{stores.length - 3}</Text>
              </View>
            )}
            <View style={styles.divider} />
          </View>
        ) : totalItems === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="shopping-cart" size={24} color={colors.text.hint} />
            <Text style={styles.emptyText}>Listeye ürün ekleyerek başlayın</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={onPress}>
          <MaterialIcons name="alt-route" size={20} color={colors.background.paper} />
          <Text style={styles.buttonText}>En Ucuz Rotayı Oluştur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },

  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  headerLeft: {
    flex: 1,
  },

  listName: {
    ...typography.styles.h3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },

  info: {
    ...typography.styles.body2,
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${colors.secondary.main}1A`, // 10% opacity
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: `${colors.secondary.main}33`, // 20% opacity
  },

  savingsText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '600',
    color: colors.secondary.main,
  },

  storeLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.background.card,
    backgroundColor: colors.background.input,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoOverlap: {
    marginLeft: -12,
  },

  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },

  logoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  moreLogos: {
    backgroundColor: colors.background.input,
  },

  moreText: {
    ...typography.styles.caption,
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.xs,
  },

  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.input,
    borderRadius: borderRadius.md,
  },

  emptyText: {
    ...typography.styles.body2,
    fontSize: 13,
    color: colors.text.hint,
    fontWeight: '500',
  },

  button: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },

  buttonText: {
    ...typography.styles.button,
    fontSize: 14,
    fontWeight: '600',
    color: colors.background.paper,
  },
});

