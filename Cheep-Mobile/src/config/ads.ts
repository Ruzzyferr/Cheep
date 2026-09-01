/**
 * 📢 Reklam yapılandırması ve GÖSTERİM KARARI.
 *
 * Karar mantığı burada SAF bir fonksiyon olarak duruyor (`shouldShowBanner`)
 * çünkü reklam SDK'sı native — bileşenin içine gömülse hiçbir koşulda test
 * edilemezdi. Oysa yanlış karar pahalı: premium kullanıcıya reklam göstermek
 * ödediği şeyi geri almak, rıza alınmadan istek atmak GDPR ihlali.
 *
 * YERLEŞİM POLİTİKASI — nereye reklam KOYMUYORUZ ve neden:
 *   • Karşılaştırma sonucu ve strateji ekranı — uygulamanın değerini
 *     kanıtladığı an; oraya reklam koymak tam güven kazanılan anda vergi
 *     almak olur.
 *   • Ürün detayındaki FİYAT TABLOSUNUN İÇİ — reklam FİYAT sanılabilir. Bir
 *     fiyat karşılaştırma uygulamasında bu yalnızca kötü UX değil, tüketiciyi
 *     yanıltma riski. (Tablonun ALTI serbest: orada reklam bir satır değil,
 *     kendi çerçevesinde ayrı bir blok.)
 *   • Onboarding, giriş/kayıt ve izin ekranları — aktivasyonu düşürür, ayrıca
 *     mağaza inceleme riski.
 *   • Paywall — reklamsızlığı satan ekranda reklam göstermek.
 *   • Market detayı — ekran henüz "yakında" yer tutucusu; içeriği olmayan bir
 *     sayfada tek görünen şey reklam olurdu. Ekran doldurulduğunda burası
 *     yeniden değerlendirilmeli.
 *   • Asistan sohbeti — konuşmanın ortasına giren reklam mesaj sanılır.
 * Tam ekran (interstitial) reklam da BİLEREK yok: uygulamada henüz doğal bir
 * "iş bitti" anı yok, ve değer teslim edilmeden gösterilen tam ekran reklam
 * kaldırılma sebeplerinin başında geliyor.
 *
 * KONUM: her yerleşim, o ekranın İLK içerik bloğundan hemen sonra duruyor —
 * başlığın hemen altında değil (kullanıcı aradığı şeyi önce görmeli), ama
 * sayfanın dibinde de değil. İlk üç yerleşim uzun süre ekranların ALT
 * yarısındaydı; AdMob'da yedi günde 0 gösterim çıkmasının sebeplerinden biri
 * buydu — kullanıcıların çoğu o noktaya hiç inmiyor. Yeni bir yerleşim
 * eklerken kural: ilk kaydırmada görünebilecek kadar yukarıda, ekranın asıl
 * cevabının önüne geçmeyecek kadar aşağıda.
 */
import { Platform } from 'react-native';

/**
 * Banner gösterilen yerler. Yeni yer eklemeden önce yukarıdaki politikayı oku.
 *
 * HER YERLEŞİM AYRI BİR ADMOB BİRİMİ demek (platform başına). Tek birim
 * paylaşılsaydı AdMob raporunda hangi ekranın gelir ürettiği hiç
 * öğrenilemezdi — ve hangi yerleşimin kaldırılacağına karar vermek için
 * gereken tek veri bu.
 *
 * Buraya bir değer eklemek DERLEME HATASI ÜRETİR (`REAL_UNITS` Record'u
 * eksik kalır) — bilerek: ortam değişkeni tanımlanmadan eklenen bir yerleşim
 * sessizce test reklamına düşer, yani gerçek kullanıcıya "Test Ad" yazan bir
 * kutu gösterir ve hiç gelir üretmez.
 */
export type AdSlot =
  | 'home'
  | 'search'
  | 'list'
  /** Ürün detayı — fiyat tablosunun ALTINDA, tablonun içinde değil. */
  | 'detail'
  /** Kategori ürün ızgarası. */
  | 'category'
  /** Listelerim (liste dizini). */
  | 'lists'
  /** Fırsatlar sekmesi. */
  | 'deals';

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
 *
 * PLATFORM BAŞINA AYRI KİMLİK — AdMob birimleri platforma özeldir.
 *
 * Bir Android birimini iOS'ta kullanmak yapılandırma hatasıdır: reklam
 * gelmez, rapor karışır. İlk yazımda tek bir değişken seti vardı ve iki
 * platform aynı kimliği okuyordu; birimler AdMob'da oluşturulunca (Android
 * uygulaması ve iOS uygulaması AYRI kayıtlar) bu hemen görünür oldu.
 *
 * `process.env.X` doğrudan yazılmak ZORUNDA: Expo bu değerleri derleme
 * sırasında METİN OLARAK değiştiriyor. `process.env[degisken]` gibi dinamik
 * bir erişim değiştirilmez ve çalışma anında `undefined` döner — yani
 * kimlikler sessizce kaybolur ve uygulama test reklamına düşer.
 */
const REAL_UNITS: Record<AdSlot, string | undefined> = Platform.select({
  ios: {
    home: process.env.EXPO_PUBLIC_ADMOB_BANNER_HOME_IOS,
    search: process.env.EXPO_PUBLIC_ADMOB_BANNER_SEARCH_IOS,
    list: process.env.EXPO_PUBLIC_ADMOB_BANNER_LIST_IOS,
    detail: process.env.EXPO_PUBLIC_ADMOB_BANNER_DETAIL_IOS,
    category: process.env.EXPO_PUBLIC_ADMOB_BANNER_CATEGORY_IOS,
    lists: process.env.EXPO_PUBLIC_ADMOB_BANNER_LISTS_IOS,
    deals: process.env.EXPO_PUBLIC_ADMOB_BANNER_DEALS_IOS,
  },
  default: {
    home: process.env.EXPO_PUBLIC_ADMOB_BANNER_HOME_ANDROID,
    search: process.env.EXPO_PUBLIC_ADMOB_BANNER_SEARCH_ANDROID,
    list: process.env.EXPO_PUBLIC_ADMOB_BANNER_LIST_ANDROID,
    detail: process.env.EXPO_PUBLIC_ADMOB_BANNER_DETAIL_ANDROID,
    category: process.env.EXPO_PUBLIC_ADMOB_BANNER_CATEGORY_ANDROID,
    lists: process.env.EXPO_PUBLIC_ADMOB_BANNER_LISTS_ANDROID,
    deals: process.env.EXPO_PUBLIC_ADMOB_BANNER_DEALS_ANDROID,
  },
}) as Record<AdSlot, string | undefined>;

/**
 * Bu yerleşim için kullanılacak birim kimliği.
 *
 * Gerçek kimlik tanımlıysa o, değilse Google'ın test birimi. Test birimi
 * gerçek reklam göstermez ve gelir üretmez — yani yapılandırmayı unutmak
 * "sessizce para kaybetmek" olur, "sessizce hesabı kaybetmek" değil. İkisi
 * arasında doğru takas bu.
 */
export function bannerUnitId(slot: AdSlot, forceTest = false): string {
  if (forceTest) return TEST_BANNER_UNIT as string;
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
