/**
 * 🎬 Intro Tour — mascot-guided.
 * The Cheep bird walks you through the app: each slide shows a little piece of the
 * real UI with the mascot pointing at it ("buraya bas 👇"). Animated, swipeable,
 * shown once on first launch (intro_seen gate) and replayable from Profile.
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
  type ViewToken,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { CheepMascot, type MascotExpression } from '../../components/brand/CheepMascot';
import { Float } from '../../components/anim';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';
import { shadows } from '../../theme/shadows';

const { width } = Dimensions.get('window');

/** A bouncing down-arrow that signals "press here". */
function Pointer() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [-4, 6] });
  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <MaterialIcons name="south" size={26} color={colors.accent.main} />
    </Animated.View>
  );
}

// ── Per-slide "scene" mocks (mascot points at a real bit of UI) ──────────────

function SceneCompare() {
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  return (
    <View style={scene.card}>
      <View style={scene.productRow}>
        <View style={scene.thumb}>
          <MaterialCommunityIcons name="bottle-soda-classic" size={22} color={colors.primary.main} />
        </View>
        <Text style={scene.productName}>{t('intro.scene.milk_product')}</Text>
      </View>
      <View style={scene.priceRow}>
        <View style={scene.priceChip}>
          <Text style={scene.priceStore}>Migros</Text>
          <Text style={scene.priceVal}>{formatMoney(25)}</Text>
        </View>
        <View style={[scene.priceChip, scene.priceBest]}>
          <Text style={[scene.priceStore, scene.priceStoreBest]}>A101</Text>
          <Text style={[scene.priceVal, scene.priceValBest]}>{formatMoney(22)}</Text>
          <View style={scene.bestTag}>
            <Text style={scene.bestTagText}>{t('intro.scene.cheapest_tag')}</Text>
          </View>
        </View>
        <View style={scene.priceChip}>
          <Text style={scene.priceStore}>ŞOK</Text>
          <Text style={scene.priceVal}>{formatMoney(24)}</Text>
        </View>
      </View>
    </View>
  );
}

