/**
 * ➖1➕ Adet denetimi
 *
 * NEDEN VAR: veri modelinde `quantity` en başından beri vardı ama arayüzde
 * onu değiştirecek hiçbir şey yoktu — kullanıcı sütten 3 tane almak istediğinde
 * ürünü 3 kez eklemeyi deniyor, liste 1'de takılı kalıyordu (kullanıcı geri
 * bildirimi, 4 Ekim 2026).
 *
 * TEK BİLEŞEN, İKİ BOY: ürün kartı ile liste satırının ölçüleri farklı ama
 * davranışı aynı olmak zorunda. Ayrı ayrı yazılsalardı alt sınır, basılı tutma
 * ve erişilebilirlik etiketleri birbirinden kayardı.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors, typography, borderRadius } from '../../theme';
import { formatQuantity } from '../../utils/quantity';

interface Props {
  value: number;
  /** Yeni adet. Alt sınır (1) bileşen içinde korunuyor. */
  onChange: (next: number) => void;
  /** 1'deyken eksiye basılırsa — verilmezse eksi düğmesi 1'de PASİF olur. */
  onRemove?: () => void;
  /** `compact`: ürün kartı (36dp). `row`: liste satırı (32dp). */
  size?: 'compact' | 'row';
  /** Ağ isteği uçarken çift basmayı engeller. */
  disabled?: boolean;
  style?: ViewStyle;
}

export function QuantityStepper({
  value,
  onChange,
  onRemove,
  size = 'compact',
  disabled = false,
  style,
}: Props) {
  const { t } = useTranslation();
  const boy = size === 'compact' ? 36 : 32;
  const ikon = size === 'compact' ? 20 : 18;

  // Adet 1'de ve silme davranışı verilmemişse eksi düğmesi anlamsız.
  const eksiKapali = disabled || (value <= 1 && !onRemove);

  const azalt = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value <= 1) onRemove?.();
    else onChange(value - 1);
  }, [value, onChange, onRemove]);

  const artir = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value + 1);
  }, [value, onChange]);

  return (
    <View style={[styles.wrap, { height: boy }, style]}>
      <TouchableOpacity
        onPress={azalt}
        disabled={eksiKapali}
        style={[styles.btn, { width: boy, height: boy }]}
        // Dokunma hedefi 32dp'de Android'in 48dp tabanının altinda kaliyor;
        // hitSlop farki kapatiyor, gorsel boyut kucuk kalabiliyor.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={value <= 1 && onRemove ? t('list.delete_action') : t('list.quantity_decrease')}
      >
        <MaterialIcons
          name={value <= 1 && onRemove ? 'delete-outline' : 'remove'}
          size={ikon}
          color={eksiKapali ? colors.text.hint : colors.primary.main}
        />
      </TouchableOpacity>

      <Text
        style={[styles.value, size === 'row' && styles.valueRow]}
        accessibilityLabel={t('list.quantity_label', { count: value })}
      >
        {formatQuantity(value)}
      </Text>

      <TouchableOpacity
        onPress={artir}
        disabled={disabled}
        style={[styles.btn, { width: boy, height: boy }]}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('list.quantity_increase')}
      >
        <MaterialIcons name="add" size={ikon} color={disabled ? colors.text.hint : colors.primary.main} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
    overflow: 'hidden',
  },
  btn: { justifyContent: 'center', alignItems: 'center' },
  value: {
    ...typography.styles.body1,
    color: colors.text.primary,
    fontWeight: '700',
    minWidth: 26,
    textAlign: 'center',
  },
  valueRow: { ...typography.styles.body2, fontWeight: '700', minWidth: 22 },
});
