/**
 * 🔌 API Configuration
 * Backend endpoint'leri ve configuration
 */

// Backend URL — EXPO_PUBLIC_API_URL ile override edilebilir.
// Expo, EXPO_PUBLIC_* ile başlayan değişkenleri build/runtime'da otomatik inline eder.
// Android emülatöründe localhost yerine 10.0.2.2, fiziksel cihazda bilgisayarın LAN IP'sini kullanın.
//
// Release/production build'lerde EXPO_PUBLIC_API_URL ZORUNLUDUR: tanımsızsa
// placeholder bir URL'e sessizce düşmek yerine başlangıçta gürültülü hata veririz.
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  if (__DEV__) {
    return 'http://localhost:3000/api/v1';
  }
  throw new Error(
    'EXPO_PUBLIC_API_URL tanımlı değil. Production build için bu ortam değişkeni zorunludur.'
  );
}

export const API_BASE_URL = resolveApiBaseUrl();

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    VERIFY_EMAIL: '/auth/verify-email',
    RESEND_VERIFICATION: '/auth/resend-verification',
  },

  // Bildirimler (fiyat düşüşü) + push token
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: (id: number) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/read-all',
    PUSH_TOKEN: '/notifications/push-token',
    PUSH_TOKEN_REMOVE: '/notifications/push-token/remove',
  },

  // Destek / iletişim (giriş zorunlu değil)
  SUPPORT: {
    CONTACT: '/support/contact',
  },

  // Affiliate
  AFFILIATES: {
    CLICK: '/affiliates/click',
  },

  // Users
  USERS: {
    ME: '/users/me',
    UPDATE_PROFILE: '/users/me',
    FAVORITE_STORES: '/users/me/favorite-stores',
    ADD_FAVORITE: (storeId: number) => `/users/me/favorite-stores/${storeId}`,
    REMOVE_FAVORITE: (storeId: number) => `/users/me/favorite-stores/${storeId}`,
  },

  // Products
  PRODUCTS: {
    ALL: '/products',
    BY_ID: (id: number) => `/products/${id}`,
    PRICES: (id: number) => `/products/${id}/prices`,
    HISTORY: (id: number) => `/products/${id}/history`,
  },

  // Stores
  STORES: {
    ALL: '/stores',
    BY_ID: (id: number) => `/stores/${id}`,
    NEARBY: '/stores/nearby',
  },

  // Categories
  CATEGORIES: {
    ALL: '/categories',
    TREE: '/categories/tree',
    PARENT: '/categories/parent',
    BY_ID: (id: number) => `/categories/${id}`,
    BY_SLUG: (slug: string) => `/categories/slug/${slug}`,
    SUBCATEGORIES: (id: number) => `/categories/${id}/subcategories`,
  },

  // Lists
  LISTS: {
    ALL: '/lists',
    BY_ID: (id: number) => `/lists/${id}`,
    CREATE: '/lists',
    UPDATE: (id: number) => `/lists/${id}`,
    DELETE: (id: number) => `/lists/${id}`,
    
    // Items
    ADD_ITEM: (id: number) => `/lists/${id}/items`,
    UPDATE_ITEM: (listId: number, itemId: number) => `/lists/${listId}/items/${itemId}`,
    DELETE_ITEM: (listId: number, itemId: number) => `/lists/${listId}/items/${itemId}`,
    
    // Compare
    COMPARE: (id: number) => `/lists/${id}/compare`,

    // Lifecycle (unified list model)
    ACTIVATE: (id: number) => `/lists/${id}/activate`,
    CLONE: (id: number) => `/lists/${id}/clone`,
    IMPORT: (id: number) => `/lists/${id}/import`,
  },

  // Feedback
  FEEDBACK: {
    CREATE: '/feedback',
    MY: '/feedback/my',
    BY_PRICE: (storePriceId: number) => `/feedback/price/${storePriceId}`,
    STATS: (storePriceId: number) => `/feedback/price/${storePriceId}/stats`,
    DELETE: (id: number) => `/feedback/${id}`,
  },
} as const;

// Request timeout — sıradan REST çağrıları için.
export const API_TIMEOUT = 10000; // 10 saniye

/**
 * ASİSTAN mesajları için ayrı, çok daha uzun zaman aşımı.
 *
 * NEDEN AYRI: asistan bir REST çağrısı değil, araç çağıran bir LLM döngüsü —
 * model çağrısı + katalog sorgusu + listeye yazma + ikinci model çağrısı.
 * Üretimde gerçek kullanıcı mesajlarıyla ÖLÇÜLEN süreler: 33,8 sn / 25,4 sn /
 * 18,0 sn / 12,9 sn. Yani 10 saniyelik ortak zaman aşımıyla, asistanın
 * GERÇEKTEN İŞ YAPAN mesajları (araç çağıranlar) istemcide sistematik olarak
 * düşüyordu: kullanıcı hata görüyor, oysa sunucu isteği tamamlıyor ve
 * günlük kotadan (ücretsizde 5/gün) bir mesaj eksiliyordu. Ücretli katman
 * TAM OLARAK bu kotayı sattığı için hata doğrudan gelire dokunuyor.
 *
 * 90 sn, ölçülen en kötü sürenin (33,8 sn) yaklaşık 2,5 katı — model yavaş
 * olduğunda değil, GERÇEKTEN takıldığında düşsün diye.
 */
export const ASSISTANT_TIMEOUT = 90000; // 90 saniye

// Retry configuration
export const API_RETRY_CONFIG = {
  retries: 3,
  retryDelay: 1000, // 1 second
};

