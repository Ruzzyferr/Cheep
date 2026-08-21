/**
 * 🏪 Store Detail Screen
 * Store information and products
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../../theme';
import type { HomeStackScreenProps } from '../../navigation/types';
import { useTranslation } from 'react-i18next';

// Mağaza detay ekranı henüz yapım aşamasında. Canlı bir hedef olarak bağlı
// olduğundan (ProductDetail / Ana Sayfa), bozuk görünmemesi için bunu açıkça
// "yakında" durumu olarak etiketliyoruz.
export function StoreDetailScreen({
  navigation,
}: HomeStackScreenProps<'StoreDetail'>) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <MaterialIcons name="storefront" size={56} color={colors.text.hint} />
      <Text style={styles.text}>{t('product.store_details')}</Text>
      <Text style={styles.subtitle}>
        Bu özellik yakında kullanıma açılacak.
      </Text>
      <Text
        style={styles.back}
        accessibilityRole="button"
        onPress={() => navigation.goBack()}
      >
        Geri dön
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    padding: spacing.xl,
  },
  text: {
    ...typography.styles.h2,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.styles.body1,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  back: {
    ...typography.styles.body1,
    color: colors.primary.main,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
});