function SceneTab() {
  const { t } = useTranslation();
  const items: { icon: keyof typeof MaterialIcons.glyphMap; label: string; active?: boolean }[] = [
    { icon: 'home', label: t('intro.scene.tab_home') },
    { icon: 'list-alt', label: t('intro.scene.tab_lists'), active: true },
    { icon: 'sell', label: t('intro.scene.tab_deals') },
    { icon: 'person', label: t('intro.scene.tab_profile') },
  ];
  return (
    <View style={scene.tabBar}>
      {items.map((it) => (
        <View key={it.label} style={scene.tabItem}>
          <View style={it.active ? scene.tabActiveWrap : undefined}>
            <MaterialIcons
              name={it.icon}
              size={22}
              color={it.active ? colors.primary.main : colors.text.hint}
            />
            {it.active && (
              <View style={scene.tabBadge}>
                <Text style={scene.tabBadgeText}>7</Text>
              </View>
            )}
          </View>
          <Text style={[scene.tabLabel, it.active && scene.tabLabelActive]}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function SceneRoute() {
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  return (
    <View style={scene.card}>
      <Text style={scene.routeOverline}>{t('intro.scene.best_route_overline')}</Text>
      <View style={scene.routeRow}>
        <Text style={scene.routeStores}>Migros + A101</Text>
        <Text style={scene.routePrice}>{formatMoney(229)}</Text>
      </View>
      <View style={scene.routeCta}>
        <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.background.paper} />
        <Text style={scene.routeCtaText}>{t('home.view_cheapest_route')}</Text>
      </View>
    </View>
  );
}

function SceneSavings() {
  const { t } = useTranslation();
  const { formatMoney } = useLocale();
  return (
    <View style={[scene.card, scene.savingsCard]}>
      <Text style={scene.savingsOverline}>{t('home.overline_saved')}</Text>
      <Text style={scene.savingsNumber}>{formatMoney(1240)}</Text>
      <View style={scene.savingsPill}>
        <MaterialIcons name="trending-up" size={14} color={colors.success.dark} />
        <Text style={scene.savingsPillText}>+%12</Text>
      </View>
    </View>
  );
}

type Slide = {
  key: string;
  expression: MascotExpression;
  scene: React.ReactNode;
  title: string; // i18n key
  desc: string; // i18n key
  pointer?: boolean;
};

// title/desc hold i18n KEYS — resolved via t() in the FlatList renderItem below.
const SLIDES: Slide[] = [
  {
    key: 'compare',
    expression: 'search',
    scene: <SceneCompare />,
    title: 'intro.slides.compare.title',
    desc: 'intro.slides.compare.desc',
    pointer: true,
  },
  {
    key: 'list',
    expression: 'happy',
    scene: <SceneTab />,
    title: 'intro.slides.list.title',
    desc: 'intro.slides.list.desc',
    pointer: true,
  },
  {
    key: 'route',
    expression: 'happy',
    scene: <SceneRoute />,
    title: 'intro.slides.route.title',
    desc: 'intro.slides.route.desc',
    pointer: true,
  },
  {
    key: 'save',
    expression: 'celebrate',
    scene: <SceneSavings />,
    title: 'intro.slides.save.title',
    desc: 'intro.slides.save.desc',
  },
];

export function IntroTourScreen({ navigation, route }: any) {
  const replay: boolean = route?.params?.replay ?? false;
  const { markIntroSeen } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Slide>>(null);

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const finish = () => {
    if (replay) navigation.goBack();
    else markIntroSeen();
  };
  const next = () => {
    if (index < SLIDES.length - 1) listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    else finish();
  };
  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <CheepMascot size={28} shadow={false} />
          <Text style={styles.brand}>Cheep</Text>
        </View>
        {!isLast && (
          <TouchableOpacity onPress={finish} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.skip}>{t('intro.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.FlatList
        ref={listRef as any}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        style={styles.list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        // scrollX noktaların `width`'ini (dotWidth) sürüyor; native animated modülü
        // `width`'i desteklemez → JS driver kullan (sayfalama takibi için performans yeterli).
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Stage: scene + mascot pointing at it */}
            <View style={styles.stage}>
              <View style={styles.sceneWrap}>{item.scene}</View>
              <View style={styles.guide}>
                {item.pointer && <Pointer />}
                <Float amplitude={5}>
                  <CheepMascot size={104} expression={item.expression} />
                </Float>
              </View>
            </View>

            <Text style={styles.title}>{t(item.title)}</Text>
            <Text style={styles.desc}>{t(item.desc)}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 22, 8], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />;
        })}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.9}>
          <Text style={styles.ctaText}>
            {isLast ? (replay ? t('intro.done') : t('intro.get_started')) : t('intro.next')}
          </Text>
          {!isLast && <MaterialIcons name="arrow-forward" size={20} color={colors.background.paper} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.default },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brand: { ...typography.styles.h4, color: colors.primary.main },
  skip: { ...typography.styles.subtitle2, color: colors.text.secondary },

  list: { flex: 1 },
  slide: { width, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  stage: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sceneWrap: { width: '100%', alignItems: 'center' },
  guide: { alignItems: 'center', marginTop: spacing.lg, gap: spacing.xs },

  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  desc: { ...typography.styles.body1, color: colors.text.secondary, textAlign: 'center', lineHeight: 24 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginVertical: spacing.lg },
  dot: { height: 8, borderRadius: 4, backgroundColor: colors.primary.main },

  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.lg },
  cta: {
    height: layout.buttonHeight,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    ...shadows.md,
  },
  ctaText: { ...typography.styles.button, color: colors.background.paper },
});

// Scene styles
const scene = StyleSheet.create({
  card: {
    width: 280,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.secondary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: { ...typography.styles.subtitle1, color: colors.text.primary },
  priceRow: { flexDirection: 'row', gap: spacing.sm },
  priceChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.default,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  priceBest: { backgroundColor: colors.success.bg, borderColor: colors.secondary.light },
  priceStore: { ...typography.styles.caption, color: colors.text.secondary },
  priceStoreBest: { color: colors.success.dark, fontWeight: '700' },
  priceVal: { ...typography.styles.priceSmall, color: colors.text.primary, marginTop: 2 },
  priceValBest: { color: colors.success.dark },
  bestTag: {
    marginTop: 4,
    backgroundColor: colors.success.main,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  bestTagText: { color: colors.background.paper, fontSize: 8, fontWeight: '800' },

  tabBar: {
    flexDirection: 'row',
    width: 300,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabActiveWrap: {
    backgroundColor: colors.secondary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: 4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { color: colors.background.paper, fontSize: 9, fontWeight: '800' },
  tabLabel: { fontSize: 10, color: colors.text.hint },
  tabLabelActive: { color: colors.primary.main, fontWeight: '700' },

  routeOverline: { ...typography.styles.overline, color: colors.text.secondary, marginBottom: spacing.sm },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  routeStores: { ...typography.styles.subtitle1, color: colors.text.primary },
  routePrice: { ...typography.styles.price, color: colors.primary.main },
  routeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  routeCtaText: { ...typography.styles.subtitle2, color: colors.background.paper },

  savingsCard: { backgroundColor: colors.primary.main, borderColor: colors.primary.main, alignItems: 'center' },
  savingsOverline: { ...typography.styles.overline, color: colors.primary[200] },
  savingsNumber: { ...typography.styles.display, color: colors.background.paper, marginVertical: spacing.xs },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.background.paper,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  savingsPillText: { ...typography.styles.caption, color: colors.success.dark, fontWeight: '800' },
});
