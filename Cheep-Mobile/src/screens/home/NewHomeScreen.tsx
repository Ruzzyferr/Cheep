/**
 * 🏠 Home — "Fresh Market" flagship
 * Cream canvas · forest savings hero · mascot · premium animated cards.
 */

import React, { useState, useEffect, useRef } from 'react';
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
import { productService, storeService, listService, categoryService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { CheepMascot } from '../../components/brand/CheepMascot';
import { FadeInUp, AnimatedNumber, PressableScale, Float } from '../../components/anim';
import { getStoreLogoAsset } from '../../utils/storeLogo';
import { ProductThumb } from '../../components/product/ProductThumb';
import { getCountryCode } from '../../utils/geo';
import { countryStorage } from '../../utils/storage';
import { getCategoryIcon, categoryHomeRank } from '../../utils/categoryIcon';
import { compareInsights, byCoverageThenScore } from '../../utils/compareInsights';
import { colors, typography, spacing, layout, borderRadius } from '../../theme';
import { shadows } from '../../theme/shadows';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Product, Store, ShoppingList } from '../../types';
import type { Category } from '../../services/category.service';
import type { HomeStackScreenProps } from '../../navigation/types';

export function NewHomeScreen({ navigation }: HomeStackScreenProps<'HomeMain'>) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { country, formatMoney } = useLocale();
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [markets, setMarkets] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<{ min: number; max: number } | null>(null);
  const [savingsPercent, setSavingsPercent] = useState<number | undefined>(undefined);
  const [monthlySavings, setMonthlySavings] = useState<number>(0);
  const [monthlySavingsIncrease, setMonthlySavingsIncrease] = useState<number>(0);
  const [potentialSavings, setPotentialSavings] = useState<number>(0);
  const [listStoreNames, setListStoreNames] = useState<string[]>([]);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Ülkeyi çöz/sakla (konum bazlı) — SADECE henüz saklı bir ülke yoksa (ilk-çalıştırma
  // fallback'i). Kullanıcı onboarding/profilde bilinçli bir ülke seçtiyse geo tespiti
  // bunu her Home ziyaretinde EZMEMELİ. Mesafe gösterimi YOK — mağaza koordinatları
  // zincir-seviyesinde placeholder olduğu için yanıltıcı olurdu.
  useEffect(() => {
    (async () => {
      const existing = await countryStorage.getCountry();
      if (existing) return; // kullanıcı zaten seçti (onboarding/profil) — geo ile ezme
      const code = await getCountryCode();
      if (code) await countryStorage.saveCountry(code);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lists, products, stores, allCategories] = await Promise.all([
        listService.getLists('active'),
        productService.getProducts({ limit: 100 }),
        storeService.getStores(),
        categoryService.getParentCategories(),
      ]);
      if (!aliveRef.current) return;

      const parentCategories = allCategories
        .filter((cat) => cat.parent_id === null)
        .sort((a, b) => categoryHomeRank(a.name) - categoryHomeRank(b.name))
        .slice(0, 7);

      const median = (nums: number[]) => {
        const s = [...nums].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
      };
      const productsWithPriceDifference = products
        .map((product) => {
          const prices = (product.store_prices ?? [])
            .map((sp) => parseFloat(sp.price))
            .filter((p) => Number.isFinite(p));
          return { product, prices };
        })
        .filter(({ prices }) => prices.length >= 2)
        .map(({ product, prices }) => {
          const minPrice = Math.min(...prices);
          const reference = median(prices);
          const priceDifference = Math.max(0, reference - minPrice);
          return { ...product, priceDifference, minPrice, maxPrice: reference };
        })
        .sort((a, b) => b.priceDifference - a.priceDifference);

      const firstActiveList = lists[0] || null;
      setActiveList(firstActiveList);
      setFeaturedProducts(productsWithPriceDifference);
      setMarkets(stores);
      setCategories(parentCategories);

      if (firstActiveList && firstActiveList.list_items && firstActiveList.list_items.length > 0) {
        try {
          const listDetail = await listService.getListById(firstActiveList.id);
          if (!aliveRef.current) return;
          if (listDetail.list_items && listDetail.list_items.length > 0) {
            const compareResult = await listService.compareList(firstActiveList.id, {
              maxStores: 3,
              includeMissingProducts: true,
            });
            if (!aliveRef.current) return;
            const insights = compareInsights(compareResult.strategies);
            if (insights.cheapest) {
              setEstimatedPrice({ min: Math.round(insights.min), max: Math.round(insights.max) });
              setSavingsPercent(insights.savingsPct > 0 ? insights.savingsPct : undefined);
              setPotentialSavings(Math.round(insights.savings));
              const bestRoute = [...compareResult.strategies].sort(byCoverageThenScore)[0];
              if (bestRoute && bestRoute.stores.length > 0) {
                const names: string[] = [];
                const seen = new Set<number>();
                bestRoute.stores.forEach((sa) => {
                  if (!seen.has(sa.store.id)) {
                    seen.add(sa.store.id);
                    if (sa.store.name) names.push(sa.store.name);
                  }
                });
                setListStoreNames(names);
              } else {
                setListStoreNames([]);
              }
            } else {
              setEstimatedPrice(null);
              setSavingsPercent(undefined);
              setPotentialSavings(0);
              setListStoreNames([]);
            }
          }
        } catch (error) {
          console.error('list price calc error:', error);
          setEstimatedPrice(null);
          setSavingsPercent(undefined);
        }
      } else {
        setEstimatedPrice(null);
        setSavingsPercent(undefined);
        setPotentialSavings(0);
        setListStoreNames([]);
      }

      // Bu ay toplam tasarruf (tamamlanmış listelerden, sınırlı).
      try {
        const MAX = 6;
        const completed = await listService.getLists('completed');
        if (!aliveRef.current) return;
        const cm = new Date().getMonth();
        const cy = new Date().getFullYear();
        const pm = cm === 0 ? 11 : cm - 1;
        const py = cm === 0 ? cy - 1 : cy;
        const inMonth = (d: Date, m: number, y: number) => d.getMonth() === m && d.getFullYear() === y;
        const relevant = completed
          .filter((l) => {
            if (!l.completed_at) return false;
            const d = new Date(l.completed_at);
            return inMonth(d, cm, cy) || inMonth(d, pm, py);
          })
          .sort((a, b) => new Date(b.completed_at as string).getTime() - new Date(a.completed_at as string).getTime())
          .slice(0, MAX);
        let total = 0;
        let prev = 0;
        for (const l of relevant) {
          const cd = new Date(l.completed_at as string);
          try {
            const cr = await listService.compareList(l.id, { maxStores: 3, includeMissingProducts: true });
            if (!aliveRef.current) return;
            const sv = compareInsights(cr.strategies).savings || 0;
            if (inMonth(cd, cm, cy)) total += sv;
            else prev += sv;
          } catch {
            /* skip */
          }
        }
        if (!aliveRef.current) return;
        setMonthlySavings(Math.round(total));
        setMonthlySavingsIncrease(Math.round(total - prev));
      } catch (error) {
        console.warn('monthly savings error:', error);
      }
    } catch (error) {
      console.error('load data error:', error);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
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
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 110 }}
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
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <MaterialIcons name="notifications-none" size={22} color={colors.text.primary} />
              <View style={styles.dot} />
            </TouchableOpacity>
          </View>
        </View>

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
      </ScrollView>
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
