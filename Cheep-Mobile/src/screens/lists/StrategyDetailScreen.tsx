/**
 * 📋 Strategy Detail Screen
 * Detailed view of a shopping strategy/route
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { Card, Button } from '../../components/ui';
import { StoreChip } from '../../components/store/StoreChip';
import { listService } from '../../services';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { StoreAllocation, ProductAllocation } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';

export function StrategyDetailScreen({
  route,
  navigation,
}: ListsStackScreenProps<'StrategyDetail'>) {
  const { strategy, listId } = route.params;

  const withinBudget = strategy.budgetStatus === 'within_budget';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header Info */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.strategyType}>
              {strategy.type === 'single_store' ? 'Tek Market' : 'Çoklu Market'}
            </Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>Skor: {strategy.score}/100</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>Toplam Tutar</Text>
              <Text style={styles.priceValue}>₺{strategy.totalPrice.toFixed(2)}</Text>
            </View>
            {strategy.totalDistance > 0 && (
              <View>
                <Text style={styles.priceLabel}>Toplam Mesafe</Text>
                <Text style={styles.priceValue}>{strategy.totalDistance.toFixed(1)} km</Text>
              </View>
            )}
          </View>

          {/* Budget Status */}
          {strategy.budgetStatus !== 'unknown' && (
            <View
              style={[
                styles.budgetBadge,
                withinBudget ? styles.budgetWithin : styles.budgetOver,
              ]}
            >
              <Text
                style={[
                  styles.budgetText,
                  withinBudget ? styles.budgetWithinText : styles.budgetOverText,
                ]}
              >
                {withinBudget ? 'Bütçe dahilinde' : 'Bütçe aşıyor'}
                {strategy.budgetRemaining !== null && (
                  <Text>
                    {' '}
                    ({withinBudget ? '+' : ''}₺{strategy.budgetRemaining.toFixed(2)})
                  </Text>
                )}
              </Text>
            </View>
          )}

          {/* Coverage */}
          <View style={styles.coverageRow}>
            <Text style={styles.coverageLabel}>Kapsama:</Text>
            <Text style={styles.coverageValue}>{strategy.coveragePercentage}%</Text>
          </View>
        </View>

        {/* Stores */}
        {strategy.stores.map((storeAllocation, storeIndex) => (
          <StoreSection
            key={storeIndex}
            storeAllocation={storeAllocation}
            storeIndex={storeIndex}
            totalStores={strategy.stores.length}
          />
        ))}

        {/* Missing Products */}
        {strategy.missingProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bulunamayan Ürünler</Text>
            {strategy.missingProducts.map((missing, index) => (
              <Card key={index} padding="md" style={styles.missingCard}>
                <Text style={styles.missingProductName}>
                  {missing.product.name}
                  {missing.product.brand && ` - ${missing.product.brand}`}
                </Text>
                <Text style={styles.missingQuantity}>
                  {missing.quantity} {missing.unit}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Action Button */}
      <View style={styles.actions}>
        <Button
          title="Bu Rotayı Kullan"
          onPress={async () => {
            try {
              await listService.useRoute(listId);
              Alert.alert('Başarılı', 'Liste tamamlandı ve geçmiş listelere taşındı', [
                {
                  text: 'Tamam',
                  onPress: () => {
                    // Lists ekranına dön
                    navigation.dispatch(
                      CommonActions.navigate({
                        name: 'Lists',
                      })
                    );
                  },
                },
              ]);
            } catch (error: any) {
              console.error('Use route error:', error);
              Alert.alert('Hata', 'Rota kullanılırken bir hata oluştu');
            }
          }}
          fullWidth
          icon={<MaterialIcons name="shopping-cart" size={18} color={colors.background.paper} style={styles.buttonIcon} />}
        />
      </View>
    </View>
  );
}

// Store Section Component
function StoreSection({
  storeAllocation,
  storeIndex,
  totalStores,
}: {
  storeAllocation: StoreAllocation;
  storeIndex: number;
  totalStores: number;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.storeHeader}>
        <View style={styles.storeHeaderLeft}>
          <Text style={styles.storeNumber}>
            {totalStores > 1 ? `Market ${storeIndex + 1}` : 'Market'}
          </Text>
          <StoreChip storeName={storeAllocation.store.name} />
        </View>
        <Text style={styles.storeSubtotal}>
          ₺{storeAllocation.subtotal.toFixed(2)}
        </Text>
      </View>

      {/* Products in this store */}
      <View style={styles.productsList}>
        {storeAllocation.products.map((productAllocation) => (
          <ProductRow
            key={productAllocation.listItemId}
            productAllocation={productAllocation}
          />
        ))}
      </View>
    </View>
  );
}

// Product Row Component
function ProductRow({ productAllocation }: { productAllocation: ProductAllocation }) {
  return (
    <Card padding="sm" style={styles.productCard}>
      <View style={styles.productRow}>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {productAllocation.product.name}
          </Text>
          {productAllocation.product.brand && (
            <Text style={styles.productBrand}>{productAllocation.product.brand}</Text>
          )}
          <Text style={styles.productQuantity}>
            {productAllocation.quantity} {productAllocation.unit}
          </Text>
        </View>
        <View style={styles.productPrices}>
          <Text style={styles.productUnitPrice}>
            ₺{productAllocation.pricePerUnit.toFixed(2)} / {productAllocation.unit}
          </Text>
          <Text style={styles.productTotalPrice}>
            ₺{productAllocation.totalPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: layout.screenPadding,
  },

  header: {
    backgroundColor: colors.background.paper,
    padding: layout.screenPadding,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  strategyType: {
    ...typography.styles.h3,
    color: colors.text.primary,
  },

  scoreBadge: {
    backgroundColor: colors.primary.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },

  scoreText: {
    ...typography.styles.body2,
    color: colors.background.paper,
    fontWeight: '600',
  },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  priceLabel: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  priceValue: {
    ...typography.styles.h2,
    color: colors.primary.main,
    fontWeight: '700',
  },

  budgetBadge: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },

  budgetWithin: {
    backgroundColor: colors.success.bg,
  },

  budgetOver: {
    backgroundColor: colors.warning.bg,
  },

  budgetText: {
    ...typography.styles.body2,
    fontWeight: '600',
    textAlign: 'center',
  },

  budgetWithinText: {
    color: colors.success.dark,
  },

  budgetOverText: {
    color: colors.warning.dark,
  },

  coverageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  coverageLabel: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },

  coverageValue: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
    fontWeight: '600',
  },

  section: {
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    ...typography.styles.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  storeHeaderLeft: {
    flex: 1,
  },

  storeNumber: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  storeSubtotal: {
    ...typography.styles.h3,
    color: colors.primary.main,
    fontWeight: '700',
  },

  productsList: {
    // gap replaced with marginBottom in render
  },

  productCard: {
    marginBottom: spacing.xs,
  },

  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  productInfo: {
    flex: 1,
    marginRight: spacing.md,
  },

  productName: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  productBrand: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  productQuantity: {
    ...typography.styles.body2,
    color: colors.text.hint,
  },

  productPrices: {
    alignItems: 'flex-end',
  },

  productUnitPrice: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  productTotalPrice: {
    ...typography.styles.subtitle1,
    color: colors.primary.main,
    fontWeight: '600',
  },

  missingCard: {
    backgroundColor: colors.warning.bg,
    marginBottom: spacing.sm,
  },

  missingProductName: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  missingQuantity: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },

  actions: {
    padding: layout.screenPadding,
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },

  buttonIcon: {
    fontSize: 18,
    marginRight: spacing.xs,
  },

  bottomSpacing: {
    height: spacing.xl,
  },
});

