/**
 * 📢 Reklam bağlamı — WEB SÜRÜMÜ: SDK yok, rıza akışı yok.
 *
 * NEDEN AYRI DOSYA: `react-native-google-mobile-ads` NATIVE-ONLY ve web
 * paketlemesini tamamen düşürüyor (bkz. `components/ads/CheepBanner.web.tsx`
 * içindeki ayrıntılı açıklama). Native dosyadaki `await import(...)` bir
 * çözüm DEĞİL: Metro dinamik import'u da statik olarak çözümleyip modülü
 * grafiğe alıyor.
 *
 * `canRequestAds: false` sabit — web'de banner zaten `CheepBanner.web.tsx`
 * ile hiç çizilmiyor; bu değer arayüzün geri kalanı için tutarlı kalsın diye
 * var.
 */
import React, { createContext, useContext, type ReactNode } from 'react';

interface AdsValue {
  canRequestAds: boolean;
  /** Native tarafla imza eşliği için var; web'de daima false. */
  testAds: boolean;
  setTestAds: (v: boolean) => void;
}

const SABIT: AdsValue = { canRequestAds: false, testAds: false, setTestAds: () => {} };

const Ctx = createContext<AdsValue>(SABIT);

export function AdsProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={SABIT}>{children}</Ctx.Provider>;
}

export function useAds(): AdsValue {
  return useContext(Ctx);
}
