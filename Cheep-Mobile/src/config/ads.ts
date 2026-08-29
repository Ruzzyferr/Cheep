/**
 * 📢 Reklam yapılandırması ve GÖSTERİM KARARI.
 *
 * Karar mantığı burada SAF bir fonksiyon olarak duruyor (`shouldShowBanner`)
 * çünkü reklam SDK'sı native — bileşenin içine gömülse hiçbir koşulda test
 * edilemezdi. Oysa yanlış karar pahalı: premium kullanıcıya reklam göstermek
 * ödediği şeyi geri almak, rıza alınmadan istek atmak GDPR ihlali.
 *
 * YERLEŞİM POLİTİKASI — nereye reklam KOYMUYORUZ ve neden:
 *   • Karşılaştırma sonucu ekranı — uygulamanın değerini kanıtladığı an;
 *     oraya reklam koymak tam güven kazanılan anda vergi almak olur.
 *   • Ürün detayındaki fiyat tablosu — reklam FİYAT sanılabilir. Bir fiyat
 *     karşılaştırma uygulamasında bu yalnızca kötü UX değil, tüketiciyi
 *     yanıltma riski.
 *   • Onboarding ve izin ekranları — aktivasyonu düşürür, ayrıca mağaza
 *     inceleme riski.
 * Tam ekran (interstitial) reklam da BİLEREK yok: uygulamada henüz doğal bir
 * "iş bitti" anı yok, ve değer teslim edilmeden gösterilen tam ekran reklam
 * kaldırılma sebeplerinin başında geliyor.
 */
import { Platform } from 'react-native';

/** Banner gösterilen yerler. Yeni yer eklemeden önce yukarıdaki politikayı oku. */
export type AdSlot = 'home' | 'search' | 'list';

/**
 * GOOGLE'IN RESMİ TEST BANNER BİRİMLERİ.
 *
 * Geliştirmede GERÇEK birim kullanmak Google'ın "geçersiz trafik" kuralını
 * ihlal eder ve AdMob hesabının askıya alınmasına yol açar. Bu yüzden gerçek
 * kimlik YOKSA sessizce test birimine düşmüyoruz — bu bilinçli varsayılan.
 */
const TEST_BANNER_UNIT = Platform.select({
  ios: 'ca-app-pub-3940256099942544/2934735716',
  default: 'ca-app-pub-3940256099942544/6300978111',
});

/**
 * Gerçek birim kimlikleri ortam değişkeninden gelir — koda gömülmez.
 *
 * `EXPO_PUBLIC_` öneki şart: değer paketin İÇİNE giriyor ve çalışma anında
 * okunuyor. Sır değil (reklam birimi kimliği zaten istemcide görünür), o
 * yüzden CI'da `EXPO_PUBLIC_API_URL` gibi repo değişkeni olarak tutulmalı.
 *
 * Üçü AYRI birim: AdMob raporları birim bazında kırılıyor, tek birim
 * kullanılsa hangi yerleşimin çalıştığı hiç öğrenilemezdi.
 */
const REAL_UNITS: Record<AdSlot, string | undefined> = {
  home: process.env.EXPO_PUBLIC_ADMOB_BANNER_HOME,
  search: process.env.EXPO_PUBLIC_ADMOB_BANNER_SEARCH,
  list: process.env.EXPO_PUBLIC_ADMOB_BANNER_LIST,
};

/**
 * Bu yerleşim için kullanılacak birim kimliği.
 *
 * Gerçek kimlik tanımlıysa o, değilse Google'ın test birimi. Test birimi
 * gerçek reklam göstermez ve gelir üretmez — yani yapılandırmayı unutmak
 * "sessizce para kaybetmek" olur, "sessizce hesabı kaybetmek" değil. İkisi
 * arasında doğru takas bu.
 */
export function bannerUnitId(slot: AdSlot): string {
  const real = REAL_UNITS[slot]?.trim();
  return real && real.startsWith('ca-app-pub-') ? real : (TEST_BANNER_UNIT as string);
}

/** Gerçek (gelir üreten) birim yapılandırılmış mı? Tanılama/uyarı için. */
export function hasRealAdUnits(): boolean {
  return (Object.keys(REAL_UNITS) as AdSlot[]).every((slot) => {
    const real = REAL_UNITS[slot]?.trim();
    return !!real && real.startsWith('ca-app-pub-');
  });
}

export interface AdGateInput {
  /** Premium abonelik aktif mi? */
  isPremium: boolean;
  /**
   * UMP rıza akışı reklam isteğine izin veriyor mu?
   * AB'de rıza alınmadan istek atmak GDPR ihlali; AB dışında daima true.
   */
  canRequestAds: boolean;
  /** Bu banner daha önce yüklenmeyi denedi ve BAŞARISIZ oldu mu? */
  failed?: boolean;
}

/**
 * Banner gösterilsin mi? (SAF)
 *
 * Sıra önemli değil, hepsi VE ile bağlı — ama her koşulun ayrı bir gerekçesi
 * var ve hiçbiri "iyi olur" değil:
 *   • premium → ödenen şey tam olarak bu; reklam göstermek sözleşmeyi bozar.
 *   • rıza yok → AB'de yasa dışı (dört yeni pazarın hepsi AB).
 *   • yükleme başarısız → boş bir gri kutu bırakmak yerine alanı tamamen
 *     kaldır; kullanıcı hiçbir şey görmez, düzen bozulmaz.
 */
export function shouldShowBanner({ isPremium, canRequestAds, failed }: AdGateInput): boolean {
  if (isPremium) return false;
  if (!canRequestAds) return false;
  if (failed) return false;
  return true;
}
