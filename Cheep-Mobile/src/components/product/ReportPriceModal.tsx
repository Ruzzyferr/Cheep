/**
 * 🏷️ Fiyat bildir
 *
 * NEDEN VAR: TÜBİTAK 5 Eki 2026'da veri iznini reddetti; zincirlerin kendi
 * koşulları da yazılı izin olmadan kopyalamayı yasaklıyor. Kullanıcının
 * rafta gördüğünü kendi girmesi, hukuken tartışmasız bize ait TEK fiyat
 * kaynağı (bkz. `docs/VERI-IZINLERI.md`).
 *
 * DÜRÜSTLÜK: tek bildirim fiyatı YAYINA ALMAZ — en az iki farklı kullanıcı
 * uzlaşmalı. Arayüz bunu saklamıyor; "kaydedildi, onay bekliyor" diyor.
 * Aksi halde kullanıcı girdiği fiyatı hemen göremeyince hata sanır.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button, Input } from '../ui';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { userPriceService } from '../../services';
import { appAlert } from '../../utils/dialog';
import type { Store } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  productId: number;
  productName: string;
  /** Seçilebilecek marketler — ürünün bulunduğu ülkedekiler. */
  stores: Store[];
  /** Başarılı bildirimden sonra listeyi tazelemek için. */
  onReported?: () => void;
}

export function ReportPriceModal({
  visible,
  onClose,
  productId,
  productName,
  stores,
  onReported,
}: Props) {
  const { t } = useTranslation();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [fiyat, setFiyat] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kapat = useCallback(() => {
    setStoreId(null);
    setFiyat('');
    setHata(null);
    onClose();
  }, [onClose]);

  const gonder = async () => {
    // Virgül de kabul: Türkçe klavye ondalık için virgül basıyor.
    const sayi = parseFloat(fiyat.replace(',', '.'));
    if (!storeId) {
      setHata(t('user_price.pick_store'));
      return;
    }
    if (!(sayi > 0)) {
      setHata(t('user_price.invalid_price'));
      return;
    }
    setHata(null);
    setGonderiliyor(true);
    try {
      const sonuc = await userPriceService.bildir({
        product_id: productId,
        store_id: storeId,
        price: sayi,
      });
      kapat();
      onReported?.();
      appAlert(
        t('user_price.thanks_title'),
        sonuc.uzlasi ? t('user_price.published') : t('user_price.pending'),
      );
    } catch (e: any) {
      setHata(e?.response?.data?.message || t('user_price.error'));
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={kapat}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialIcons name="sell" size={20} color={colors.primary.main} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{t('user_price.title')}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {productName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={kapat}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <MaterialIcons name="close" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={styles.label}>{t('user_price.which_store')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storeRow}
            >
              {stores.map((s) => {
                const secili = s.id === storeId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setStoreId(s.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: secili }}
                    style={[styles.storeChip, secili && styles.storeChipOn]}
                  >
                    <Text style={[styles.storeChipText, secili && styles.storeChipTextOn]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Input
              label={t('user_price.price_label')}
              placeholder="0,00"
              value={fiyat}
              onChangeText={setFiyat}
              keyboardType="decimal-pad"
              leftIcon={<MaterialIcons name="payments" size={20} color={colors.text.hint} />}
            />

            {hata ? <Text style={styles.error}>{hata}</Text> : null}

            {/* Beklentiyi BAŞTAN kuruyoruz: tek bildirim yayına almaz. */}
            <View style={styles.note}>
              <MaterialIcons name="info-outline" size={15} color={colors.text.hint} />
              <Text style={styles.noteText}>{t('user_price.consensus_note')}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              title={t('common.cancel')}
              variant="outline"
              onPress={kapat}
              style={styles.footerBtn}
            />
            {gonderiliyor ? (
              <View style={[styles.footerBtn, styles.loadingBox]}>
                <ActivityIndicator color={colors.background.paper} />
              </View>
            ) : (
              <Button title={t('user_price.submit')} onPress={gonder} style={styles.footerBtn} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...typography.styles.h4, color: colors.text.primary },
  subtitle: { ...typography.styles.caption, color: colors.text.secondary },
  body: { padding: spacing.lg, gap: spacing.sm },
  label: { ...typography.styles.body2, color: colors.text.secondary, fontWeight: '600' },
  storeRow: { gap: spacing.xs, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  storeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.default,
  },
  storeChipOn: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  storeChipText: { ...typography.styles.body2, color: colors.text.primary },
  storeChipTextOn: { color: colors.background.paper, fontWeight: '700' },
  error: { ...typography.styles.body2, color: colors.error.main },
  note: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', marginTop: spacing.xs },
  noteText: { ...typography.styles.caption, color: colors.text.hint, flex: 1, lineHeight: 16 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerBtn: { flex: 1 },
  loadingBox: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
