/**
 * 📢 Reklam rızası + SDK yaşam döngüsü.
 *
 * İKİ ŞEYİ SIRAYLA yapar ve sıra ihlal edilemez:
 *   1. UMP (User Messaging Platform) rıza akışı — AB'de reklam isteği
 *      atmadan ÖNCE rıza toplanmak zorunda. Cheep'in dört yeni pazarının
 *      (HR/HU/RO + PL) tamamı AB, yani bu istisna değil ana yol.
 *   2. Rıza çözüldükten SONRA Mobile Ads SDK'sını başlat.
 *
 * PREMIUM KULLANICIDA SDK HİÇ BAŞLATILMAZ. Yalnızca banner'ı gizlemek yeterli
 * olmazdı: SDK başlatmanın kendisi veri topluyor ve kullanıcı tam olarak
 * "reklamsız" için ödedi. Bu yüzden premium durumu ÇÖZÜLENE KADAR (loading)
 * bekleniyor — yükleme sırasındaki geçici `isPremium: false` ile SDK'yı
 * başlatmak, abonenin cihazında reklam SDK'sı çalıştırmak olurdu.
 *
 * HATA DURUMU SESSİZ ve GÜVENLİ: rıza akışı ya da SDK başlatma patlarsa
 * `canRequestAds` false kalır → hiçbir banner gösterilmez. Reklam, uygulamanın
 * çalışması için gerekli DEĞİL; bir reklam hatasının fiyat karşılaştırmasını
 * bozmasına asla izin verilmemeli.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { usePremium } from './PremiumContext';
import { storage, STORAGE_KEYS } from '../utils/storage';

interface AdsValue {
  /** Reklam isteği atılabilir mi? (rıza alındı + SDK hazır + premium değil) */
  canRequestAds: boolean;
  /**
   * Tanılama kipi: banner'lar Google'ın TEST birimlerini kullanır.
   *
   * NEDEN VAR: "reklam görünmüyor"un iki ayrı sebebi ekranda AYNI görünüyor —
   * entegrasyon bozuk olabilir ya da Google o an dolum vermemiş olabilir.
   * İkisini ayırmanın tek güvenilir yolu, dolumu garanti olan test birimini
   * istemek. Test reklamı HER ZAMAN gelir; gelmiyorsa hata bizdedir.
   *
   * Gizli: yalnızca Profil'de sürüm satırına arka arkaya dokunarak açılıyor,
   * cihazda kalıcı ve gerçek gelir üretmez.
   */
  testAds: boolean;
  setTestAds: (v: boolean) => void;
}

const Ctx = createContext<AdsValue>({ canRequestAds: false, testAds: false, setTestAds: () => {} });

export function AdsProvider({ children }: { children: ReactNode }) {
  const { isPremium, resolved: premiumResolved } = usePremium();
  const [ready, setReady] = useState(false);
  const [testAds, setTestAdsState] = useState(false);

  // Diskteki tanılama bayrağını oku (bir kez).
  useEffect(() => {
    let alive = true;
    storage.getItem(STORAGE_KEYS.DEBUG_TEST_ADS)
      .then((v) => { if (alive && v === 'on') setTestAdsState(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const setTestAds = useCallback((v: boolean) => {
    setTestAdsState(v);
    (v
      ? storage.setItem(STORAGE_KEYS.DEBUG_TEST_ADS, 'on')
      : storage.removeItem(STORAGE_KEYS.DEBUG_TEST_ADS)
    ).catch(() => {});
  }, []);
  /** Bir kez başlatıldıysa tekrar başlatma (SDK idempotent değil sayılır). */
  const startedRef = useRef(false);

  useEffect(() => {
    // Premium durumu henüz bilinmiyor → BEKLE. Aceleyle başlatmak, abonenin
    // cihazında reklam SDK'sı çalıştırmak demek.
    //
    // BURADA ÖNCE `loading` KULLANILIYORDU VE BEKLEME HİÇ GERÇEKLEŞMİYORDU:
    // `loading` false olarak başlıyor, yani ilk render'da bu koşul zaten
    // geçiliyor, `startedRef` kilitleniyor ve SDK premium abonede de
    // başlatılıyordu. `resolved` "en az bir kez belirlendi" demek.
    if (!premiumResolved) return;
    // Abone → SDK'ya hiç dokunma.
    if (isPremium) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let alive = true;
    (async () => {
      try {
        // Dinamik import: paket native ve premium kullanıcıda hiç
        // yüklenmemeli; ayrıca test ortamında (vitest, native yok) modülün
        // en tepede import edilmesi tüm dosyayı çökertirdi.
        const { default: mobileAds, AdsConsent } = await import('react-native-google-mobile-ads');

        // UMP: gerekiyorsa formu gösterir, gerekmiyorsa hemen döner.
        // `gatherConsent` AB dışında da güvenli — orada "gerekli değil" der.
        const info = await AdsConsent.gatherConsent();
        if (!alive) return;
        if (!info.canRequestAds) return;

        await mobileAds().initialize();
        if (alive) setReady(true);
      } catch {
        // Rıza formu kapatıldı, ağ yok, SDK başlatılamadı… Hepsinde sonuç
        // aynı ve doğru: reklam yok, uygulama normal çalışır.
      }
    })();

    return () => { alive = false; };
  }, [isPremium, premiumResolved]);

  const value = useMemo<AdsValue>(
    () => ({ canRequestAds: ready && !isPremium, testAds, setTestAds }),
    [ready, isPremium, testAds, setTestAds],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAds(): AdsValue {
  return useContext(Ctx);
}
