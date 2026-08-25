/**
 * 👑 Cheep Premium — satın alma ekranı
 *
 * App Store 3.1.2 ve Play abonelik kuralları ekranda ŞUNLARI zorunlu tutar;
 * hepsi burada ve hepsi çeviriden gelir:
 *   • aboneliğin adı ve süresi
 *   • yerelleştirilmiş fiyat (mağazadan geldiği gibi)
 *   • otomatik yenileme ve iptal bilgisi
 *   • "Satın alımları geri yükle"
 *   • Kullanım Koşulları ve Gizlilik Politikası bağlantıları
 * Bunlardan biri eksikse inceleme reddedilir — silmeden önce iki kez düşün.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { PurchasesPackage } from 'react-native-purchases';
import { usePremium } from '../../context/PremiumContext';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useBottomSpacing } from '../../hooks/useScreenSpacing';
import { appAlert } from '../../utils/dialog';

const TERMS_URL = 'https://cheep.live/terms';
const PRIVACY_URL = 'https://cheep.live/privacy';

/** Yıllık paketin aylığa göre kazandırdığı yüzde — hesaplanamıyorsa null. */
function savingPercent(monthly?: PurchasesPackage, yearly?: PurchasesPackage): number | null {
  const m = monthly?.product.price;
  const y = yearly?.product.price;
  if (!m || !y || m <= 0) return null;
  const pct = Math.round((1 - y / (m * 12)) * 100);
  return pct > 0 ? pct : null;
}

