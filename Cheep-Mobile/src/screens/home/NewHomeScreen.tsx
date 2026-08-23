/**
 * 🏠 Home — "Fresh Market" flagship
 * Cream canvas · forest savings hero · mascot · premium animated cards.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { listService } from '../../services';
import {
  useActiveList,
  useCompareList,
  useLists,
  useParentCategories,
  useProductsList,
  useStores,
  useUnreadCount,
} from '../../queries';
import { useMonthlySavings } from './useMonthlySavings';
import { HomeSkeleton, RefreshBar, ErrorState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useLocationAnchor } from '../../context/LocationContext';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { LocationSheet } from '../../components/location/LocationSheet';
import { CountryChangedBanner } from '../../components/location/CountryChangedBanner';
import { FadeInUp, AnimatedNumber, PressableScale, Float } from '../../components/anim';
import { getStoreLogoAsset } from '../../utils/storeLogo';
import { ProductThumb } from '../../components/product/ProductThumb';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { compareInsights, byCoverageThenScore } from '../../utils/compareInsights';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Product } from '../../types';
import type { HomeStackScreenProps } from '../../navigation/types';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';

export function NewHomeScreen({ navigation }: HomeStackScreenProps<'HomeMain'>) {
  // Tab bar float: alt bosluk 72 + guvenli alan olmadan son ogeler cubugun arkasinda kalir.
  const bottomSpacing = useBottomSpacing();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { country, formatMoney } = useLocale();
  const { anchor } = useLocationAnchor();
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // ——— Veri ———
  // Hepsi cache'li sorgu. Ekrana dönüldüğünde bayat olanlar arka planda
  // tazelenir ve listeye ürün eklendiğinde mutasyon `['lists']` önekini
  // geçersizleştirdiği için aktif liste ile karşılaştırma KENDİLİĞİNDEN
  // güncellenir. Eskiden hepsi tek bir loadData() içindeydi ve yalnızca
  // mount'ta çalışıyordu; kullanıcı elle aşağı çekip yenilemek zorundaydı.
  const activeListQ = useActiveList();
  const productsQ = useProductsList({ limit: 100 });
  const storesQ = useStores();
  const categoriesQ = useParentCategories();
  const unreadQ = useUnreadCount();

  const activeList = activeListQ.data ?? null;
  const markets = storesQ.data ?? [];
  // Sıra ve seçim API'den gelir. Eskiden burada elle yazılmış bir öncelik
  // listesi (`HOME_PRIORITY`) ilk 7'yi seçiyordu; listenin ilk sırası ürünü
  // olmayan ölü bir kategoriye denk geldiği için kullanıcı boş ekran görüyordu.
  const categories = categoriesQ.data ?? [];
  const unreadCount = unreadQ.data ?? 0;

  /** Marketler arası farkı en büyük olan ürünler — "Akıllı Fırsatlar" rayı. */
  const featuredProducts = useMemo(() => {
    const median = (nums: number[]) => {
      const sorted = [...nums].sort((a, b) => a - b);
      const m = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
    };
    return (productsQ.data ?? [])
      .map((product) => ({
        product,
        prices: (product.store_prices ?? [])
          .map((sp) => parseFloat(sp.price))
          .filter((n) => Number.isFinite(n)),
      }))
      .filter(({ prices }) => prices.length >= 2)
      .map(({ product, prices }) => {
        const minPrice = Math.min(...prices);
        const reference = median(prices);
        return {
          ...product,
          priceDifference: Math.max(0, reference - minPrice),
          minPrice,
          maxPrice: reference,
        };
      })
      .sort((a, b) => b.priceDifference - a.priceDifference);
  }, [productsQ.data]);

  // Aktif listenin en ucuz rotası. Liste boşsa hiç sorulmaz.
  const hasItems = (activeList?.list_items?.length ?? 0) > 0;
  const compareQ = useCompareList(hasItems ? activeList?.id : undefined, {
    maxStores: 3,
    includeMissingProducts: true,
  });

  const insights = useMemo(
    () => (compareQ.data ? compareInsights(compareQ.data.strategies) : null),
    [compareQ.data],
  );

  const estimatedPrice =
    insights?.cheapest ? { min: Math.round(insights.min), max: Math.round(insights.max) } : null;
  const savingsPercent = insights && insights.savingsPct > 0 ? insights.savingsPct : undefined;
  const potentialSavings = insights ? Math.round(insights.savings) : 0;

  const listStoreNames = useMemo(() => {
    if (!compareQ.data) return [];
    const best = [...compareQ.data.strategies].sort(byCoverageThenScore)[0];
    if (!best) return [];
    const seen = new Set<number>();
    const names: string[] = [];
    for (const sa of best.stores) {
      if (seen.has(sa.store.id)) continue;
      seen.add(sa.store.id);
      if (sa.store.name) names.push(sa.store.name);
    }
    return names;
  }, [compareQ.data]);

  const monthlyQ = useMonthlySavings();
  const monthlySavings = monthlyQ.data?.total ?? 0;
  const monthlySavingsIncrease = monthlyQ.data?.increase ?? 0;

  // İlk yükleme: temel bloklar gelene kadar iskelet. Eskiden bu ekran
  // `loading` state'ini tutuyor ama HİÇBİR YERDE render etmiyordu; kullanıcı
  // yükleme boyunca boş bir kabuğa bakıyordu.
  const isPending = activeListQ.isPending || productsQ.isPending || categoriesQ.isPending;
  // Ekranı boşaltmayan arka plan tazelemesi göstergesi.
  const isBackgroundFetching =
    !isPending &&
    (activeListQ.isFetching || productsQ.isFetching || categoriesQ.isFetching || compareQ.isFetching);
  // Hata durumu yalnızca HİÇBİR temel blok gelmediyse; biri geldiyse
  // kullanıcıya elimizdekini gösteririz.
  const isError = activeListQ.isError && productsQ.isError && categoriesQ.isError;
  const refreshing = activeListQ.isRefetching || productsQ.isRefetching;

  const handleRefresh = () => {
    void Promise.all([
      activeListQ.refetch(),
      productsQ.refetch(),
      storesQ.refetch(),
      categoriesQ.refetch(),
      unreadQ.refetch(),
      compareQ.refetch(),
      monthlyQ.refetch(),
    ]);
  };

  const getLowestPrice = (product: Product) => {
    const prices = (product.store_prices ?? [])
      .map((sp) => parseFloat(sp.price))
      .filter((p) => Number.isFinite(p));
    if (prices.length === 0) return null;
    return Math.min(...prices).toFixed(2);
  };

  const getStoreName = (product: Product) => {
    if (!product.store_prices?.length) return '';
    const lowest = product.store_prices.reduce((prev, curr) =>
      parseFloat(prev.price) < parseFloat(curr.price) ? prev : curr
    );
    return lowest.store?.name || '';
  };

  const getDiscountPercent = (product: Product & { priceDifference?: number; maxPrice?: number }) => {
    if (!product.maxPrice || product.maxPrice === 0) return 0;
    const diff = product.priceDifference ?? 0;
    return Math.round((diff / product.maxPrice) * 100);
  };

  const firstName = (user?.name || '').trim().split(' ')[0];
  const hasSavings = monthlySavings > 0;
  const itemCount = activeList?.list_items?.length ?? 0;

  const goActiveList = () => {
    if (!activeList) return;
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Lists',
        params: { screen: 'ListDetail', params: { listId: activeList.id } },
      })
    );
  };
  const goLists = () => navigation.dispatch(CommonActions.navigate({ name: 'Lists' }));
  const goSearch = () => navigation.navigate('Search');
  const goAllProducts = () => navigation.navigate('CategoryProducts', { categoryId: 0, categoryName: t('product.all_categories') });

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary.main} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <CheepMascot size={34} shadow={false} />
            <Text style={styles.wordmark}>Cheep</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={goSearch} activeOpacity={0.7}>
              <MaterialIcons name="search" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="notifications-none" size={22} color={colors.text.primary} />
              {/* Rozet artık GERÇEK okunmamış sayısını yansıtır; yoksa hiç çizilmez.
                  Önceden sabit bir nokta duruyordu ve buton hiçbir şey yapmıyordu. */}
              {unreadCount > 0 && <View style={styles.dot} />}
            </TouchableOpacity>
          </View>
        </View>

        <CountryChangedBanner />

        {/* Arka plan tazelemesi: ekran boşalmaz, üstte ince bir çizgi belirir. */}
        <RefreshBar visible={isBackgroundFetching} />

        {/* Sabit çapa çipi — yalnızca kullanıcı manuel bir adres seçtiyse görünür. */}
        {anchor?.mode === 'pinned' && (
          <TouchableOpacity
            style={styles.anchorChip}
            onPress={() => setLocationSheetOpen(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="push-pin" size={14} color={colors.primary.main} />
            <Text style={styles.anchorChipText}>
              {t('location.chip_pinned', { label: anchor.label })}
            </Text>
            {!anchor.coords && (
              <Text style={styles.anchorChipMuted}>· {t('location.distances_off')}</Text>
            )}
          </TouchableOpacity>
        )}

        {isError ? (
          <ErrorState onRetry={handleRefresh} />
        ) : isPending ? (
          <HomeSkeleton />
        ) : (
        <>
        {/* Savings hero (signature) */}
        <FadeInUp delay={40} style={styles.sectionPad}>
          <View style={styles.hero}>
            <View style={styles.heroBody}>
              <Text style={styles.heroGreeting}>
                {firstName ? t('home.greeting_named', { name: firstName }) : t('home.greeting')} 👋
              </Text>
              <Text style={styles.heroOverline}>
                {hasSavings ? t('home.overline_saved') : t('home.overline_potential')}
              </Text>
              <AnimatedNumber
                value={hasSavings ? monthlySavings : potentialSavings}
                format={formatMoney}
                style={styles.heroNumber}
              />
              <Text style={styles.heroSub}>
                {hasSavings
                  ? monthlySavingsIncrease > 0
                    ? t('home.vs_last_month', { amount: formatMoney(monthlySavingsIncrease) })
                    : t('home.hero_sub_saved')
                  : activeList
                    ? t('home.hero_sub_active_list')
                    : t('home.hero_sub_no_list')}
              </Text>
            </View>
            <Float style={styles.heroMascot}>
              <CheepMascot size={92} expression={hasSavings ? 'celebrate' : 'happy'} shadow={false} />
            </Float>
          </View>
        </FadeInUp>

        {/* Active list / create */}
        <FadeInUp delay={110} style={styles.sectionPad}>
          {activeList ? (
            <PressableScale onPress={goActiveList} style={styles.listCard}>
              <View style={styles.listCardTop}>
                <Text style={styles.overline}>{t('home.overline_active_list')}</Text>
                {estimatedPrice && savingsPercent ? (
                  <View style={styles.savePill}>
                    <MaterialIcons name="trending-down" size={13} color={colors.success.dark} />
                    <Text style={styles.savePillText}>%{savingsPercent}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.listName}>{activeList.name}</Text>
              <Text style={styles.listMeta}>
                {t('home.item_count', { count: itemCount })}
                {estimatedPrice
                  ? `  ·  ${t('home.estimated_range', { min: formatMoney(estimatedPrice.min), max: formatMoney(estimatedPrice.max) })}`
                  : ''}
              </Text>
              {listStoreNames.length > 0 && (
                <View style={styles.miniLogos}>
                  {listStoreNames.slice(0, 4).map((n, i) => (
                    <MarketBadge key={i} name={n} size={26} country={country} />
                  ))}
                </View>
              )}
              <View style={styles.listCta}>
                <MaterialCommunityIcons name="map-marker-path" size={18} color={colors.background.paper} />
                <Text style={styles.listCtaText}>{t('home.view_cheapest_route')}</Text>
                <MaterialIcons name="arrow-forward" size={18} color={colors.background.paper} />
              </View>
            </PressableScale>
          ) : (
            <PressableScale onPress={goLists} style={styles.emptyCard}>
              <CheepMascot size={64} expression="search" />
              <View style={styles.emptyBody}>
                <Text style={styles.emptyTitle}>{t('home.no_list_title')}</Text>
                <Text style={styles.emptySub}>{t('home.no_list_sub')}</Text>
              </View>
              <View style={styles.emptyPlus}>
                <MaterialIcons name="add" size={22} color={colors.background.paper} />
              </View>
            </PressableScale>
          )}
        </FadeInUp>

        {/* Categories */}
        <FadeInUp delay={170}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('home.categories_title')}</Text>
            <TouchableOpacity onPress={goAllProducts}>
              <Text style={styles.link}>{t('common.all')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRail}
          >
            {categories.map((c) => (
              <PressableScale
                key={c.id}
                style={styles.catCard}
                onPress={() =>
                  navigation.navigate('CategoryProducts', { categoryId: c.id, categoryName: c.name })
                }
              >
                <View style={styles.catIcon}>
                  <MaterialCommunityIcons
                    name={getCategoryIcon(c.name) as any}
                    size={26}
                    color={colors.primary.main}
                  />
                </View>
                <Text style={styles.catName} numberOfLines={1}>
                  {c.name}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </FadeInUp>

        {/* Smart deals */}
        <FadeInUp delay={230}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('home.deals_title')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('PriceDifferenceList')}>
              <Text style={styles.link}>{t('home.view_all')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealRail}>
            {featuredProducts.slice(0, 8).map((p) => {
              const price = getLowestPrice(p);
              const store = getStoreName(p);
              const disc = getDiscountPercent(p as any);
              return (
                <PressableScale
                  key={p.id}
                  style={styles.dealCard}
                  onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                >
                  <View style={styles.dealImageWrap}>
                    <ProductThumb imageUrl={p.image_url} categoryName={p.category?.name} iconSize={32} />
                    {disc > 0 && (
                      <View style={styles.dealBadge}>
                        <Text style={styles.dealBadgeText}>-%{disc}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.dealName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={styles.dealStore} numberOfLines={1}>
                    {store}
                  </Text>
                  <Text style={styles.dealPrice}>
                    {formatMoney(parseFloat(price ?? '0'))}
                    <Text style={styles.dealPriceFrom}>{t('home.deal_from_suffix')}</Text>
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
        </FadeInUp>

        {/* Markets we compare (no fake distance) */}
        <FadeInUp delay={290}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('home.markets_title')}</Text>
          </View>
          <View style={styles.marketsWrap}>
            {markets.map((s) => (
              <PressableScale
                key={s.id}
                style={styles.marketChip}
                onPress={() => navigation.navigate('StoreDetail', { storeId: s.id })}
              >
                <MarketBadge name={s.name} size={34} country={country} />
                <Text style={styles.marketName} numberOfLines={1}>
                  {s.name}
                </Text>
              </PressableScale>
            ))}
          </View>
        </FadeInUp>
        </>
        )}
      </ScrollView>

      <LocationSheet visible={locationSheetOpen} onClose={() => setLocationSheetOpen(false)} />
    </View>
  );
}

// Market badge — real local logo if we have it, else a colored initial.
function MarketBadge({ name, size = 32, country }: { name: string; size?: number; country: string }) {
  const asset = getStoreLogoAsset(country, name);
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tint =
    (colors.storeChips as Record<string, string>)[
      key.includes('carrefour') ? 'carrefoursa' : key
    ] || colors.primary.main;
  if (asset) {
    return (
      <View style={[badge.wrap, { width: size, height: size, borderRadius: size / 3 }]}>
        <Image source={asset} style={{ width: size * 0.74, height: size * 0.74, resizeMode: 'contain' }} />
      </View>
    );
  }
  return (
    <View style={[badge.wrap, { width: size, height: size, borderRadius: size / 3, backgroundColor: tint }]}>
      <Text style={[badge.initial, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    backgroundColor: colors.background.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  initial: {
    color: colors.background.paper,
    fontWeight: '800',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wordmark: { ...typography.styles.h3, color: colors.text.primary },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent.main,
  },

  sectionPad: { paddingHorizontal: layout.screenPadding },

  // Anchor chip (sabit adres)
  anchorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },
  anchorChipText: { ...typography.styles.caption, color: colors.primary.main, fontWeight: '700' },
  anchorChipMuted: { ...typography.styles.caption, color: colors.text.hint },

  // Hero
  hero: {
    flexDirection: 'row',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.xs,
    overflow: 'hidden',
    ...shadows.md,
  },
  heroBody: { flex: 1 },
  heroGreeting: {
    ...typography.styles.body2,
    color: colors.primary[100],
    marginBottom: spacing.sm,
  },
  heroOverline: {
    ...typography.styles.overline,
    color: colors.primary[200],
    marginBottom: 2,
  },
  heroNumber: {
    ...typography.styles.display,
    color: colors.background.paper,
  },
  heroSub: {
    ...typography.styles.body2,
    color: colors.primary[100],
    marginTop: spacing.xs,
    maxWidth: 200,
  },
  heroMascot: { alignSelf: 'center' },

  // Active list card
  listCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overline: { ...typography.styles.overline, color: colors.text.secondary },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.success.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  savePillText: { ...typography.styles.caption, color: colors.success.dark, fontWeight: '700' },
  listName: { ...typography.styles.h3, color: colors.text.primary, marginTop: spacing.xs },
  listMeta: { ...typography.styles.body2, color: colors.text.secondary, marginTop: 2 },
  miniLogos: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  listCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  listCtaText: { ...typography.styles.button, color: colors.background.paper },

  // Empty card
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  emptyBody: { flex: 1 },
  emptyTitle: { ...typography.styles.h4, color: colors.text.primary },
  emptySub: { ...typography.styles.body2, color: colors.text.secondary, marginTop: 2 },
  emptyPlus: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent.main,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.styles.h4, color: colors.text.primary },
  link: { ...typography.styles.subtitle2, color: colors.accent.main },

  // Category rail
  catRail: { paddingHorizontal: layout.screenPadding, gap: spacing.sm },
  catCard: {
    width: 78,
    alignItems: 'center',
    gap: spacing.xs,
  },
  catIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.secondary[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  catName: { ...typography.styles.caption, color: colors.text.secondary, textAlign: 'center' },

  // Deal rail
  dealRail: { paddingHorizontal: layout.screenPadding, gap: spacing.md, paddingRight: spacing.xl },
  dealCard: {
    width: 150,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.sm,
  },
  dealImageWrap: {
    height: 96,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  dealImage: { width: '86%', height: '86%', resizeMode: 'contain' },
  dealBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.accent.main,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  dealBadgeText: { ...typography.styles.caption, color: colors.background.paper, fontWeight: '800', fontSize: 11 },
  dealName: { ...typography.styles.subtitle2, color: colors.text.primary, minHeight: 36 },
  dealStore: { ...typography.styles.caption, color: colors.text.secondary, marginTop: 2 },
  dealPrice: { ...typography.styles.price, color: colors.primary.main, marginTop: spacing.xs },
  dealPriceFrom: { ...typography.styles.caption, color: colors.text.hint, fontWeight: '400' },

  // Markets
  marketsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
  },
  marketChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  marketName: { ...typography.styles.subtitle2, color: colors.text.primary },
});
