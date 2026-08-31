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
  /** Teklif çekilmeye çalışıldı ve BAŞARISIZ oldu → arayüz "yeniden dene" sunar. */
  offeringFailed: boolean;
  loading: boolean;
  /**
   * Premium durumu EN AZ BİR KEZ belirlendi mi? (başarılı ya da başarısız)
   *
   * `loading` bu soruyu YANITLAMIYOR ve yerine kullanılamaz: `loading` false
   * olarak başlıyor, yani "henüz hiç sorulmadı" ile "soruldu, cevap hayır"
   * aynı görünüyor. AdsContext bu ayrımı yapmak zorunda — premium durumu
   * bilinmeden reklam SDK'sını başlatmak, abonenin cihazında reklam SDK'sı
   * çalıştırmak demek ve kullanıcı tam olarak bunun OLMAMASI için ödedi.
   */
  resolved: boolean;
  /** Satın alma/geri yükleme sürüyor. */
  busy: boolean;
  refresh: () => Promise<BillingStatus | null>;
  /** Teklifi yeniden çeker (paywall'daki "yeniden dene"). */
  reloadOffering: () => Promise<void>;
  buy: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  /** Teklif çekilmeye çalışıldı mı? (çekilemediyse "yeniden dene" gösterilir) */
  const [offeringFailed, setOfferingFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  /** bkz. PremiumContextType.resolved */
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Backend'i doğruluk kaynağı sayarak durumu tazeler. */
  const refresh = useCallback(async (): Promise<BillingStatus | null> => {
    if (!isAuthenticated) { setStatus(null); return null; }
    try {
      setLoading(true);
      // sync RevenueCat'e gider; ulaşılamazsa backend kayıtlı durumu döner.
      const next = await billingService.sync();
      setStatus(next);
      return next;
    } catch (e) {
      // Ağ hatası premium rozetini düşürmemeli; elimizdeki değer kalsın.
      // DÖNÜŞ null: çağıran (buy) "doğrulanamadı" ile "premium değil"i
      // ayırt edebilsin.
      console.warn('Abonelik durumu alınamadı:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Oturum değişince RevenueCat kimliğini eşitle ve durumu çek.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // `resolved` HER YOLDA true olmalı — `finally` tam olarak bunun için.
      //
      // Önceden `configurePurchases()` ve `identifyUser()` korumasız
      // bekleniyordu. İkisi de RevenueCat SDK'sına gidiyor ve fırlatabiliyor
      // (anahtar yok, mağaza yok, ağ yok, emülatör). Fırlatınca aşağıdaki
      // `setResolved(true)` HİÇ çalışmıyordu; `resolved` sonsuza dek false
      // kalıyor, `AdsContext` onu beklediği için reklam SDK'sı hiç
      // başlamıyor ve tek bir reklam isteği bile çıkmıyordu.
      //
      // Hatanın kötü tarafı sessiz olması: ekranda banner'ın olmaması ile
      // "dolum gelmedi" ayırt edilemiyor, kullanıcı uygulamayı normal
      // kullanmaya devam ediyor ve gelir sıfır kalıyor.
      try {
        if (!isAuthenticated || !user) {
          await forgetUser();
          // Oturum yok → çözülecek bir abonelik de yok; bu DA bir cevap.
          if (!cancelled) { setStatus(null); setOffering(null); }
          return;
        }
        await configurePurchases();
        await identifyUser(user.id);
        if (cancelled) return;
        // `refresh` kendi hatasını yutuyor; başarısızlıkta da devam edilir ve
        // durum "premium değil" olarak belirlenir.
        await refresh();
        if (!cancelled) await loadOffering();
      } catch (e) {
        console.warn('Abonelik kurulumu tamamlanamadı:', e);
      } finally {
        if (!cancelled) setResolved(true);
      }
    })();
    return () => { cancelled = true; };
    // Bilerek yalnizca user.id: kullanicinin adi/dili degisince RevenueCat
    // kimligini ve abonelik sorgusunu bastan calistirmanin anlami yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, refresh]);

  /**
   * Mağaza teklifini çeker.
   *
   * NEDEN AYRI VE YENİDEN ÇAĞRILABİLİR: eskiden oturum başına TEK KEZ, sessiz
   * bir `setOffering(await getCurrentOffering())` vardı. Çağrı bir kez
   * başarısız olursa (zayıf bağlantı, mağaza gecikmesi) `available` oturum
   * boyunca `false` kalıyor ve premium'a giden BÜTÜN yüzeyler yok oluyordu:
   * profil kartı çizilmiyor, asistan limit afişindeki yükseltme gizleniyor,
   * paywall "şu anda kullanılamıyor" diyordu. Kullanıcının tek çaresi
   * uygulamayı öldürüp açmaktı.
   */
  const loadOffering = useCallback(async (): Promise<void> => {
    try {
      const o = await getCurrentOffering();
      setOffering(o);
      setOfferingFailed(!o?.availablePackages?.length);
    } catch (e) {
      console.warn('Teklif alınamadı:', e);
      setOffering(null);
      setOfferingFailed(true);
    }
  }, []);

  const buy = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    setBusy(true);
    try {
      await purchasePackage(pkg);
      // Mağaza "tamam" dedi; hakkı backend'den doğrula.
      //
      // `refresh()` KENDİ hatasını yutuyor (ağ hatası premium rozetini
      // düşürmesin diye — orada doğru). Ama satın alma akışında bu, ÖDEME
      // ALINMIŞ ama hak senkronlanamamışken `true` dönmek demekti: ekran
      // "teşekkürler" deyip geri gidiyor, kullanıcı hâlâ ücretsiz katman
      // sınırını görüyordu. Bu yüzden burada durumu AÇIKÇA sınıyoruz.
      const after = await refresh();
      if (!after?.isPremium) {
        // Bir kez daha dene: RevenueCat webhook'u backend'e ulaşana kadar
        // kısa bir gecikme olabilir.
        await new Promise((r) => setTimeout(r, 1500));
        const retry = await refresh();
        if (!retry?.isPremium) return false;
      }
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
    /** Teklif çekilemedi — arayüz "yeniden dene" sunmalı. */
    offeringFailed,
    loading,
    resolved,
    busy,
    refresh,
    reloadOffering: loadOffering,
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
