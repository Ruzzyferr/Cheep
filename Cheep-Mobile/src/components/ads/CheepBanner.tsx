/**
 * 📢 Banner reklam — uygulamadaki TEK reklam biçimi.
 *
 * Tam ekran (interstitial) reklam BİLEREK yok: uygulamada henüz doğal bir
 * "iş bitti" anı yok ve değer teslim edilmeden gösterilen tam ekran reklam,
 * uygulama kaldırma sebeplerinin başında geliyor.
 *
 * DÜZEN DAVRANIŞI — iki kötü seçenek arasından üçüncüsü:
 *   a) Yer önceden ayrılsın → reklam gelmezse kalıcı boş bir boşluk kalır.
 *   b) Yüklenirken gri kutu gösterilsin → kullanıcı bozuk bir şey sanır.
 *   c) (SEÇİLEN) Yüklenene kadar HİÇBİR YER KAPLAMA, yüklenince belir,
 *      başarısız olursa tamamen kaybol.
 * (c) yüklendiği anda küçük bir kaydırma yaratıyor; karşılığında reklam
 * gelmediğinde arayüzde hiçbir iz kalmıyor. Reklamın gelmemesi (rıza yok,
 * premium, ağ yok, envanter yok) İSTİSNA DEĞİL, sık bir durum — o yüzden
 * sessiz kaybolma doğru varsayılan.
 *
 * ETİKETLEME: reklam her zaman kendi çerçevesinde ve ürün kartından görsel
 * olarak AYRI duruyor. Bir fiyat karşılaştırma uygulamasında reklamın "sonuç"
 * sanılması yalnızca kötü UX değil, tüketiciyi yanıltma riski.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../../context/PremiumContext';
import { useAds } from '../../context/AdsContext';
import { bannerUnitId, shouldShowBanner, type AdSlot } from '../../config/ads';
import { colors, spacing } from '../../theme';

interface Props {
  slot: AdSlot;
  /** Üst/alt boşluk — yerleşime göre çağıran ayarlar. */
  style?: object;
}

export function CheepBanner({ slot, style }: Props) {
  const { t } = useTranslation();
  const { isPremium } = usePremium();
  const { canRequestAds } = useAds();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!shouldShowBanner({ isPremium, canRequestAds, failed })) return null;

  return (
    // Yüklenene kadar container BOŞ ve YER KAPLAMIYOR (yükseklik yok, boşluk
    // yok) — `loaded` olmadan hiçbir stil uygulanmıyor.
    <View style={loaded ? [styles.wrap, style] : undefined}>
      {loaded && <Text style={styles.label}>{t('ads.label')}</Text>}
      <BannerAd
        unitId={bannerUnitId(slot)}
        // ANCHORED_ADAPTIVE: yüksekliği cihaz genişliğine göre Google
        // belirliyor. Sabit 320x50 dar telefonlarda taşıyor, geniş
        // ekranlarda küçücük kalıyordu.
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => {
          // Kalıcı olarak kaldır. Yeniden denemek, listede aniden beliren
          // bir reklamla kullanıcının okuduğu yeri kaydırır.
          setFailed(true);
          setLoaded(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    // Reklamın içerikten görsel olarak AYRI durması şart (bkz. dosya başı).
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.light,
  },
  label: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
    marginLeft: spacing.md,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    // `hint` bilerek: bu etiket yasal bir AÇIKLAMA, dekorasyon değil —
    // okunur olmak zorunda. Bu token beyazda 4,51:1 (WCAG AA).
    color: colors.text.hint,
  },
});
