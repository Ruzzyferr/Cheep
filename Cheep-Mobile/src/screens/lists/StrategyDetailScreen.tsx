/**
 * 📋 Strategy Detail Screen
 * Detailed view of a shopping strategy/route
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Card, Button } from '../../components/ui';
import { ProductThumb } from '../../components/product/ProductThumb';
import { StoreChip } from '../../components/store/StoreChip';
import { affiliateService } from '../../services';
import { openExternalUrl } from '../../utils/linking';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { StoreAllocation, ProductAllocation } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';
import { appAlert } from '../../utils/dialog';

// route.params üzerinden gelen sayısal alanlar null/string olabilir; .toFixed
// çağırmadan önce güvenli bir sayıya zorla (geçersizse 0).
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function StrategyDetailScreen({
  route,
}: ListsStackScreenProps<'StrategyDetail'>) {
  const { strategy, listId } = route.params;
  // `useTranslation` — modül düzeyindeki `i18n.t` DEĞİL. Bu ekran dil
  // değişikliğine abone olmadığı için, kullanıcı Profil'den dili
  // değiştirip geri geldiğinde eski dilde kalabiliyordu.
  const { t } = useTranslation();
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { formatMoney } = useLocale();

  const withinBudget = strategy.budgetStatus === 'within_budget';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
      >
        {/* Header Info */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.strategyType}>
              {strategy.type === 'single_store' ? t('compare.single_store') : t('compare.multi_store')}
            </Text>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{t('compare.score', { score: num(strategy.score) })}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>{t('compare.total_amount_label')}</Text>
              <Text style={styles.priceValue}>{formatMoney(num(strategy.totalPrice))}</Text>
            </View>
            {num(strategy.totalDistance) > 0 && (
              <View>
                <Text style={styles.priceLabel}>{t('compare.total_distance_label')}</Text>
                <Text style={styles.priceValue}>{num(strategy.totalDistance).toFixed(1)} km</Text>
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
                {withinBudget ? t('compare.within_budget') : t('compare.over_budget')}
                {strategy.budgetRemaining !== null && (
                  <Text>
                    {' '}
                    ({withinBudget ? '+' : ''}{formatMoney(num(strategy.budgetRemaining))})
                  </Text>
                )}
              </Text>
            </View>
          )}

          {/* Coverage — net görsel durum */}
          {(() => {
            const missing = strategy.missingProducts.length;
            const full = missing === 0;
            return (
              <View style={[styles.covBadge, full ? styles.covFull : styles.covPartial]}>
                <MaterialIcons
                  name={full ? 'check-circle' : 'error-outline'}
                  size={16}
                  color={full ? colors.success.dark : colors.warning.dark}
                />
                <Text style={[styles.covText, full ? styles.covTextFull : styles.covTextPartial]}>
                  {full ? t('compare.all_in_route') : t('compare.missing_in_route', { n: missing })}
                </Text>
                <Text style={[styles.covPct, full ? styles.covTextFull : styles.covTextPartial]}>
                  %{num(strategy.coveragePercentage)}
                </Text>
              </View>
            );
          })()}
        </View>

        {/* Stores */}
        {strategy.stores.map((storeAllocation, storeIndex) => (
          <StoreSection
            key={storeIndex}
            storeAllocation={storeAllocation}
            storeIndex={storeIndex}
            totalStores={strategy.stores.length}
            listId={listId}
          />
        ))}

        {/* Missing Products */}
        {strategy.missingProducts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('compare.missing_products')}</Text>
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
    </View>
  );
}

// Store Section Component
function StoreSection({
  storeAllocation,
  storeIndex,
  totalStores,
  listId,
}: {
  storeAllocation: StoreAllocation;
  storeIndex: number;
  totalStores: number;
  listId: number;
}) {
  const [opening, setOpening] = useState(false);
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  const storeName = storeAllocation.store.name;

  const handleCompleteAtStore = async () => {
    setOpening(true);
    try {
      const res = await affiliateService.trackClick({
        storeId: storeAllocation.store.id,
        listId,
        context: 'cart',
      });
      await openExternalUrl(res.url);
    } catch {
      appAlert(t('common.error'), t('compare.store_link_error'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.storeHeader}>
        <View style={styles.storeHeaderLeft}>
          <Text style={styles.storeNumber}>
            {totalStores > 1 ? `Market ${storeIndex + 1}` : 'Market'}
          </Text>
          <StoreChip storeName={storeName} />
        </View>
        <Text style={styles.storeSubtotal}>
          {formatMoney(num(storeAllocation.subtotal))}
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

      {/* Affiliate: sepeti bu markette tamamla */}
      <Button
        title={`Sepeti ${storeName}'te tamamla`}
        onPress={handleCompleteAtStore}
        loading={opening}
        variant="outline"
        size="small"
        fullWidth
        style={styles.completeButton}
        icon={
          <MaterialIcons
            name="open-in-new"
            size={16}
            color={colors.primary.main}
            style={styles.completeIcon}
          />
        }
      />
    </View>
  );
}

// Product Row Component
function ProductRow({ productAllocation }: { productAllocation: ProductAllocation }) {
  const { formatMoney } = useLocale();
  const { product, quantity, unit } = productAllocation;
  const displayName = product.brand
    ? `${product.brand} · ${product.name}`
    : product.name;

  return (
    <Card padding="sm" style={styles.productCard}>
      <View style={styles.productRow}>
        {/* Thumbnail — ürünü gözle tanımak market sırasını takip etmeyi kolaylaştırır */}
        <View style={styles.thumb}>
          <ProductThumb imageUrl={product.image_url} iconSize={22} />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.productQuantity}>
            {quantity} {unit}
          </Text>
        </View>
        <View style={styles.productPrices}>
          <Text style={styles.productUnitPrice}>
            {formatMoney(num(productAllocation.pricePerUnit))} / {productAllocation.unit}
          </Text>
          <Text style={styles.productTotalPrice}>
            {formatMoney(num(productAllocation.totalPrice))}
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

  covBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },

  covFull: {
    backgroundColor: colors.success.bg,
  },

  covPartial: {
    backgroundColor: colors.warning.bg,
  },

  covText: {
    ...typography.styles.body2,
    fontWeight: '600',
    flex: 1,
  },

  covPct: {
    ...typography.styles.body2,
    fontWeight: '700',
  },

  covTextFull: {
    color: colors.success.dark,
  },

  covTextPartial: {
    color: colors.warning.dark,
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

  completeButton: {
    marginTop: spacing.sm,
    borderColor: colors.primary.main,
  },

  completeIcon: {
    marginRight: spacing.xs,
  },

  productCard: {
    marginBottom: spacing.xs,
  },

  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  thumb: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: spacing.sm,
  },

  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
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

  bottomSpacing: {
    height: spacing.xl,
  },
});

