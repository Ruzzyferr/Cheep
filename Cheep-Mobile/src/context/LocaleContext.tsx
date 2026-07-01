import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { countryStorage } from '../utils/storage';

export const COUNTRY_CONFIG: Record<string, { currency: string; symbol: string; locale: string }> = {
  TR: { currency: 'TRY', symbol: '₺', locale: 'tr-TR' },
  CH: { currency: 'CHF', symbol: 'CHF', locale: 'de-CH' },
  SE: { currency: 'SEK', symbol: 'kr', locale: 'sv-SE' },
  DE: { currency: 'EUR', symbol: '€', locale: 'de-DE' },
  PL: { currency: 'PLN', symbol: 'zł', locale: 'pl-PL' },
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

  const setCountry = async (code: string) => {
    const c = code.toUpperCase();
    setCountryState(COUNTRY_CONFIG[c] ? c : DEFAULT_CODE);
    await countryStorage.saveCountry(c);
  };

  const formatMoney = (n: number) => {
    const { currency, locale } = cfg(country);
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
    } catch {
      return `${cfg(country).symbol}${n.toFixed(2)}`;
    }
  };
  const formatNumber = (n: number) => {
    try { return new Intl.NumberFormat(cfg(country).locale).format(n); } catch { return String(n); }
  };
  const formatDate = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    try { return new Intl.DateTimeFormat(cfg(country).locale).format(date); } catch { return date.toISOString().slice(0, 10); }
  };

  return (
    <LocaleContext.Provider value={{ country, setCountry, formatMoney, formatNumber, formatDate }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
