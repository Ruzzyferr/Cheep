/**
 * 🎯 Deals Screen
 * Mağazalar arası en büyük fiyat farkına (tasarrufa) sahip ürünler.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useProductsList } from '../../queries';
import { ListSkeleton, RefreshBar, ErrorState } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { Product } from '../../types';
import type { DealsStackScreenProps } from '../../navigation/types';
import { useBottomSpacing, useTopSpacing } from '../../hooks/useScreenSpacing';
import { CheepBanner } from '../../components/ads/CheepBanner';
import { buildGridRows } from '../../utils/adRows';
import { usePremium } from '../../context/PremiumContext';
import { useAds } from '../../context/AdsContext';

interface Deal {
  product: Product;
  cheapestPrice: number;
  dearestPrice: number;
  savings: number;
  savingsPct: number;
  cheapestStore: string | null;
  storeCount: number;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function buildDeals(products: Product[]): Deal[] {
  const deals: Deal[] = [];
  for (const product of products) {
    const prices = (product.store_prices ?? [])
      .map((sp) => ({ price: parseFloat(sp.price), store: sp.store?.name ?? null }))
      .filter((p) => !Number.isNaN(p.price) && p.price > 0);
    if (prices.length < 2) continue;

    const sorted = [...prices].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0];
    // Reference = MEDIAN of all stores, not the max. A single inflated/wrong
    // listing (one market's outlier price) can no longer manufacture a huge
    // fake "saving"; a real sale corroborated by several stores still shows,
    // because the median then sits at the higher price.
    const reference = median(sorted.map((p) => p.price));
    const savings = reference - cheapest.price;
    if (savings <= 0) continue;

    deals.push({
      product,
      cheapestPrice: cheapest.price,
      dearestPrice: reference,
      savings,
      savingsPct: (savings / reference) * 100,
      cheapestStore: cheapest.store,
      storeCount: prices.length,
    });
  }
  return deals.sort((a, b) => b.savingsPct - a.savingsPct).slice(0, 40);
}

export function DealsScreen({ navigation }: DealsStackScreenProps<'DealsMain'>) {
  // headerShown:false — ust guvenli alani ekran kendisi birakmali.
  const topSpacing = useTopSpacing();
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  // Cache'li sorgu: ülke değişince key değiştiği için veri kendiliğinden
  // yenilenir; canlılık bayrağı (aliveRef) ve elle setState zinciri gerekmez.
  const productsQ = useProductsList({ limit: 200 });
  const deals = useMemo(() => buildDeals(productsQ.data ?? []), [productsQ.data]);

  const onRefresh = () => {
    void productsQ.refetch();
  };

  const openProduct = (productId: number) => {
    navigation.navigate('Home', { screen: 'ProductDetail', params: { productId } });
  };

  const renderDeal = ({ item }: { item: Deal }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => openProduct(item.product.id)}
      accessibilityRole="button"
      accessibilityLabel={t('deals.advantage_a11y', { name: item.product.name, percent: item.savingsPct.toFixed(0) })}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.product.name}
          </Text>
          {item.product.brand ? (
            <Text style={styles.brand}>{item.product.brand}</Text>
          ) : null}
        </View>
        <View style={styles.badge}>
          <MaterialIcons name="trending-down" size={14} color={colors.background.paper} />
          <Text style={styles.badgeText}>%{item.savingsPct.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.priceLabel}>
            {item.cheapestStore ? t('deals.cheapest_at', { store: item.cheapestStore }) : t('deals.cheapest')}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.cheapest}>{formatMoney(item.cheapestPrice)}</Text>
            <Text style={styles.dearest}>{formatMoney(item.dearestPrice)}</Text>
          </View>
        </View>
        <View style={styles.savingsBox}>
          <Text style={styles.savingsLabel}>{t('deals.savings')}</Text>
          <Text style={styles.savingsValue}>{formatMoney(item.savings)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const { isPremium } = usePremium();
  const { canRequestAds } = useAds();
  const dealRows = useMemo(
    () => buildGridRows(deals, 1, !isPremium && canRequestAds),
    [deals, isPremium, canRequestAds],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topSpacing }]}>
        <Text style={styles.title}>{t('deals.title')}</Text>
        <Text style={styles.subtitle}>{t('deals.subtitle')}</Text>
      </View>

      <RefreshBar visible={!productsQ.isPending && productsQ.isFetching && !productsQ.isRefetching} />

      {productsQ.isPending ? (
        <ListSkeleton count={6} />
      ) : productsQ.isError ? (
        <ErrorState onRetry={onRefresh} />
      ) : deals.length === 0 ? (
        <EmptyState
          mascot="search"
          title={t('deals.empty_title')}
          description={t('deals.empty_description')}
        />
      ) : (
        // TEK SÜTUNLU IZGARA — reklam ilk fırsattan SONRA bir satır olarak
        // giriyor (bkz. utils/adRows.ts). `ListHeaderComponent` kullanılmadı:
        // o, reklamı ilk fırsatın da ÜSTÜNE koyar ve ekranın verdiği cevabın
        // önüne geçerdi. Böyle, kullanıcı önce bir fırsat görüyor.
        <FlatList
          data={dealRows}
          keyExtractor={(row) => row.key}
          renderItem={({ item: row }) =>
            row.kind === 'ad' ? <CheepBanner slot="deals" /> : renderDeal({ item: row.items[0]! })
          }
          contentContainerStyle={[styles.list, { paddingBottom: bottomSpacing }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={productsQ.isRefetching} onRefresh={onRefresh} tintColor={colors.primary.main} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  header: {
    backgroundColor: colors.background.paper,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.styles.h1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: layout.screenPadding,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: layout.cardPadding,
    ...shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  productName: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
  },
  brand: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.styles.caption,
    fontWeight: '700',
    color: colors.background.paper,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  priceLabel: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  cheapest: {
    ...typography.styles.price,
    color: colors.primary.main,
  },
  dearest: {
    ...typography.styles.body2,
    color: colors.text.hint,
    textDecorationLine: 'line-through',
  },
  savingsBox: {
    alignItems: 'flex-end',
  },
  savingsLabel: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },
  savingsValue: {
    ...typography.styles.subtitle1,
    color: colors.success.dark,
  },
});
