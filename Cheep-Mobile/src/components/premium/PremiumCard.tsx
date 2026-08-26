/**
 * 👑 Profil'deki premium alanı.
 *
 * İki hâli var:
 *  • abone değilse — ekrandaki TEK koyu yüzey; satın almaya çağırır
 *  • aboneyse      — ince bir durum şeridi; satış yapmaz, statü gösterir
 *
 * Satın alma hiç mümkün değilse (SDK anahtarı yok ya da mağazada tanımlı ürün
 * yok) HİÇ çizilmez: satılamayan bir aboneliği reklam etmek kullanıcıyı boşuna
 * uğraştırır, App Review da ölü paywall'ı reddediyor.
 *
 * TASARIM NOTU — neden koyu:
 * Profil ekranının geri kalanı krem zemin üzerinde beyaz kartlardan oluşuyor;
 * hepsi aynı ağırlıkta. Gözün tutunacağı bir nokta olsun diye premium kartı
 * bilerek ters kontrastta: koyu orman yeşili zemin + sıcak ince çerçeve + krem
 * dolu buton. Ekranda başka koyu yüzey YOK, o yüzden bağırmadan öne çıkıyor.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../../context/PremiumContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

/** Koyu kart üzerindeki sıcak vurgu — yalnızca premium yüzeylerinde kullanılır. */
const WARM = colors.accent.light;
const ON_DARK = '#FFFFFF';
const ON_DARK_MUTED = 'rgba(255,255,255,0.66)';

export function PremiumCard({ onPress }: { onPress: () => void }) {
  const { isPremium, available } = usePremium();
  const { t } = useTranslation();

  if (!available && !isPremium) return null;

  // ─── Abone: ince durum şeridi ────────────────────────────────────────────
  if (isPremium) {
    return (
      <Pressable
        style={styles.activeCard}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('premium.card_active_title')}
      >
        <View style={styles.activeIcon}>
          <MaterialIcons name="workspace-premium" size={20} color={colors.accent.dark} />
        </View>
        <View style={styles.activeText}>
          <Text style={styles.activeTitle}>{t('premium.card_active_title')}</Text>
          <Text style={styles.activeBody} numberOfLines={1}>
            {t('premium.card_active_body')}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.text.hint} />
      </Pressable>
    );
  }

  // ─── Abone değil: satın alma kartı ───────────────────────────────────────
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('premium.card_cta')}
    >
      <View style={styles.head}>
        <View style={styles.crown}>
          <MaterialIcons name="workspace-premium" size={20} color={WARM} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.eyebrow}>{t('premium.title')}</Text>
          <Text style={styles.title}>{t('premium.card_title')}</Text>
        </View>
      </View>

      <Text style={styles.desc}>{t('premium.card_body')}</Text>

      <View style={styles.cta}>
        <Text style={styles.ctaText}>{t('premium.card_cta')}</Text>
        <MaterialIcons name="arrow-forward" size={15} color={colors.primary.dark} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ─── Satın alma kartı ─────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.primary[900],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    // Sıcak, çok düşük opaklıkta hairline — "bilet" hissi verir, çerçeve gibi durmaz.
    borderColor: 'rgba(248,155,111,0.32)',
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.lg,
  },

  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  crown: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(248,155,111,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headText: { flex: 1, gap: 2 },

  eyebrow: {
    ...typography.styles.overline,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.4,
    color: WARM,
  },

  title: {
    ...typography.styles.subtitle1,
    fontSize: 15,
    lineHeight: 20,
    color: ON_DARK,
    fontWeight: '700',
  },

  desc: {
    ...typography.styles.caption,
    color: ON_DARK_MUTED,
    lineHeight: 18,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs / 2,
    // Krem dolu buton: koyu zeminin üzerindeki tek dolu yüzey.
    backgroundColor: colors.background.default,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ctaText: {
    ...typography.styles.caption,
    fontSize: 13,
    color: colors.primary.dark,
    fontWeight: '700',
  },

  // ─── Abone şeridi ─────────────────────────────────────────────────────────
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...shadows.sm,
  },
  activeIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: { flex: 1 },
  activeTitle: {
    ...typography.styles.subtitle2,
    color: colors.text.primary,
    fontWeight: '700',
  },
  activeBody: { ...typography.styles.caption, color: colors.text.secondary },
});
