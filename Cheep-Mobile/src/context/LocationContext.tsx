/**
 * 📍 Alışveriş çapasının tek sahibi.
 *
 * Sıra ÖNEMLİ: önce izin kapısı, sonra GPS. Kapı ayrı bir yerde koşsaydı, provider
 * aynı anda getUserLocation() çağırıp ikinci bir rıza diyaloğu açabilirdi.
 *
 * Yalnızca ana uygulamada çalışır (auth + doğrulama + onboarding + intro tamam) —
 * onboarding'in kendi konum-rıza istemiyle çakışmasın.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { useLocale } from './LocaleContext';
import { getUserLocation, reverseGeocodeCountry } from '../utils/geo';
import { runLocationGate } from '../utils/locationGate';
import {
  anchorStorage, resolveAnchor, type PinnedAnchor, type ShoppingAnchor,
} from '../utils/anchor';
import { countryStorage } from '../utils/storage';
import { userService } from '../services';

interface LocationValue {
  /** null = henüz çözülmedi (ilk render). */
  anchor: ShoppingAnchor | null;
  refresh: () => Promise<void>;
  pin: (p: PinnedAnchor) => Promise<void>;
  unpin: () => Promise<void>;
  /** Otomatik ülke geçişi olduysa yeni ülke kodu — şerit bunu gösterir. */
  countryChangedTo: string | null;
  dismissCountryNotice: () => void;
}

