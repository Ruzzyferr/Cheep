/**
 * 💾 Storage Utility
 * Secure storage for tokens and user data
 */

import * as SecureStore from 'expo-secure-store';

// Keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  USER_LOCATION: 'user_location',
  FAVORITE_STORES: 'favorite_stores',
} as const;

// Generic storage functions
export const storage = {
  // Save item
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Storage setItem error:', error);
      throw error;
    }
  },

  // Get item
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  },

  // Remove item
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Storage removeItem error:', error);
      throw error;
    }
  },

  // Clear all
  async clear(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await Promise.all(keys.map(key => SecureStore.deleteItemAsync(key)));
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

export { STORAGE_KEYS };

