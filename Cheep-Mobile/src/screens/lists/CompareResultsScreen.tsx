/**
 * 🔍 Compare Results Screen
 * Shopping route comparison results
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useCompareList } from '../../queries';
import { Card } from '../../components/ui';
import { StoreChip } from '../../components/store/StoreChip';
import { useLocale } from '../../context/LocaleContext';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import { compareInsights, rankStrategies, missingCount } from '../../utils/compareInsights';
import { useLocationAnchor } from '../../context/LocationContext';
import { shouldFilterByDistance, RADIUS_OPTIONS, DEFAULT_RADIUS_KM } from '../../utils/anchor';
import type { RouteStrategy } from '../../types';
import type { ListsStackScreenProps } from '../../navigation/types';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';
import { appAlert } from '../../utils/dialog';

type StoreCountFilter = 'all' | '1' | '2' | '3+';
type SortOption = 'score' | 'price' | 'distance' | 'price_distance';

// Yarıçap seçenekleri utils/anchor'dan gelir (RADIUS_OPTIONS / DEFAULT_RADIUS_KM /
// MAX_RADIUS_KM). Burada YENİDEN TANIMLANMAZ: şube kapısı (geocode.service) aynı
// listeden türeyen MAX_RADIUS_KM'yi kullanıyor — iki taraf ayrı düşerse, kapının
// "kullanılabilir" dediği bir koordinat bu ekranda boş sonuç üretebilir.

export function CompareResultsScreen({
  route,
  navigation,
}: ListsStackScreenProps<'CompareResults'>) {
  const { listId } = route.params;
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  const [storeCountFilter, setStoreCountFilter] = useState<StoreCountFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('score');
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();

  const { anchor } = useLocationAnchor();
  const { country } = useLocale(); // (useLocale zaten import edilmiş — formatMoney için)

  // MERKEZÎ İNVARYANT: yarıçap filtresi yalnızca çapa koordinatlıysa VE katalogla
  // aynı ülkedeyse gönderilir. Aksi halde userLocation/radiusKm HİÇ gönderilmez →
  // backend filtre uygulamaz → kullanıcı tüm marketleri görür (boş ekran yerine).
  const filterByDistance = anchor ? shouldFilterByDistance(anchor, country) : false;

  // İlk çözümleme tamamlandı mı? Effect, çapa null olduğu sürece bekler.
  const anchorReady = anchor != null;

  // Çapa nesnesi HER tazelemede yeniden yaratılıyor (resolvedAt: Date.now()), bu
  // yüzden referansına bağlanmak yanlış: kullanıcı uygulamayı arka plana alıp geri
  // açtığında konum hiç değişmemişken compare'i baştan çağırır (boş ağ isteği +
  // spinner çakması). Yalnızca gerçekten önemli olan DEĞERLERE bağlan.
  const userLocation = useMemo(
    () => (filterByDistance && anchor?.coords ? anchor.coords : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterByDistance, anchor?.coords?.lat, anchor?.coords?.lon],
  );

  /**
   * Karşılaştırma sonucu.
   *
   * Sorgu key'i çapa ve yarıçapı içerdiği için ikisi değişince kendiliğinden
   * yeniden çalışır; elle `alive` bayrağı ve efekt zinciri gerekmez.
   *
   * ASIL KAZANÇ ÇAPRAZ EKRAN: liste mutasyonları `['lists']` önekini
   * geçersizleştiriyor ve bu sorgu o önekte. Kullanıcı başka bir ekranda
   * listeye ürün ekleyip buraya döndüğünde sonuç artık bayat kalmıyor —
   * eskiden eklenen ürün karşılaştırmaya hiç yansımıyordu.
   */
  const compareQ = useCompareList(anchorReady ? listId : undefined, {
    maxStores: 4,
    includeMissingProducts: true,
    ...(userLocation ? { userLocation, radiusKm } : {}),
  });

  const results = compareQ.data ?? null;
  const loading = compareQ.isPending || compareQ.isFetching;

  // Liste karşılaştırılamıyorsa geri dön — AMA yalnızca kalıcı hatada.
      // AĞ HATASINDA EKRANDAN ATMA.
      //
      // Eskiden her hata "uyar ve geri dön"dü. İki ayrı sorun:
      // ① Ağ hatası ile "liste silinmiş" aynı muameleyi görüyordu; metroda
      //    listesine dokunan kullanıcı hata kutusu görüp listeler ekranına
      //    fırlatılıyordu, YENİDEN DENE düğmesi yoktu.
      // ② `goBack()` odak kontrolü olmadan çağrılıyordu: kullanıcı bu arada
      //    bir ürüne girdiyse ÜRÜN DETAYI kapanıyor ve hata kutusu okumakta
      //    olduğu ürünün üstünde açılıyordu.
      // Artık yalnızca sunucu gerçekten "yok/erişemezsin" dediğinde çıkılıyor
      // ve yalnızca ekran odaktayken.
  useEffect(() => {
    if (!compareQ.isError) return;
    const e = compareQ.error as { code?: string; status?: number } | null;
    const isNetwork = e?.code === 'NETWORK_ERROR' || e?.status == null;
    if (isNetwork) return; // ekranda kal; aşağıdaki "yeniden dene" gösterilir
    if (!navigation.isFocused()) return;
    appAlert(t('common.error'), t('compare.load_error'));
    navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareQ.isError]);

  // Ağ hatası + elde sonuç yok → yeniden denenebilir hata ekranı.
  if (compareQ.isError && !results && !loading) {
    return (
      <View style={styles.retryWrap}>
        <Text style={styles.retryTitle}>{t('common.error_loading')}</Text>
        <Pressable
          onPress={() => compareQ.refetch()}
          accessibilityRole="button"
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // İlk yükleme: sonuç yokken tam ekran spinner. Yarıçap değişiminde eski sonuçlar
  // ekranda kalır (seçici kaybolmasın), üstte ince bir gösterge çıkar.
  if (loading && !results) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>{t('compare.loading')}</Text>
      </View>
    );
  }

  if (!results) {
    return null;
  }

  const hasLocation = filterByDistance;
  // Konum var, yarıçap filtresi uygulandı ama yakında market yok → boş durum.
  const noNearbyStores =
    hasLocation && !!results.nearbyFilterApplied && results.strategies.length === 0;

  const { strategies } = results;

  // Gerçek şube mesafesi olan rota var mı? (store_branches boşken tüm mesafeler 0 =
  // bilinmiyor.) Yoksa mesafe satırlarını ve mesafe sıralamalarını gizleriz.
  const hasRealDistance = strategies.some((s) => s.totalDistance > 0);

  // Kapsama-bilinçli özet: fiyatlar yalnızca AYNI ürünleri kapsayan rotalar
  // arasında karşılaştırılabilir (eksik ürünlü ucuz rota yanıltıcıdır).
  const insights = compareInsights(strategies);
  const totalItems = results.totalItems;

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

  // Sıralama rankStrategies'te ve testli: kademe TAM/EKSİK sepet ayrımı (ekranın
  // gösterdiği ayrımın aynısı), tam sepetler arasında kullanıcının gördüğü
  // ölçüt tek belirleyici. Gerekçesi compareInsights.ts'te.
  filteredStrategies = rankStrategies(filteredStrategies, sortOption);

  // En iyi rota: Sıralanmış listeden ilki
  const bestRoute = filteredStrategies[0] || null;
  const otherRoutes = filteredStrategies.slice(1);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: bottomSpacing }}
    >
      {/* Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.sectionTitle}>{t('compare.filters_title')}</Text>

        {/* Yarıçap Filtresi — yalnızca konum varsa. Kimse market için uzağa gitmez;
            kullanıcı yürüme/araba/geniş mesafeyi seçer, dışındaki marketler gizlenir. */}
        {hasLocation && (
          <View style={styles.filterGroup}>
            <View style={styles.filterLabelRow}>
              <Text style={styles.filterLabel}>{t('compare.radius_filter')}</Text>
              {loading && (
                <ActivityIndicator size="small" color={colors.primary.main} />
              )}
            </View>
            <View style={styles.filterButtons}>
              {RADIUS_OPTIONS.map((km) => (
                <TouchableOpacity
                  key={km}
                  style={[
                    styles.filterButton,
                    radiusKm === km && styles.filterButtonActive,
                  ]}
                  onPress={() => setRadiusKm(km)}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      radiusKm === km && styles.filterButtonTextActive,
                    ]}
                  >
                    {t(`compare.radius.${km === 1.5 ? 'walk' : km === 3 ? 'car' : 'wide'}`, {
                      km,
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Market Sayısı Filtresi */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>{t('compare.store_count_filter')}</Text>
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
                  {filter === 'all'
                    ? t('common.all')
                    : filter === '1'
                    ? t('compare.store_count.one')
                    : filter === '2'
                    ? t('compare.store_count.two')
                    : t('compare.store_count.three_plus')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sıralama */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>{t('compare.sort_title')}</Text>
          <View style={styles.filterButtons}>
            {([
              { value: 'score' as SortOption, label: t('compare.sort.recommended') },
              { value: 'price' as SortOption, label: t('compare.sort.cheapest') },
              // Mesafe sıralamaları yalnızca GERÇEK şube mesafesi olan rota varsa gösterilir
              // (şube konum verisi gelene kadar sahte mesafe göstermeyiz).
              ...(hasRealDistance
                ? [
                    { value: 'distance' as SortOption, label: t('compare.sort.nearest') },
                    { value: 'price_distance' as SortOption, label: t('compare.sort.price_distance') },
                  ]
                : []),
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

      {noNearbyStores ? (
        <View style={styles.section}>
          <View style={styles.emptyNearby}>
            <MaterialIcons
              name="location-off"
              size={44}
              color={colors.text.secondary}
            />
            <Text style={styles.emptyNearbyTitle}>{t('compare.no_nearby_title')}</Text>
            <Text style={styles.emptyNearbyText}>
              {t('compare.no_nearby_text', { km: radiusKm })}
            </Text>
          </View>
        </View>
      ) : (
      <>
      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('compare.summary_title')}</Text>
        <View style={styles.summaryGrid}>
          {insights.cheapest && (
            <Card padding="md" style={styles.summaryCard}>
              <Text style={styles.summaryCardTitle}>
                {insights.allComplete ? t('compare.cheapest_full') : t('compare.cheapest')}
              </Text>
              <Text style={styles.summaryCardValue}>
                {formatMoney(insights.cheapest.totalPrice)}
              </Text>
              <Text
                style={[
                  styles.summaryCardSubtext,
                  !insights.allComplete && styles.summaryCardSubtextWarn,
                ]}
              >
                {insights.allComplete
                  ? t('compare.cheapest_meta_full', { stores: insights.cheapest.stores.length, items: totalItems })
                  : t('compare.cheapest_meta_partial', {
                      missing: missingCount(insights.cheapest),
                      coverage: insights.cheapest.coveragePercentage,
                    })}
              </Text>
            </Card>
          )}
          <Card padding="md" style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>{t('compare.savings')}</Text>
            <Text style={[styles.summaryCardValue, styles.savingsValue]}>
              {formatMoney(insights.savings)}
            </Text>
            <Text style={styles.summaryCardSubtext}>
              {insights.savings > 0
                ? t('compare.savings_vs_priciest', { percent: insights.savingsPct })
                : t('compare.savings_single_option')}
            </Text>
          </Card>
        </View>
        {/* Kapsama açıklaması — kullanıcı neyi karşılaştırdığını net görsün */}
        <View style={styles.coverageHint}>
          <MaterialIcons
            name={insights.allComplete ? 'check-circle' : 'info-outline'}
            size={15}
            color={insights.allComplete ? colors.success.main : colors.warning.main}
          />
          <Text style={styles.coverageHintText}>
            {insights.allComplete
              ? t('compare.coverage_full', { items: totalItems })
              : t('compare.coverage_partial', { coverage: insights.cheapest?.coveragePercentage ?? 0 })}
          </Text>
        </View>
      </View>

      {/* Best Route */}
      {bestRoute && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('compare.best_route_title')}</Text>
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
          <Text style={styles.sectionTitle}>{t('compare.alt_routes_title')}</Text>
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
          <Text style={styles.sectionTitle}>{t('compare.alt_products_title')}</Text>
          {results.alternatives.map((alt, index) => (
            <Card key={index} padding="md" style={styles.alternativeCard}>
              <Text style={styles.alternativeTitle}>
                {t('compare.instead_of', { product: alt.originalProduct.name })}
              </Text>
              <Text style={styles.alternativeProduct}>
                {alt.alternativeProduct.name}
              </Text>
              <View style={styles.alternativeInfo}>
                <Text style={styles.alternativeStore}>{alt.store.name}</Text>
                <Text style={styles.alternativeSavings}>
                  {t('compare.alt_savings', { amount: formatMoney(alt.savings) })}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* List Info */}
      <View style={styles.section}>
        <Card padding="md">
          <Text style={styles.summaryTitle}>{t('compare.list_info_title')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('compare.list_label')}</Text>
            <Text style={styles.summaryValue}>{results.listName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('compare.total_items_label')}</Text>
            <Text style={styles.summaryValue}>{results.totalItems}</Text>
          </View>
          {results.budget && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('list.budget_display')}</Text>
              <Text style={styles.summaryValue}>
                {formatMoney(parseFloat(results.budget.toString()))}
              </Text>
            </View>
          )}
        </Card>
      </View>
      </>
      )}

    </ScrollView>
  );
}

// Coverage Badge — net görsel: tüm ürünler var (yeşil) / N ürün eksik (amber)
function CoverageBadge({ route }: { route: RouteStrategy }) {
  const { t } = useTranslation();
  const missing = missingCount(route);
  const full = missing === 0;
  return (
    <View style={[styles.covBadge, full ? styles.covFull : styles.covPartial]}>
      <MaterialIcons
        name={full ? 'check-circle' : 'error-outline'}
        size={16}
        color={full ? colors.success.dark : colors.warning.dark}
      />
      <Text style={[styles.covText, full ? styles.covTextFull : styles.covTextPartial]}>
        {full ? t('compare.coverage_badge_full') : t('compare.coverage_badge_partial', { count: missing })}
      </Text>
      <Text style={[styles.covPct, full ? styles.covTextFull : styles.covTextPartial]}>
        %{route.coveragePercentage.toFixed(0)}
      </Text>
    </View>
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
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  const withinBudget = route.budgetStatus === 'within_budget';

  return (
    <Card
      padding="md"
      style={[styles.routeCard, isBest && styles.bestRoute].filter(Boolean) as any}
      onPress={onPress}
    >
      {/* Best badge */}
      {isBest && (
        <View style={styles.bestBadge}>
          <MaterialIcons name="star" size={13} color={colors.background.paper} />
          <Text style={styles.bestBadgeText}>{t('compare.recommended_route_badge')}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.routeHeader}>
        <Text style={styles.routeType}>
          {route.type === 'single_store' ? t('compare.route_type.single') : t('compare.route_type.multi')}
        </Text>
        <View style={styles.scoreContainer}>
          <Text style={styles.score}>{t('compare.score', { score: route.score })}</Text>
        </View>
      </View>

      {/* Stores */}
      <View style={styles.stores}>
        {route.stores.map((store, index) => (
          <StoreChip key={index} storeName={store.store.name} />
        ))}
      </View>

      {/* Kapsama — kartın en görünür bilgisi: tüm ürünler var mı, yoksa kaç eksik? */}
      <CoverageBadge route={route} />

      {/* Info */}
      <View style={styles.routeInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('compare.total_amount_label')}</Text>
          <Text style={styles.infoValue}>{formatMoney(route.totalPrice)}</Text>
        </View>
        {route.totalDistance > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('compare.distance_label')}</Text>
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
            {withinBudget ? t('compare.within_budget') : t('compare.over_budget')}
          </Text>
        </View>
      )}

      {/* View Details Button */}
      {onPress && (
        <View style={styles.viewDetails}>
          <Text style={styles.viewDetailsText}>{t('compare.view_details')}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  retryWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background.default,
  },
  retryTitle: { ...typography.styles.body1, color: colors.text.secondary, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.primary.main,
  },
  retryText: { ...typography.styles.subtitle2, color: '#FFFFFF' },

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

  filterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },

  emptyNearby: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },

  emptyNearbyTitle: {
    ...typography.styles.h4,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
  },

  emptyNearbyText: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
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
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    backgroundColor: colors.background.paper,
    ...shadows.md,
  },

  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },

  bestBadgeText: {
    ...typography.styles.caption,
    color: colors.background.paper,
    fontWeight: '700',
    fontSize: 11,
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
    textAlign: 'center',
  },

  summaryCardSubtextWarn: {
    color: colors.warning.dark,
    fontWeight: '600',
  },

  savingsValue: {
    color: colors.success.main,
  },

  coverageHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  coverageHintText: {
    ...typography.styles.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 16,
  },

  // Coverage badge (route cards)
  covBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
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

