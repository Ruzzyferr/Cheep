/**
 * 👑 Premium rozeti
 *
 * Abone olan kullanıcının ödediği şeyi görmesi gerekiyor. Anasayfada logo
 * yazısının yanında ve profilde ismin altında çıkar; premium değilse hiç
 * çizilmez (yer kaplayan boş bir kabuk bırakmaz).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../../context/PremiumContext';
import { colors, spacing, borderRadius, typography } from '../../theme';

export function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { isPremium } = usePremium();
  const { t } = useTranslation();
  if (!isPremium) return null;

  const md = size === 'md';
  return (
    <View style={[styles.badge, md && styles.badgeMd]} accessibilityRole="text">
      <MaterialIcons name="workspace-premium" size={md ? 15 : 12} color={colors.accent.dark} />
      <Text style={[styles.text, md && styles.textMd]}>{t('premium.badge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  badgeMd: { paddingHorizontal: spacing.sm, paddingVertical: 4, gap: 4 },
  text: {
    ...typography.styles.caption,
    color: colors.accent.dark,
    fontWeight: '700',
    fontSize: 10,
    lineHeight: 13,
  },
  textMd: { fontSize: 12, lineHeight: 16 },
});
