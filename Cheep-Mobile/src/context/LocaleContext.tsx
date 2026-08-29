import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { countryStorage } from '../utils/storage';

export const COUNTRY_CONFIG: Record<string, { currency: string; symbol: string; locale: string }> = {
  TR: { currency: 'TRY', symbol: '₺', locale: 'tr-TR' },
  CH: { currency: 'CHF', symbol: 'CHF', locale: 'de-CH' },
  SE: { currency: 'SEK', symbol: 'kr', locale: 'sv-SE' },
  DE: { currency: 'EUR', symbol: '€', locale: 'de-DE' },
  PL: { currency: 'PLN', symbol: 'zł', locale: 'pl-PL' },
  // Hırvatistan 2023'te euro'ya geçti — kuna (HRK) ARTIK KULLANILMIYOR.
  HR: { currency: 'EUR', symbol: '€', locale: 'hr-HR' },
  // Forint'in pratikte kuruşu yok; Intl `HUF` için zaten 0 ondalık kullanır.
  HU: { currency: 'HUF', symbol: 'Ft', locale: 'hu-HU' },
  RO: { currency: 'RON', symbol: 'lei', locale: 'ro-RO' },
};
const DEFAULT_CODE = 'TR';
const cfg = (code: string) => COUNTRY_CONFIG[code] ?? COUNTRY_CONFIG[DEFAULT_CODE];

interface LocaleValue {
  country: string;
  setCountry: (code: string) => Promise<void>;
  formatMoney: (n: number) => string;
  formatNumber: (n: number) => string;
  formatDate: (d: Date | string) => string;
}
const LocaleContext = createContext<LocaleValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<string>(DEFAULT_CODE);

  useEffect(() => { countryStorage.getCountry().then(c => { if (c && COUNTRY_CONFIG[c]) setCountryState(c); }); }, []);

  // useCallback: context tüketicileri (ör. LocationContext) bu fonksiyonun kimliğine
  // bağımlı efektler kurabiliyor. Kararsız bir kimlik, her render'da o efektleri
  // gereksiz yere yeniden tetikler.
  const setCountry = useCallback(async (code: string) => {
    const c = code.toUpperCase();
    // Sadece DOĞRULANMIŞ kodu sakla — geçersiz kod x-country header'ına sızmasın.
    const valid = COUNTRY_CONFIG[c] ? c : DEFAULT_CODE;
    setCountryState(valid);
    await countryStorage.saveCountry(valid);
  }, []);

  const formatMoney = useCallback((n: number) => {
    const { currency, locale } = cfg(country);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${cfg(country).symbol}${n.toFixed(2)}`;
    }
  }, [country]);
  const formatNumber = useCallback((n: number) => {
    try { return new Intl.NumberFormat(cfg(country).locale).format(n); } catch { return String(n); }
  }, [country]);
  const formatDate = useCallback((d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    try { return new Intl.DateTimeFormat(cfg(country).locale).format(date); } catch { return date.toISOString().slice(0, 10); }
  }, [country]);

  // useMemo: value nesnesi her render'da yeniden yaratılmasın — aksi halde tüm
  // tüketiciler (referans eşitliğine bakan React.memo/useEffect dahil) her
  // country değişiminde gereksiz yeniden render/efekt tetiklenmesi yaşar.
  const value = useMemo(
    () => ({ country, setCountry, formatMoney, formatNumber, formatDate }),
    [country, setCountry, formatMoney, formatNumber, formatDate],
  );

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
