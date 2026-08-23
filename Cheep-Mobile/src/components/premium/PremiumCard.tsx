/**
 * 👑 Profil'deki premium alanı.
 *
 * İki hâli var:
 *  • abone değilse — maskotlu, sıcak bir satın alma kartı
 *  • aboneyse      — teşekkür + yönetim girişi
 *
 * Satın alma hiç mümkün değilse (SDK anahtarı yok) HİÇ çizilmez: satılamayan
 * bir aboneliği reklam etmek kullanıcıyı boşuna uğraştırır.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CheepMascot } from '../brand/CheepMascot';
import { usePremium } from '../../context/PremiumContext';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

export function PremiumCard({ onPress }: { onPress: () => void }) {
  const { isPremium, available } = usePremium();
  const { t } = useTranslation();

  if (!available && !isPremium) return null;

  if (isPremium) {
    return (
      <Pressable style={styles.activeCard} onPress={onPress} accessibilityRole="button">
        <View style={styles.activeIcon}>
          <MaterialIcons name="workspace-premium" size={22} color={colors.accent.dark} />
        </View>
        <View style={styles.activeText}>
          <Text style={styles.activeTitle}>{t('premium.card_active_title')}</Text>
          <Text style={styles.activeBody}>{t('premium.card_active_body')}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.text.hint} />
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <View style={styles.mascot}>
        <CheepMascot size={64} expression="celebrate" shadow={false} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{t('premium.card_title')}</Text>
        <Text style={styles.desc}>{t('premium.card_body')}</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{t('premium.card_cta')}</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
    padding: spacing.md,
  },
  mascot: { width: 64, alignItems: 'center' },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.styles.body1, color: colors.text.primary, fontWeight: '700' },
  desc: { ...typography.styles.caption, color: colors.text.secondary, lineHeight: 17 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  ctaText: { ...typography.styles.caption, color: '#FFFFFF', fontWeight: '700' },

  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.accent[100],
    padding: spacing.md,
    ...shadows.md,
  },
  activeIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: { flex: 1 },
  activeTitle: { ...typography.styles.body1, color: colors.text.primary, fontWeight: '700' },
  activeBody: { ...typography.styles.caption, color: colors.text.secondary },
});