const Ctx = createContext<LocationValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, emailVerified, onboardingDone, introSeen } = useAuth();
  const { setCountry } = useLocale();

  const [anchor, setAnchor] = useState<ShoppingAnchor | null>(null);
  const [countryChangedTo, setCountryChangedTo] = useState<string | null>(null);

  const enabled = isAuthenticated && emailVerified && onboardingDone && introSeen;
  const runningRef = useRef(false);
  // Bir refresh() çalışırken gelen ikinci bir istek burada "beklemede" işaretlenir.
  const pendingRef = useRef(false);
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  // setCountry'yi ref'te tutuyoruz ki refresh'in kimliği ona bağımlı olmasın.
  // LocaleProvider artık kendi value'sunu memoize ediyor, ama bu provider'ın
  // doğruluğu başka bir context'in kimlik kararlılığına güvenmemeli: kararsız
  // bir setCountry, refresh'i yeniden yaratır → mount efekti yeniden tetiklenir
  // → GPS'ten gelen konum, kullanıcının az önce elle seçtiği ülkeyi sessizce ezer.
  const setCountryRef = useRef(setCountry);
  setCountryRef.current = setCountry;

  const refresh = useCallback(async () => {
    if (runningRef.current) {
      // Zaten süren bir refresh() var. Bunu ESKİDEN sessizce DÜŞÜRÜYORDUK — bu
      // yanlıştı: refresh() yalnızca depodaki (storage) durumu okuyup anchor'ı
      // yayınlıyor, depoya yazmıyor. pin()/unpin() önce depoya yazar, SONRA
      // refresh() çağırır ("last write wins" depo için doğru). Ama eğer bu ikinci
      // refresh() çağrısı düşürülürse, sürmekte olan eski refresh() kendi (artık
      // bayat) okumasıyla state'i günceller ve depodaki GERÇEK/güncel durumu bir
      // daha hiç yayınlamayabilir — anchor, storage ile kalıcı olarak uyuşmaz hale
      // gelir (örn. unpin() sonrası ekranda hâlâ terk edilmiş pin görünür). Bunun
      // yerine DÜŞÜRMEK değil BİRLEŞTİRMEK (coalesce) doğru olan: "bitince bir kez
      // daha, en güncel depo durumunu okuyarak koş" diye işaretliyoruz. Üçüncü,
      // dördüncü... istek de aynı bayrağı işaretler; art arda değil TEK bir
      // sondaki (trailing) koşum yeterlidir, çünkü o koşum depoyu YENİDEN OKUR ve
      // dolayısıyla en son gerçeği yayınlar. Bu birleştirme garantisi bir geçişin
      // İÇİNDE fırlayan hatalara karşı da geçerlidir: her geçiş kendi try/catch'i
      // içinde çalışır (aşağıda), o yüzden bir geçiş patlasa bile pendingRef
      // TERK EDİLMEZ — döngü while(pendingRef) koşulunu kontrol etmeye devam eder.
      // Bunun garanti ETMEDİĞİ şey: patlayan geçişin kendisinin başarıyla
      // tamamlanması ya da yeniden denenmesi — o geçiş sessizce yutulur, anchor
      // bir önceki bilinen durumda kalır; garanti edilen yalnızca SONRAKİ
      // (trailing) koşumun terk edilmemesidir.
      pendingRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      do {
        pendingRef.current = false;
        try {
          const mode = await anchorStorage.getMode();
          const pinned = await anchorStorage.getPinned();
          const lastCountry = (await countryStorage.getCountry()) ?? 'TR';

          let gps = null;
          let detectedCountry: string | null = null;
          if (mode !== 'pinned' || !pinned) {
            // Otomatik mod: önce izin kapısı, SONRA konum.
            await runLocationGate();
            gps = await getUserLocation();
            if (gps) detectedCountry = await reverseGeocodeCountry(gps);
          }

          const next = resolveAnchor({
            mode, pinned, gps, detectedCountry, lastCountry, now: Date.now(),
          });
          setAnchor(next);

          if (next.countryCode !== lastCountry) {
            // Ülke kendini güncelledi (kullanıcı seyahat etti ya da pin değişti).
            await setCountryRef.current(next.countryCode);
            setCountryChangedTo(next.countryCode);
            try {
              await userService.updatePreferences({ country_code: next.countryCode });
            } catch {
              /* sunucu tercihi kaydedilemedi — yerel durum yine de doğru */
            }
          }
        } catch {
          // Bu TEK geçiş (pass) beklenmedik biçimde patladı (runLocationGate /
          // getUserLocation / reverseGeocodeCountry vb.). Sessizce yutuyoruz —
          // mevcut anchor olduğu gibi kalır (bir önceki bilinen gerçeği
          // yansıtmaya devam eder); ekstra bir hata UI'ı YOK, bu kasıtlı.
          // Bu try/catch OLMASAYDI, hata do-while döngüsünü doğrudan KESERDİ
          // ve bu geçiş sürerken gelen (aynı bayrağı işaretleyen) eşzamanlı bir
          // refresh() isteği pendingRef.current=true olarak İŞARETLENMİŞ ama
          // hiç KOŞTURULMAMIŞ olurdu — o istek terk edilir, depodaki güncel
          // durum bir sonraki tetikleyiciye (app state değişimi vb.) kadar
          // yayınlanmazdı. Burada yakalayıp yutarak döngünün while(pendingRef)
          // koşulunu kontrol etmeye devam etmesini sağlıyoruz: pending varsa
          // son (trailing) geçiş yine de çalışır ve depoyu yeniden okur.
        }
        // Bu koşum sürerken en az bir yeni refresh() isteği geldiyse (pendingRef
        // tekrar true olduysa), depoyu baştan okuyarak bir kez daha koşuyoruz —
        // bu geçiş patlamış olsa bile (yukarıdaki catch sayesinde).
      } while (pendingRef.current);
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = prevAppState.current;
      prevAppState.current = next;
      // Yalnızca gerçek arka plan → ön geçişinde. 'inactive' → 'active' atlanır:
      // iOS'ta sistem izin modalı uygulamayı inactive yapıp geri getiriyor.
      if (prev === 'background' && next === 'active') refresh();
    });
    return () => sub.remove();
  }, [enabled, refresh]);

  const pin = useCallback(async (p: PinnedAnchor) => {
    await anchorStorage.setPinned(p);
    await refresh();
  }, [refresh]);

  const unpin = useCallback(async () => {
    await anchorStorage.clearPin();
    await refresh();
  }, [refresh]);

  const dismissCountryNotice = useCallback(() => setCountryChangedTo(null), []);

  return (
    <Ctx.Provider
      value={{ anchor, refresh, pin, unpin, countryChangedTo, dismissCountryNotice }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLocationAnchor(): LocationValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocationAnchor must be used within LocationProvider');
  return ctx;
}
