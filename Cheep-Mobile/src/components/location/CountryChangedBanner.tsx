/**
 * 🌍 Otomatik ülke geçişi şeridi. Engellemez, onay sormaz — yalnızca haber verir.
 * (Onay sormuyoruz: GPS Polonya diyorsa kullanıcı gerçekten Polonya'dadır.)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocationAnchor } from '../../context/LocationContext';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function CountryChangedBanner() {
  const { t } = useTranslation();
  const { countryChangedTo, dismissCountryNotice } = useLocationAnchor();
  if (!countryChangedTo) return null;

  const country = t(`countries.${countryChangedTo}`);
  return (
    <View style={styles.bar}>
      <MaterialIcons name="public" size={18} color={colors.primary.main} />
      <Text style={styles.text}>{t('location.country_changed', { country })}</Text>
      <TouchableOpacity onPress={dismissCountryNotice} hitSlop={8}>
        <Text style={styles.action}>{t('location.dismiss')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    // primary[50]: kodun geri kalanında marka rengine yaslanan bilgilendirme
    // yüzeyleri için zaten kullanılan aynı yumuşak yeşil (bkz. ProfileScreen
    // statIcon/menuIconWrap, NewHomeScreen catIcon).
    backgroundColor: colors.primary[50],
  },
  text: { flex: 1, ...typography.styles.caption, color: colors.text.primary },
  action: { ...typography.styles.caption, fontWeight: '700', color: colors.primary.main },
});
