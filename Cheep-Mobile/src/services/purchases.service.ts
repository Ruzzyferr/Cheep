/**
 * 💳 RevenueCat sarmalayıcısı
 *
 * SDK ile konuşan TEK yer burasıdır; ekranlar `PremiumContext` üzerinden erişir.
 *
 * İki tasarım kuralı:
 *  1. Anahtar yoksa uygulama ÇALIŞMAYA DEVAM EDER. Satın alma bir eklenti;
 *     yapılandırma eksikliği fiyat karşılaştırmayı çökertmemeli.
 *  2. RevenueCat kullanıcı kimliği = backend kullanıcı id'si. Böylece webhook'un
 *     taşıdığı `app_user_id` doğrudan bizim kullanıcımızı gösterir, anonim
 *     kimlik yetimliği ve cihaz değişiminde hak kaybı yaşanmaz.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

/** RevenueCat'te tanımlı tek hak. Backend ile aynı dize olmalı. */
export const PREMIUM_ENTITLEMENT = 'premium';

type RcConfig = { iosApiKey?: string; androidApiKey?: string };
const rc: RcConfig = (Constants.expoConfig?.extra as any)?.revenuecat ?? {};

/** Yayımlanabilir SDK anahtarı — gizli değildir, uygulamayla birlikte dağıtılır. */
const apiKey = Platform.select({ ios: rc.iosApiKey, android: rc.androidApiKey, default: undefined });

/** Satın alma bu derlemede kullanılabilir mi? */
export const purchasesAvailable = (): boolean => Boolean(apiKey);

let configured = false;

/** SDK'yı bir kez kurar. Anahtar yoksa sessizce atlar. */
export async function configurePurchases(): Promise<boolean> {
  if (configured) return true;
  if (!apiKey) return false;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    configured = true;
    return true;
  } catch (e) {
    console.warn('RevenueCat yapılandırılamadı:', e);
    return false;
  }
}

/** Oturum açan kullanıcıyı RevenueCat'e tanıtır. */
export async function identifyUser(userId: number): Promise<CustomerInfo | null> {
  if (!(await configurePurchases())) return null;
  try {
    const { customerInfo } = await Purchases.logIn(String(userId));
    return customerInfo;
  } catch (e) {
    console.warn('RevenueCat logIn başarısız:', e);
    return null;
  }
}

/** Çıkışta kimliği bırakır. Zaten anonimse SDK hata atar — yutuyoruz. */
export async function forgetUser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* zaten anonim */
  }
}

/** Varsayılan teklif paketi (aylık + yıllık). */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!(await configurePurchases())) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn('RevenueCat teklifleri alınamadı:', e);
    return null;
  }
}

export class PurchaseCancelled extends Error {}

/**
 * Satın alma akışını başlatır.
 * Kullanıcı vazgeçerse `PurchaseCancelled` fırlatır — bu bir hata değildir,
 * çağıran taraf uyarı göstermemelidir.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (e: any) {
    if (e?.userCancelled) throw new PurchaseCancelled('kullanıcı vazgeçti');
    throw e;
  }
}

/** Apple ve Google'ın zorunlu tuttuğu "satın alımları geri yükle". */
export async function restorePurchases(): Promise<CustomerInfo | null> {
  if (!(await configurePurchases())) return null;
  return Purchases.restorePurchases();
}

/** Müşteri bilgisinde premium hakkı aktif mi? */
export function hasPremium(info: CustomerInfo | null | undefined): boolean {
  return Boolean(info?.entitlements?.active?.[PREMIUM_ENTITLEMENT]);
}
