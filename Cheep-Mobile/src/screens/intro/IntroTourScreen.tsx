/**
 * 🎬 Intro Tour
 * First-launch, swipeable "how to use Cheep" walkthrough (a few animated pages).
 * Shown once on first app open (gated by local storage) and replayable any time
 * from Profile → "Nasıl kullanılır". Distinct from the diet/budget onboarding wizard.
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Dimensions,
  TouchableOpacity,
  type ViewToken,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing, borderRadius, layout } from '../../theme';

const { width } = Dimensions.get('window');

type Slide = {
  key: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  accentBg: string;
  title: string;
  desc: string;
};

const SLIDES: Slide[] = [
  {
    key: 'compare',
    icon: 'compare-arrows',
    accent: colors.primary.main,
    accentBg: colors.primary[50],
    title: 'Tüm marketler tek yerde',
    desc: 'Migros, A101, ŞOK ve CarrefourSA fiyatlarını tek uygulamada karşılaştır. Aynı ürünün en ucuz olduğu marketi anında gör.',
  },
  {
    key: 'list',
    icon: 'add-shopping-cart',
    accent: '#F59E0B',
    accentBg: '#FEF3C7',
    title: 'Alışveriş listeni oluştur',
    desc: 'Ürünleri ara ve listene ekle. Kaç ürün eklediğini her ekranda sepet rozetinden takip edebilirsin.',
  },
  {
    key: 'route',
    icon: 'alt-route',
    accent: colors.secondary.main,
    accentBg: colors.secondary[50] ?? colors.primary[50],
    title: 'En ucuz rotayı bul',
    desc: 'Listeni tek markette mi, yoksa birkaç markete bölerek mi almak daha ucuz? Cheep tüm seçenekleri hesaplar ve en uygununu önerir.',
  },
  {
    key: 'save',
    icon: 'savings',
    accent: '#10B981',
    accentBg: '#D1FAE5',
    title: 'Tasarrufunu gör',
    desc: 'Her alışverişte ne kadar kazandığını gör. Hazır olduğunda sepetini en ucuz marketin sitesinde tek dokunuşla tamamla.',
  },
];

export function IntroTourScreen({ navigation, route }: any) {
  const replay: boolean = route?.params?.replay ?? false;
  const { markIntroSeen } = useAuth();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Slide>>(null);

  // Animated entrance of the icon on each slide change
  const iconScale = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    iconScale.setValue(0.8);
    Animated.spring(iconScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }, [index, iconScale]);

  const onViewRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  const finish = () => {
    if (replay) {
      navigation.goBack();
    } else {
      markIntroSeen(); // ilk açılış kapısını kapat → sıradaki ekrana (Auth) geç
    }
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar: brand + skip */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>Cheep</Text>
        {!isLast && (
          <TouchableOpacity onPress={finish} hitSlop={8} activeOpacity={0.7}>
            <Text style={styles.skip}>Atla</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.FlatList
        ref={listRef as any}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        renderItem={({ item, index: i }) => (
          <View style={styles.slide}>
            <Animated.View
              style={[
                styles.iconCircle,
                { backgroundColor: item.accentBg },
                i === index && { transform: [{ scale: iconScale }] },
              ]}
            >
              <MaterialIcons name={item.icon} size={72} color={item.accent} />
            </Animated.View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 22, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity }]} />;
        })}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cta} onPress={next} activeOpacity={0.9}>
          <Text style={styles.ctaText}>{isLast ? (replay ? 'Tamam' : 'Başla') : 'İleri'}</Text>
          {!isLast && (
            <MaterialIcons name="arrow-forward" size={20} color={colors.background.paper} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.md,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.primary.main,
  },
  skip: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  iconCircle: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  title: {
    ...typography.styles.h2,
    color: colors.text.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  desc: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.main,
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
  },
  cta: {
    height: layout.buttonHeight,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  ctaText: {
    ...typography.styles.button,
    color: colors.background.paper,
  },
});
