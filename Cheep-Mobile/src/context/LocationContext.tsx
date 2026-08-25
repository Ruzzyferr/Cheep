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
import { runNotificationGate } from '../utils/notificationGate';
import {
  anchorStorage, resolveAnchor, type PinnedAnchor, type ShoppingAnchor,
} from '../utils/anchor';
import { countryStorage } from '../utils/storage';
import { userService } from '../services';

/**
 * refresh() seçenekleri.
 *
 * silent: true → İZİN KAPISI (runLocationGate) ÇALIŞTIRILMAZ; başka HİÇBİR ŞEY
 * değişmez (depo yine okunur, GPS yine denenir, çapa yine yayınlanır).
 *
 * NEDEN VAR: refresh() pasif bir "yeniden oku" DEĞİLDİR — otomatik modda önce
 * runLocationGate() koşar ve bu kapı ETKİLEŞİMLİDİR (KVKK açık-rıza istemi,
 * gerekçe diyaloğu, OS izin modalı). Profil'deki konum satırından rıza GERİ
 * ALINDIĞINDA çapanın hemen koordinatsız yayınlanması gerekir; ama bunu düz
 * refresh() ile yapmak kapıyı da tetikler ve kullanıcıya AZ ÖNCE geri aldığı
 * rızayı yeniden sorar ("kapattım, hemen tekrar soruyor" — KVKK m.7 / GDPR
 * Art. 7(3): geri almak, vermek kadar kolay olmalı; onaylarsa rıza geri açılır
 * ve ekran "konum işlenmiyor" derken koordinat yeniden işlenir). Aynı şekilde
 * rızayı YENİDEN VERME yolunda ProfileScreen zaten OS iznini kendisi istiyor;
 * kapı ikinci bir gerekçe diyaloğu + ikinci bir sistem modalı açardı.
 *
 * Sessiz geçiş yine DOĞRUDUR: getUserLocation() rıza 'denied' iken kendiliğinden
 * SORMADAN null döner (ensureLocationConsent), yani koordinatsız çapa yayınlanır;
 * rıza + OS izni yeniden verildiyse de GPS normal şekilde okunur.
 *
 * Kapı, uygulama açılışında ve arka plandan dönüşte NORMAL (etkileşimli) koşmaya
 * devam eder — sessiz biçim yalnızca Profil'deki rıza anahtarına özeldir.
 */
export interface RefreshOptions {
  silent?: boolean;
}

interface LocationValue {
  /** null = henüz çözülmedi (ilk render). */
  anchor: ShoppingAnchor | null;
  refresh: (opts?: RefreshOptions) => Promise<void>;
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
  // Beklemede olan isteklerden EN AZ BİRİ sessiz mi istedi? Birleştirilen (trailing)
  // geçiş için sessizlik KAZANIR: diyalog GÖSTERMEMEK her zaman güvenli taraftır —
  // atlanan kapı bir sonraki açılışta/ön plana gelişte zaten yeniden koşar, ama geri
  // alınmış bir rızayı yeniden sormak KVKK ihlalidir (bkz. RefreshOptions).
  const pendingSilentRef = useRef(false);
  /** Bildirim kapısı oturumda bir kez çalışsın (her ön plana gelişte değil). */
  const notificationGateRanRef = useRef(false);
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  // setCountry'yi ref'te tutuyoruz ki refresh'in kimliği ona bağımlı olmasın.
  // LocaleProvider artık kendi value'sunu memoize ediyor, ama bu provider'ın
  // doğruluğu başka bir context'in kimlik kararlılığına güvenmemeli: kararsız
  // bir setCountry, refresh'i yeniden yaratır → mount efekti yeniden tetiklenir
  // → GPS'ten gelen konum, kullanıcının az önce elle seçtiği ülkeyi sessizce ezer.
  const setCountryRef = useRef(setCountry);
  setCountryRef.current = setCountry;

