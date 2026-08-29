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
  createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { usePremium } from './PremiumContext';

interface AdsValue {
  /** Reklam isteği atılabilir mi? (rıza alındı + SDK hazır + premium değil) */
  canRequestAds: boolean;
}

const Ctx = createContext<AdsValue>({ canRequestAds: false });

export function AdsProvider({ children }: { children: ReactNode }) {
  const { isPremium, resolved: premiumResolved } = usePremium();
  const [ready, setReady] = useState(false);
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
    () => ({ canRequestAds: ready && !isPremium }),
    [ready, isPremium],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAds(): AdsValue {
  return useContext(Ctx);
}
