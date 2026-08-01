/**
 * 🚧 Sürüm politikası servisi.
 *
 * KİMLİK DOĞRULAMASIZ ve axios interceptor'ından BAĞIMSIZ: bu kontrol giriş
 * ekranından önce, uygulama daha açılırken çalışıyor. Paylaşılan istemci
 * 401'de token yenilemeye kalkar ve oturumu olmayan kullanıcıda gereksiz bir
 * zincir başlatırdı.
 */
import { Platform } from 'react-native';
import { API_BASE_URL } from '../constants/api';
import type { VersionPolicy } from '../utils/updateGate';

/** Açılışı geciktirmemek için kısa zaman aşımı. */
const TIMEOUT_MS = 6000;

export const appVersionService = {
  /**
   * Sunucudan politikayı çeker.
   *
   * Hata durumunda `null` döner ve kapı AÇIK kalır — sunucuya ulaşamamak
   * kullanıcıyı uygulamadan dışarıda bırakmak için bir sebep değil.
   */
  async getPolicy(): Promise<VersionPolicy | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        `${API_BASE_URL}/app/version?platform=${Platform.OS === 'ios' ? 'ios' : 'android'}`,
        { signal: controller.signal },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: VersionPolicy };
      const data = body.data;
      if (!data || typeof data.storeUrl !== 'string') return null;
      return {
        minSupported: data.minSupported ?? '',
        latest: data.latest ?? '',
        storeUrl: data.storeUrl,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },
};