export function PaywallScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { offering, isPremium, status, available, busy, buy, restore, reloadOffering } = usePremium();
  const [selected, setSelected] = useState<'monthly' | 'yearly'>('yearly');
  // Sekme disi ekran: tab bar payi yok ama sistem cubugu payi gerekli.
  const bottomSpacing = useBottomSpacing();

  const monthly = offering?.availablePackages.find((p) => p.packageType === 'MONTHLY');
  const yearly = offering?.availablePackages.find((p) => p.packageType === 'ANNUAL');
  // SEÇİLİ PLAN gerçekten VAR OLAN bir plan olmalı. Varsayılan 'yearly' ama
  // teklifte yalnızca aylık varsa, eskiden aylık kart "seçili değil" görünüp
  // buton yine aylığı satın alıyordu — kullanıcı ne aldığını ekrandan
  // okuyamıyordu (Apple 3.1.2 netlik sorunu ve düpedüz yanıltıcı).
  const effectiveSelected: 'monthly' | 'yearly' =
    selected === 'yearly' ? (yearly ? 'yearly' : 'monthly') : (monthly ? 'monthly' : 'yearly');
  const chosen = effectiveSelected === 'yearly' ? yearly ?? monthly : monthly ?? yearly;
  const saving = savingPercent(monthly, yearly);

  const onBuy = async () => {
    if (!chosen) return;
    try {
      const ok = await buy(chosen);
      if (ok) {
        appAlert(t('premium.thanks_title'), t('premium.thanks_body'));
        navigation.goBack();
      }
    } catch {
      appAlert(t('premium.error_title'), t('premium.error_body'));
    }
  };

  const onRestore = async () => {
    try {
      await restore();
      // Mesajı nötr tutuyoruz: geri yükleme çalıştı ama bu hesapta satın alma
      // bulunmamış da olabilir. Sonuç rozetten görülür.
      appAlert(t('premium.restore_title'), t('premium.restore_body'));
    } catch {
      appAlert(t('premium.error_title'), t('premium.error_body'));
    }
  };

  // Zaten abone: satın alma değil, durum ekranı göster.
  if (isPremium) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomSpacing }]}>
        <View style={styles.crown}>
          <Ionicons name="checkmark-circle" size={44} color={colors.success.main} />
        </View>
        <Text style={styles.title}>{t('premium.active_title')}</Text>
        <Text style={styles.subtitle}>
          {status?.currentPeriodEnd
            ? t(status.willRenew ? 'premium.active_renews' : 'premium.active_until', {
                date: new Date(status.currentPeriodEnd).toLocaleDateString(),
              })
            : t('premium.active_body')}
        </Text>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>{t('common.close')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomSpacing }]}>
      <View style={styles.crown}>
        <Ionicons name="sparkles" size={40} color={colors.accent.main} />
      </View>
      <Text style={styles.title}>{t('premium.title')}</Text>
      <Text style={styles.subtitle}>{t('premium.subtitle')}</Text>

      <View style={styles.benefits}>
        {['benefit_1', 'benefit_2', 'benefit_3'].map((k) => (
          <View key={k} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary.main} />
            <Text style={styles.benefitText}>{t(`premium.${k}`)}</Text>
          </View>
        ))}
      </View>

      {!available || !offering ? (
        <View style={styles.unavailable}>
          <Text style={styles.unavailableText}>{t('premium.unavailable')}</Text>
          {/* YENİDEN DENE: teklif oturum başına tek kez çekiliyordu; tek bir
              başarısız çağrı premium'a giden bütün yolları oturum boyunca
              kapatıyordu (tek çare uygulamayı öldürmekti). */}
          <Pressable
            onPress={reloadOffering}
            disabled={busy}
            accessibilityRole="button"
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {yearly ? (
            <PlanCard
              active={effectiveSelected === 'yearly'}
              onPress={() => setSelected('yearly')}
              label={t('premium.yearly')}
              price={yearly.product.priceString}
              note={saving ? t('premium.save_badge', { percent: saving }) : undefined}
            />
          ) : null}
          {monthly ? (
            <PlanCard
              active={effectiveSelected === 'monthly'}
              onPress={() => setSelected('monthly')}
              label={t('premium.monthly')}
              price={monthly.product.priceString}
            />
          ) : null}

          <Pressable
            style={[styles.cta, busy && styles.ctaDisabled]}
            onPress={onBuy}
            disabled={busy || !chosen}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>{t('premium.cta_subscribe')}</Text>
            )}
          </Pressable>

          {/* Apple ve Google bu bilgilendirmenin ekranda olmasını ister. */}
          <Text style={styles.renewNotice}>{t('premium.renew_notice')}</Text>

        </>
      )}

      {/* SATIN ALIMLARI GERİ YÜKLE — teklif dalının DIŞINDA, koşulsuz.
          Eskiden `available && offering` dalının içindeydi, yani mağaza ürün
          döndüremediği anda kaybolan bir düğmeydi. Oysa tam da o durumda
          gerekiyor: aboneliği olan ama cihazı teklifi çekemeyen kullanıcı
          hakkını geri yükleyemiyordu. App Review de paywall'ı çoğu zaman
          StoreKit ürün döndürmezken açıyor — 1.5.0 reddinin (3.1.2(c))
          yaşandığı tablo tam olarak buydu. */}
      <Pressable onPress={onRestore} disabled={busy} accessibilityRole="button">
        <Text style={styles.restore}>{t('premium.cta_restore')}</Text>
      </Pressable>

      <View style={styles.legal}>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)} accessibilityRole="link">
          <Text style={styles.legalLink}>{t('premium.terms')}</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
          <Text style={styles.legalLink}>{t('premium.privacy')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function PlanCard({
  active, onPress, label, price, note,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  price: string;
  note?: string;
}) {
  return (
    <Pressable
      style={[styles.plan, active && styles.planActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.planLeft}>
        <Ionicons
          name={active ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={active ? colors.primary.main : colors.border.dark}
        />
        <View>
          <Text style={styles.planLabel}>{label}</Text>
          {note ? <Text style={styles.planNote}>{note}</Text> : null}
        </View>
      </View>
      <Text style={styles.planPrice}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    backgroundColor: colors.background.default,
    flexGrow: 1,
  },
  crown: { alignSelf: 'center', marginBottom: spacing.md },
  title: { ...typography.styles.h2, color: colors.text.primary, textAlign: 'center' },
  subtitle: {
    ...typography.styles.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },

  benefits: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitText: { ...typography.styles.body2, color: colors.text.primary, flex: 1 },

  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  planActive: { borderColor: colors.primary.main },
  planLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planLabel: { ...typography.styles.body1, color: colors.text.primary, fontWeight: '600' },
  planNote: { ...typography.styles.caption, color: colors.success.main },
  planPrice: { ...typography.styles.body1, color: colors.text.primary, fontWeight: '700' },

  cta: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { ...typography.styles.button, color: '#FFFFFF' },

  renewNotice: {
    ...typography.styles.caption,
    color: colors.text.hint,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 17,
  },
  restore: {
    ...typography.styles.body2,
    color: colors.primary.main,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: '600',
  },

  unavailable: { padding: spacing.md, backgroundColor: colors.warning.bg, borderRadius: borderRadius.md },
  unavailableText: { ...typography.styles.body2, color: colors.warning.dark, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.sm,
    minHeight: 48,          // Android dokunma hedefi tabanı
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: { ...typography.styles.subtitle2, color: colors.primary.main },

  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  legalLink: { ...typography.styles.caption, color: colors.text.secondary, textDecorationLine: 'underline' },
  legalDot: { color: colors.text.hint },

  secondaryBtn: {
    marginTop: spacing.lg,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: { ...typography.styles.button, color: colors.primary.main },
});
