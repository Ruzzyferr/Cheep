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
  const prevAppState = useRef<AppStateStatus>(AppState.currentState);

  // setCountry'yi ref'te tutuyoruz ki refresh'in kimliği ona bağımlı olmasın.
  // LocaleProvider artık kendi value'sunu memoize ediyor, ama bu provider'ın
  // doğruluğu başka bir context'in kimlik kararlılığına güvenmemeli: kararsız
  // bir setCountry, refresh'i yeniden yaratır → mount efekti yeniden tetiklenir
  // → GPS'ten gelen konum, kullanıcının az önce elle seçtiği ülkeyi sessizce ezer.
  const setCountryRef = useRef(setCountry);
  setCountryRef.current = setCountry;

  const refresh = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
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
