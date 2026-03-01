/**
 * 🔍 Compare Results Screen
 * Shopping route comparison results
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listService } from '../../services';
import { Card } from '../../components/ui';
import { StoreChip } from '../../components/store/StoreChip';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import type { CompareResponse, RouteStrategy } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';

type StoreCountFilter = 'all' | '1' | '2' | '3+';
type SortOption = 'score' | 'price' | 'distance' | 'price_distance';

export function CompareResultsScreen({
  route,
  navigation,
}: ListsStackScreenProps<'CompareResults'>) {
  const { listId } = route.params;
  const [results, setResults] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeCountFilter, setStoreCountFilter] = useState<StoreCountFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('score');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    compareList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  const compareList = async () => {
    try {
      setLoading(true);
      const data = await listService.compareList(listId, {
        maxStores: 3,
        includeMissingProducts: true,
      });
      setResults(data);
    } catch (error) {
      console.error('Compare error:', error);
      Alert.alert('Hata', 'Karşılaştırma yapılırken bir hata oluştu');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Rotalar hesaplanıyor...</Text>
      </View>
    );
  }

  if (!results) {
    return null;
  }

  const { strategies, summary } = results;

  // Filtreleme ve sıralama
  let filteredStrategies = [...strategies];

  // Market sayısı filtresi
  if (storeCountFilter !== 'all') {
    if (storeCountFilter === '1') {
      filteredStrategies = filteredStrategies.filter(s => s.stores.length === 1);
    } else if (storeCountFilter === '2') {
      filteredStrategies = filteredStrategies.filter(s => s.stores.length === 2);
    } else if (storeCountFilter === '3+') {
      filteredStrategies = filteredStrategies.filter(s => s.stores.length >= 3);
    }
  }

  // Sıralama
  filteredStrategies.sort((a, b) => {
    switch (sortOption) {
      case 'price':
        return a.totalPrice - b.totalPrice;
      case 'distance':
        return a.totalDistance - b.totalDistance;
      case 'price_distance':
        // Önce fiyata göre, sonra mesafeye göre
        const priceDiff = a.totalPrice - b.totalPrice;
        if (Math.abs(priceDiff) < 10) { // 10 TL'den az fark varsa mesafeye bak
          return a.totalDistance - b.totalDistance;
        }
        return priceDiff;
      case 'score':
      default:
        return b.score - a.score;
    }
  });

  // En iyi rota: Sıralanmış listeden ilki
  const bestRoute = filteredStrategies[0] || null;
  const otherRoutes = filteredStrategies.slice(1);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
    >
      {/* Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.sectionTitle}>Filtreler</Text>
        
        {/* Market Sayısı Filtresi */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Market Sayısı</Text>
          <View style={styles.filterButtons}>
            {(['all', '1', '2', '3+'] as StoreCountFilter[]).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterButton,
                  storeCountFilter === filter && styles.filterButtonActive,
                ]}
                onPress={() => setStoreCountFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    storeCountFilter === filter && styles.filterButtonTextActive,
                  ]}
                >
                  {filter === 'all' ? 'Tümü' : filter === '1' ? 'Tek Market' : filter === '2' ? '2 Market' : '3+ Market'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sıralama */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Sıralama</Text>
          <View style={styles.filterButtons}>
            {([
              { value: 'score' as SortOption, label: 'Skor' },
              { value: 'price' as SortOption, label: 'Fiyat' },
              { value: 'distance' as SortOption, label: 'Konum' },
              { value: 'price_distance' as SortOption, label: 'Fiyat + Konum' },
            ]).map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterButton,
                  sortOption === option.value && styles.filterButtonActive,
                ]}
                onPress={() => setSortOption(option.value)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    sortOption === option.value && styles.filterButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Özet</Text>
        <View style={styles.summaryGrid}>
          {summary.cheapestOption && (
            <Card padding="md" style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>En Ucuz</Text>
              <Text style={styles.summaryCardValue}>
                ₺{summary.cheapestOption.totalPrice.toFixed(2)}
              </Text>
              <Text style={styles.summaryCardSubtext}>
                {summary.cheapestOption.stores.length} market
              </Text>
            </Card>
          )}
          {summary.closestOption && (
            <Card padding="md" style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>En Yakın</Text>
              <Text style={styles.summaryCardValue}>
                {summary.closestOption.totalDistance.toFixed(1)} km
              </Text>
              <Text style={styles.summaryCardSubtext}>
                ₺{summary.closestOption.totalPrice.toFixed(2)}
              </Text>
            </Card>
          )}
        </View>
        {summary.maxSavings > 0 && (
          <Card padding="md" style={styles.savingsCard}>
            <Text style={styles.savingsText}>
              Maksimum Tasarruf: ₺{summary.maxSavings.toFixed(2)}
            </Text>
          </Card>
        )}
      </View>

      {/* Best Route */}
      {bestRoute && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>En İyi Rota</Text>
          <RouteCard 
            route={bestRoute} 
            isBest 
            onPress={() => navigation.navigate('StrategyDetail', { 
              listId, 
              strategy: bestRoute 
            })}
          />
        </View>
      )}

      {/* Other Routes */}
      {otherRoutes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alternatif Rotalar</Text>
          {otherRoutes.map((strategy, index) => (
            <RouteCard 
              key={index} 
              route={strategy}
              onPress={() => navigation.navigate('StrategyDetail', { 
                listId, 
                strategy 
              })}
            />
          ))}
        </View>
      )}

      {/* Alternatives */}
      {results.alternatives && results.alternatives.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alternatif Ürünler</Text>
          {results.alternatives.map((alt, index) => (
            <Card key={index} padding="md" style={styles.alternativeCard}>
              <Text style={styles.alternativeTitle}>
                {alt.originalProduct.name} yerine
              </Text>
              <Text style={styles.alternativeProduct}>
                {alt.alternativeProduct.name}
              </Text>
              <View style={styles.alternativeInfo}>
                <Text style={styles.alternativeStore}>{alt.store.name}</Text>
                <Text style={styles.alternativeSavings}>
                  ₺{alt.savings.toFixed(2)} tasarruf
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* List Info */}
      <View style={styles.section}>
        <Card padding="md">
          <Text style={styles.summaryTitle}>Liste Bilgileri</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Liste:</Text>
            <Text style={styles.summaryValue}>{results.listName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Toplam Ürün:</Text>
            <Text style={styles.summaryValue}>{results.totalItems}</Text>
          </View>
          {results.budget && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bütçe:</Text>
              <Text style={styles.summaryValue}>
                ₺{parseFloat(results.budget.toString()).toFixed(2)}
              </Text>
            </View>
          )}
        </Card>
      </View>

    </ScrollView>
  );
}

// Route Card Component
function RouteCard({ 
  route, 
  isBest = false,
  onPress,
}: { 
  route: RouteStrategy; 
  isBest?: boolean;
  onPress?: () => void;
}) {
  const withinBudget = route.budgetStatus === 'within_budget';

  return (
    <Card 
      padding="md" 
      style={[styles.routeCard, isBest && styles.bestRoute].filter(Boolean) as any}
      onPress={onPress}
    >
      {/* Header */}
      <View style={styles.routeHeader}>
        <Text style={styles.routeType}>
          {route.type === 'single_store' ? 'Tek Market' : 'Çoklu Market'}
        </Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.score}>Skor: {route.score}/100</Text>
        </View>
      </View>

      {/* Stores */}
      <View style={styles.stores}>
        {route.stores.map((store, index) => (
          <StoreChip key={index} storeName={store.store.name} />
        ))}
      </View>

      {/* Info */}
      <View style={styles.routeInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Toplam Tutar:</Text>
          <Text style={styles.infoValue}>₺{route.totalPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Kapsama:</Text>
          <Text style={styles.infoValue}>{route.coveragePercentage.toFixed(0)}%</Text>
        </View>
        {route.totalDistance > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mesafe:</Text>
            <Text style={styles.infoValue}>{route.totalDistance.toFixed(1)} km</Text>
          </View>
        )}
      </View>

      {/* Budget Status */}
      {route.budgetStatus !== 'unknown' && (
        <View
          style={[
            styles.budgetStatus,
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
          </Text>
        </View>
      )}

      {/* Missing Products */}
      {route.missingProducts.length > 0 && (
        <View style={styles.missing}>
          <Text style={styles.missingText}>
            {route.missingProducts.length} ürün bulunamadı
          </Text>
        </View>
      )}

      {/* View Details Button */}
      {onPress && (
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>Detayları Gör →</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
  },

  loadingText: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },

  filtersSection: {
    padding: layout.screenPadding,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },

  filterGroup: {
    marginBottom: spacing.md,
  },

  filterLabel: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },

  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  filterButtonActive: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },

  filterButtonText: {
    ...typography.styles.body2,
    color: colors.text.primary,
  },

  filterButtonTextActive: {
    color: colors.background.paper,
    fontWeight: '600',
  },

  section: {
    padding: layout.screenPadding,
  },

  sectionTitle: {
    ...typography.styles.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  routeCard: {
    marginBottom: spacing.md,
  },

  bestRoute: {
    borderWidth: 1,
    borderColor: colors.primary.main,
    backgroundColor: colors.background.paper,
  },

  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  routeType: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
  },

  scoreContainer: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },

  score: {
    ...typography.styles.body2,
    color: colors.background.paper,
    fontWeight: '600',
  },

  stores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },

  routeInfo: {
    marginBottom: spacing.sm,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },

  infoLabel: {
    ...typography.styles.body2,
    color: colors.text.secondary,
  },

  infoValue: {
    ...typography.styles.subtitle2,
    color: colors.text.primary,
  },

  budgetStatus: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
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

  missing: {
    marginTop: spacing.sm,
  },

  missingText: {
    ...typography.styles.caption,
    color: colors.warning.main,
  },

  summaryTitle: {
    ...typography.styles.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  summaryLabel: {
    ...typography.styles.body1,
    color: colors.text.secondary,
  },

  summaryValue: {
    ...typography.styles.subtitle1,
    color: colors.text.primary,
  },

  savings: {
    color: colors.success.main,
  },

  summaryGrid: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },

  summaryCard: {
    flex: 1,
    alignItems: 'center',
    marginRight: spacing.md,
  },

  summaryCardTitle: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  summaryCardValue: {
    ...typography.styles.h3,
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  summaryCardSubtext: {
    ...typography.styles.caption,
    color: colors.text.hint,
    marginTop: spacing.xs,
  },

  savingsCard: {
    backgroundColor: colors.success.bg,
    borderWidth: 1,
    borderColor: colors.success.light,
  },

  savingsText: {
    ...typography.styles.body1,
    color: colors.success.dark,
    fontWeight: '600',
    textAlign: 'center',
  },

  alternativeCard: {
    marginBottom: spacing.sm,
  },

  alternativeTitle: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },

  alternativeProduct: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  alternativeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  alternativeStore: {
    ...typography.styles.caption,
    color: colors.text.secondary,
  },

  alternativeSavings: {
    ...typography.styles.body2,
    color: colors.success.main,
    fontWeight: '600',
  },

  viewDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    alignItems: 'center',
  },

  viewDetailsText: {
    ...typography.styles.body2,
    color: colors.primary.main,
    fontWeight: '600',
  },

  bottomSpacing: {
    height: spacing['2xl'],
  },
});

