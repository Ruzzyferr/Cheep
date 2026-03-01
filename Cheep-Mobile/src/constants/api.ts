/**
 * 🔌 API Configuration
 * Backend endpoint'leri ve configuration
 */

// Backend URL (development)
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:3000/api/v1'
  : 'https://api.cheep.com/api/v1';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
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
    SEARCH: '/products',
    PRICES: (id: number) => `/products/${id}/prices`,
    COMPARE: (id: number) => `/products/${id}/compare-prices`,
  },

  // Stores
  STORES: {
    ALL: '/stores',
    BY_ID: (id: number) => `/stores/${id}`,
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
    USE_ROUTE: (id: number) => `/lists/${id}/use-route`,
    
    // Templates
    TEMPLATES: '/lists/templates/all',
    FROM_TEMPLATE: (templateId: number) => `/lists/templates/${templateId}/create`,
    
    // Completed Lists
    IMPORT_TO_EXISTING: (completedId: number) => `/lists/completed/${completedId}/import-to-existing`,
    CREATE_NEW: (completedId: number) => `/lists/completed/${completedId}/create-new`,
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

// Request timeout
export const API_TIMEOUT = 10000; // 10 seconds

// Retry configuration
export const API_RETRY_CONFIG = {
  retries: 3,
  retryDelay: 1000, // 1 second
};