  const refresh = useCallback(async (opts?: RefreshOptions) => {
    const silent = opts?.silent === true;
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
      if (silent) pendingSilentRef.current = true;
      return;
    }
    runningRef.current = true;
    // Bu geçiş sessiz mi? İlk geçiş çağıranın isteğini kullanır; birleştirilen
    // (trailing) geçiş, bu koşum sürerken gelen isteklerden belirlenir (aşağıda).
    let passSilent = silent;
    try {
      do {
        pendingRef.current = false;
        pendingSilentRef.current = false;
        try {
          const mode = await anchorStorage.getMode();
          const pinned = await anchorStorage.getPinned();
          const lastCountry = (await countryStorage.getCountry()) ?? 'TR';

          let gps = null;
          let detectedCountry: string | null = null;
          if (mode !== 'pinned' || !pinned) {
            // Otomatik mod: önce izin kapısı, SONRA konum.
            // SESSİZ geçişte kapı ATLANIR (yalnızca o) — kapı etkileşimlidir ve
            // rıza anahtarından çağrıldığında az önce geri alınan rızayı yeniden
            // sorardı (bkz. RefreshOptions). getUserLocation() rıza yoksa zaten
            // SORMADAN null döner, dolayısıyla çapa doğru (koordinatsız) yayınlanır.
            if (!passSilent) {
              await runLocationGate();
            }
            gps = await getUserLocation();
            if (gps) detectedCountry = await reverseGeocodeCountry(gps);
          }

          // Bildirim kapısı KONUM KAPISINDAN SONRA, ardışık olarak çalışır:
          // ikisi aynı anda tetiklenirse Android üst üste iki sistem modalı
          // gösterir ve kullanıcı ikincisini okumadan kapatır.
          //
          // Neden burada: sıralamayı bilen tek yer burası — konum kapısının
          // ne zaman ÇÖZÜMLENDİĞİNİ başka hiçbir bileşen bilmiyor. Oturumda
          // yalnızca bir kez çalışır; kapının kendi erteleme mantığı zaten
          // tekrar tekrar sormayı engelliyor.
          //
          // OTOMATİK MOD DALININ DIŞINDA: eskiden yukarıdaki
          // `mode !== 'pinned'` bloğunun içindeydi ve şehrini elle sabitlemiş
          // kullanıcıya bildirim izni HİÇ sorulmuyordu — o kullanıcılar için
          // fiyat düşüşü bildirimi kalıcı olarak ölüydü. Konum kipiyle
          // bildirim izninin hiçbir ilgisi yok.
          if (!passSilent && !notificationGateRanRef.current) {
            notificationGateRanRef.current = true;
            void runNotificationGate().catch(() => {});
          }

          const next = resolveAnchor({
            mode, pinned, gps, detectedCountry, lastCountry, now: Date.now(),
          });
          setAnchor(next);

          if (next.countryCode !== lastCountry) {
            // Ülke kendini güncelledi (kullanıcı seyahat etti ya da pin değişti).
            await setCountryRef.current(next.countryCode);
            // ŞERİT yalnızca OTOMATİK modda: metin "X ülkesindesin — X marketlerine
            // geçildi" diyor. Bu ancak ülke kullanıcı GERÇEKTEN oraya gittiği için
            // değiştiyse doğrudur. İzmir'de oturup Varşova'yı sabitleyen kullanıcıya
            // "Polonya'dasın" demek düpedüz yalan olur; üstelik pin'in sonucunu
            // kullanıcı zaten kendi seçtiği için bir bildirime de gerek yok.
            if (next.mode === 'auto') setCountryChangedTo(next.countryCode);
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
        // bu geçiş patlamış olsa bile (yukarıdaki catch sayesinde). Sonraki geçişin
        // sessizliği o bekleyen isteklerden gelir (herhangi biri sessiz istediyse
        // sessiz koşar — bkz. pendingSilentRef).
        passSilent = pendingSilentRef.current;
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
