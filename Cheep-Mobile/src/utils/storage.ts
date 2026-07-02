/**
 * 💾 Storage Utility
 * Secure storage for tokens and user data
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has no web implementation; on web fall back to localStorage
// so the app (and Playwright-driven web testing) works there too.
const isWeb = Platform.OS === 'web';
const webStore = {
  setItemAsync: async (k: string, v: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  },
  getItemAsync: async (k: string) =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null,
  deleteItemAsync: async (k: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
  },
};
const store = isWeb ? webStore : SecureStore;

// Keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  INTRO_SEEN: 'intro_seen',
  USER_LOCATION: 'user_location',
  USER_COUNTRY: 'user_country',
  FAVORITE_STORES: 'favorite_stores',
  USER_LANGUAGE: 'user_language',
  LOCATION_CONSENT: 'kvkk_location_consent', // KVKK açık rıza: 'granted' | 'denied' | (yok=belirsiz)
} as const;

// Generic storage functions
export const storage = {
  // Save item
  async setItem(key: string, value: string): Promise<void> {
    try {
      await store.setItemAsync(key, value);
    } catch (error) {
      console.error('Storage setItem error:', error);
      throw error;
    }
  },

  // Get item
  async getItem(key: string): Promise<string | null> {
    try {
      return await store.getItemAsync(key);
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  },

  // Remove item
  async removeItem(key: string): Promise<void> {
    try {
      await store.deleteItemAsync(key);
    } catch (error) {
      console.error('Storage removeItem error:', error);
      throw error;
    }
  },

  // Clear all
  async clear(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await Promise.all(keys.map(key => store.deleteItemAsync(key)));
    } catch (error) {
      console.error('Storage clear error:', error);
      throw error;
    }
  },
};

// Auth token functions
export const authStorage = {
  async saveToken(token: string): Promise<void> {
    await storage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    return await storage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async removeToken(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  },

  // Refresh token
  async saveRefreshToken(token: string): Promise<void> {
    await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await storage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async removeRefreshToken(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  // Tüm auth verisini temizle (logout / refresh başarısız)
  async clearAuth(): Promise<void> {
    await Promise.all([
      storage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
      storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      storage.removeItem(STORAGE_KEYS.USER_DATA),
    ]);
  },
};

// User data functions
export const userStorage = {
  async saveUser(user: any): Promise<void> {
    await storage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  },

  async getUser<T = any>(): Promise<T | null> {
    const data = await storage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  },

  async removeUser(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.USER_DATA);
  },
};

// Country functions (konumdan veya kullanıcı seçiminden ISO kod, örn. "TR")
export const countryStorage = {
  async saveCountry(code: string): Promise<void> {
    await storage.setItem(STORAGE_KEYS.USER_COUNTRY, code.toUpperCase());
  },

  async getCountry(): Promise<string | null> {
    return await storage.getItem(STORAGE_KEYS.USER_COUNTRY);
  },
};

// Intro tour ("how to use") — shown once on first launch, cihazda saklanır.
export const introStorage = {
  async hasSeen(): Promise<boolean> {
    return (await storage.getItem(STORAGE_KEYS.INTRO_SEEN)) === '1';
  },
  async markSeen(): Promise<void> {
    await storage.setItem(STORAGE_KEYS.INTRO_SEEN, '1');
  },
};

// Location functions
export const locationStorage = {
  async saveLocation(location: { lat: number; lon: number }): Promise<void> {
    await storage.setItem(STORAGE_KEYS.USER_LOCATION, JSON.stringify(location));
  },

  async getLocation(): Promise<{ lat: number; lon: number } | null> {
    const data = await storage.getItem(STORAGE_KEYS.USER_LOCATION);
    return data ? JSON.parse(data) : null;
  },
};

// KVKK — konum işleme açık rızası (m.5/m.10). Aydınlatmadan AYRI, opt-in, iptal
// edilebilir. Değer: 'granted' | 'denied' | null (henüz karar verilmedi).
export type LocationConsent = 'granted' | 'denied' | null;
export const consentStorage = {
  async getLocationConsent(): Promise<LocationConsent> {
    const v = await storage.getItem(STORAGE_KEYS.LOCATION_CONSENT);
    return v === 'granted' || v === 'denied' ? v : null;
  },
  async setLocationConsent(v: 'granted' | 'denied'): Promise<void> {
    await storage.setItem(STORAGE_KEYS.LOCATION_CONSENT, v);
  },
  async clearLocationConsent(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.LOCATION_CONSENT);
  },
};

// Language functions (UI dili — ülkeden/para biriminden bağımsız kullanıcı tercihi)
export const languageStorage = {
  async save(lang: string): Promise<void> {
    await storage.setItem(STORAGE_KEYS.USER_LANGUAGE, lang);
  },

  async get(): Promise<string | null> {
    return await storage.getItem(STORAGE_KEYS.USER_LANGUAGE);
  },
};

export { STORAGE_KEYS };

