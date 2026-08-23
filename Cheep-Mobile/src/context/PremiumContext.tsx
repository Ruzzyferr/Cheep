/**
 * 👑 Premium Context
 *
 * Abonelik durumunun tek kaynağı. Ekranlar `usePremium()` ile okur.
 *
 * Kural: rozet ve kota BACKEND'den gelir (`billingService`), çünkü kotayı
 * uygulayan da o. RevenueCat SDK'sı yalnızca satın alma/geri yükleme akışını
 * yürütür; işlem biter bitmez backend'e senkron çağrısı atıp gerçeği oradan
 * tazeliyoruz. Böylece istemcinin "ben premium'um" demesi tek başına bir şey
 * ifade etmiyor.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { billingService, type BillingStatus } from '../services/billing.service';
import {
  configurePurchases, identifyUser, forgetUser, purchasesAvailable,
  getCurrentOffering, purchasePackage, restorePurchases, PurchaseCancelled,
} from '../services/purchases.service';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

interface PremiumContextType {
  isPremium: boolean;
  status: BillingStatus | null;
  offering: PurchasesOffering | null;
  /**
   * Gerçekten satın alma yapılabilir mi? Anahtarın varlığı YETMEZ — mağazada
   * tanımlı ürün yoksa teklif boş gelir ve paywall ölü bir ekrana dönüşür.
   * Koşul: anahtar var VE mağazadan gerçek bir teklif geldi.
   */
  available: boolean;
  loading: boolean;
  /** Satın alma/geri yükleme sürüyor. */
  busy: boolean;
  refresh: () => Promise<void>;
  buy: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Backend'i doğruluk kaynağı sayarak durumu tazeler. */
  const refresh = useCallback(async () => {
    if (!isAuthenticated) { setStatus(null); return; }
    try {
      setLoading(true);
      // sync RevenueCat'e gider; ulaşılamazsa backend kayıtlı durumu döner.
      setStatus(await billingService.sync());
    } catch (e) {
      // Ağ hatası premium rozetini düşürmemeli; elimizdeki değer kalsın.
      console.warn('Abonelik durumu alınamadı:', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Oturum değişince RevenueCat kimliğini eşitle ve durumu çek.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated || !user) {
        await forgetUser();
        if (!cancelled) { setStatus(null); setOffering(null); }
        return;
      }
      await configurePurchases();
      await identifyUser(user.id);
      if (cancelled) return;
      await refresh();
      if (!cancelled) setOffering(await getCurrentOffering());
    })();
    return () => { cancelled = true; };
    // Bilerek yalnizca user.id: kullanicinin adi/dili degisince RevenueCat
    // kimligini ve abonelik sorgusunu bastan calistirmanin anlami yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, refresh]);

  const buy = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    setBusy(true);
    try {
      await purchasePackage(pkg);
      // Mağaza "tamam" dedi; hakkı backend'den doğrula.
      await refresh();
      return true;
    } catch (e) {
      if (e instanceof PurchaseCancelled) return false;
      throw e;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const restore = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      await restorePurchases();
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const value: PremiumContextType = {
    isPremium: status?.isPremium ?? false,
    status,
    offering,
    available: purchasesAvailable() && Boolean(offering?.availablePackages?.length),
    loading,
    busy,
    refresh,
    buy,
    restore,
  };

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used within PremiumProvider');
  return ctx;
}
