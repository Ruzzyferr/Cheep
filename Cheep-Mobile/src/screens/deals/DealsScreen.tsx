/**
 * 🎯 Deals Screen
 * Mağazalar arası en büyük fiyat farkına (tasarrufa) sahip ürünler.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { productService } from '../../services';
import { EmptyState } from '../../components/common/EmptyState';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import type { Product } from '../../types';
import type { DealsStackScreenProps } from '../../navigation/types';

interface Deal {
  product: Product;
  cheapestPrice: number;
  dearestPrice: number;
  savings: number;
  savingsPct: number;
  cheapestStore: string | null;
  storeCount: number;
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
    const dearest = sorted[sorted.length - 1];
    const savings = dearest.price - cheapest.price;
    if (savings <= 0) continue;

    deals.push({
      product,
      cheapestPrice: cheapest.price,
      dearestPrice: dearest.price,
      savings,
      savingsPct: (savings / dearest.price) * 100,
      cheapestStore: cheapest.store,
      storeCount: prices.length,
    });
  }
  return deals.sort((a, b) => b.savingsPct - a.savingsPct).slice(0, 40);
}

export function DealsScreen({ navigation }: DealsStackScreenProps<'DealsMain'>) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const products = await productService.getProducts({ limit: 200 });
      setDeals(buildDeals(products));
    } catch (error) {
      console.warn('Deals load error:', error);
      setDeals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openProduct = (productId: number) => {
    navigation.navigate('Home', { screen: 'ProductDetail', params: { productId } });
  };

  const renderDeal = ({ item }: { item: Deal }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => openProduct(item.product.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.product.name}, %${item.savingsPct.toFixed(0)} avantaj`}
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
            {item.cheapestStore ? `En ucuz · ${item.cheapestStore}` : 'En ucuz'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.cheapest}>₺{item.cheapestPrice.toFixed(2)}</Text>
            <Text style={styles.dearest}>₺{item.dearestPrice.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.savingsBox}>
          <Text style={styles.savingsLabel}>Tasarruf</Text>
          <Text style={styles.savingsValue}>₺{item.savings.toFixed(2)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fırsatlar</Text>
        <Text style={styles.subtitle}>Marketler arası en yüksek tasarruflar</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : deals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="Henüz fırsat yok"
          description="Birden fazla markette satılan ürünler eklendikçe en iyi tasarruflar burada görünecek"
        />
      ) : (
        <FlatList
          data={deals}
          keyExtractor={(item) => String(item.product.id)}
          renderItem={renderDeal}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.main} />
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
    paddingTop: spacing.xl,
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
