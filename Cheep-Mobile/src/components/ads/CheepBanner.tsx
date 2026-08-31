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
import React, { useEffect, useRef, useState } from 'react';
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

/**
 * Bir yüzeyin pes etmeden önce yapacağı deneme sayısı.
 *
 * Reklam isteğinin başarısız olması İSTİSNA DEĞİL: "no fill" (o an envanter
 * yok) tamamen normal ve GEÇİCİ. Tek denemede kalıcı olarak vazgeçmek, bir
 * anlık dolgusuzluğun o yüzeydeki reklamı OTURUM BOYUNCA bitirmesi demekti —
 * emülatörde birebir gözlendi: banner bir açılışta geliyor, sonraki açılışta
 * hiç gelmiyordu ve arayüzde bunun hiçbir izi yoktu.
 *
 * Üst sınır var çünkü sonsuz yeniden deneme, reklam gerçekten gelmeyen bir
 * kullanıcıda (rıza reddi, envanter yok) boşuna pil ve veri harcar.
 */
const MAX_ATTEMPTS = 3;

/** Denemeler arası bekleme — kısa, ama art arda istek yağmuru değil. */
const RETRY_DELAY_MS = 8000;

export function CheepBanner({ slot, style }: Props) {
  const { t } = useTranslation();
  const { isPremium } = usePremium();
  const { canRequestAds, testAds } = useAds();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  /** `key` değişimi BannerAd'i yeniden kurar → yeni istek. */
  const [attempt, setAttempt] = useState(0);
  const attemptsRef = useRef(0);

  // Bileşen ekrandan kalkarken bekleyen zamanlayıcıyı iptal et.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // TANILAMA KİPİ AÇILINCA PES ETME DURUMU SIFIRLANMALI.
  //
  // `failed` true iken bileşen hiç çizilmiyor. Tanılama kipi tam olarak
  // "reklam gelmiyor" durumunda açılacağı için, sıfırlamazsak kip açılır ama
  // ekranda yine hiçbir şey olmaz — yani aracın işe yaradığı tek an
  // çalışmazdı.
  useEffect(() => {
    attemptsRef.current = 0;
    setFailed(false);
    setLoaded(false);
  }, [testAds]);

  if (!shouldShowBanner({ isPremium, canRequestAds, failed })) return null;

  return (
    // Yüklenene kadar container BOŞ ve YER KAPLAMIYOR (yükseklik yok, boşluk
    // yok) — `loaded` olmadan hiçbir stil uygulanmıyor.
    <View style={loaded ? [styles.wrap, style] : undefined}>
      {loaded && <Text style={styles.label}>{t('ads.label')}</Text>}
      <BannerAd
        // `key`: yeniden denemede bileşeni baştan kurup yeni istek attırır.
        // `testAds` de anahtarın parçası: tanılama kipi açılıp kapandığında
        // birim kimliği değişiyor ve BannerAd'in baştan kurulması gerekiyor,
        // yoksa eski birimle yüklenmiş reklam ekranda kalırdı.
        key={`${attempt}-${testAds ? 'test' : 'canli'}`}
        unitId={bannerUnitId(slot, testAds)}
        // ANCHORED_ADAPTIVE: yüksekliği cihaz genişliğine göre Google
        // belirliyor. Sabit 320x50 dar telefonlarda taşıyor, geniş
        // ekranlarda küçücük kalıyordu.
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => {
          setLoaded(false);
          attemptsRef.current += 1;
          if (attemptsRef.current >= MAX_ATTEMPTS) {
            // Pes: bu yüzeyde bir daha denenmiyor ve arayüzde hiçbir iz
            // kalmıyor (yer kaplamıyordu, kaplamayacak).
            setFailed(true);
            return;
          }
          timerRef.current = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
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
