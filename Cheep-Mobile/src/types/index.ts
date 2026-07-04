/**
 * 🔷 TypeScript Types
 * Backend API ile uyumlu type definitions
 */

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: number;
  email: string;
  name: string;
  // Eski kayıtlarda alan olmayabilir → undefined "doğrulanmış" sayılır (kilitlenmeyi önler)
  email_verified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  user: User;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  refreshToken?: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// ============================================
// STORE TYPES
// ============================================

export interface Store {
  id: number;
  name: string;
  logo_url: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  website_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NearbyStore {
  store_id: number;
  distanceKm: number;
  branch: { id: number; name: string; lat: number; lon: number; address: string | null; city: string | null };
}

// ============================================
// AFFILIATE TYPES
// ============================================

export interface AffiliateClickRequest {
  storeId: number;
  listId?: number;
  productId?: number;
  context?: 'cart' | 'product' | 'store';
}

export interface AffiliateClickResponse {
  success: boolean;
  url: string;
  store: { id: number; name: string };
}

// ============================================
// CATEGORY TYPES
// ============================================

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  display_order: number;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
  children?: Category[];
  _count?: {
    products: number;
    children: number;
  };
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface ProductConstraint {
  hidden: boolean;
  warnings: string[];
}

export interface Product {
  id: number;
  name: string;
  brand: string | null;
  ean_barcode: string | null;
  image_url: string | null;
  category_id: number | null;
  muadil_grup_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  store_prices?: StorePrice[];
  constraint?: ProductConstraint;
}

export interface StorePrice {
  id: number;
  store_id: number;
  product_id: number;
  store_sku: string | null;
  price: string; // Decimal as string
  unit: string;
  last_updated_at: string;
  source: string;
  confidence_score: number;
  store?: Store;
  product?: Product;
}

// ============================================
// LIST TYPES
// ============================================

export interface ShoppingList {
  id: number;
  user_id: number;
  name: string;
  is_template?: boolean; // legacy — kolon durur ama okunmaz/yazılmaz
  budget: string | null; // Decimal as string
  status: 'active' | 'inactive';
  completed_at: string | null;
  last_compared_at: string | null;
  created_at: string;
  updated_at: string;
  list_items?: ListItem[];
}

export interface ListItem {
  id: number;
  list_id: number;
  product_id: number;
  quantity: number;
  unit: string;
  brand_independent: boolean;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface CreateListRequest {
  name: string;
  is_template?: boolean;
  budget?: number;
}

export interface AddListItemRequest {
  product_id: number;
  quantity?: number;
  unit?: string;
  brand_independent?: boolean;
}

// ============================================
// COMPARE TYPES
// ============================================

export interface CompareRequest {
  maxStores?: number;
  userLocation?: {
    lat: number;
    lon: number;
  };
  favoriteStoreIds?: number[];
  includeMissingProducts?: boolean;
  radiusKm?: number;
}

export interface RouteStrategy {
  type: 'single_store' | 'multi_store';
  stores: StoreAllocation[];
  totalPrice: number;
  totalDistance: number;
  estimatedDuration: number;
  missingProducts: MissingProduct[];
  coveragePercentage: number;
  budgetStatus: 'within_budget' | 'over_budget' | 'unknown';
  budgetRemaining: number | null;
  hasFavoriteStores: boolean;
  favoriteStoreCount: number;
  score: number;
}

export interface StoreAllocation {
  store: {
    id: number;
    name: string;
    lat: number | null;
    lon: number | null;
  };
  products: ProductAllocation[];
  subtotal: number;
}

export interface ProductAllocation {
  listItemId: number;
  product: {
    id: number;
    name: string;
    brand: string | null;
    image_url: string | null;
  };
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
}

export interface MissingProduct {
  listItemId: number;
  product: {
    id: number;
    name: string;
    brand: string | null;
  };
  quantity: number;
  unit: string;
}

export interface CompareResponse {
  listId: number;
  listName: string;
  totalItems: number;
  budget: number | null;
  strategies: RouteStrategy[];
  alternatives: AlternativeProduct[];
  summary: CompareSummary;
  // Konum + yarıçap filtresi uygulandı mı? (uygulandı + strategies boş → yakında market yok)
  nearbyFilterApplied?: boolean;
  radiusKm?: number | null;
}

export interface AlternativeProduct {
  originalProduct: {
    id: number;
    name: string;
    brand: string | null;
  };
  alternativeProduct: {
    id: number;
    name: string;
    brand: string | null;
  };
  originalPrice: number;
  alternativePrice: number;
  savings: number;
  store: {
    id: number;
    name: string;
  };
}

export interface CompareSummary {
  bestSingleStore: RouteStrategy | null;
  bestMultiStore: RouteStrategy | null;
  cheapestOption: RouteStrategy | null;
  closestOption: RouteStrategy | null;
  maxSavings: number;
}

// ============================================
// FEEDBACK TYPES
// ============================================

export interface PriceFeedback {
  id: number;
  user_id: number;
  store_price_id: number;
  is_accurate: boolean;
  suggested_price: string | null;
  comment: string | null;
  created_at: string;
}

export interface CreateFeedbackRequest {
  store_price_id: number;
  is_accurate: boolean;
  suggested_price?: number;
  comment?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// ============================================
// PROFILE TYPES
// ============================================

export interface UserProfile {
  household_size?: string | null;
  diet?: string | null;
  avoid?: string[];
  allergies?: string[];
  weekly_budget?: number | null;
  onboarding_done: boolean;
  // UI dili (örn. "tr") ve alışveriş ülkesi ISO kodu (örn. "DE") — onboarding'de kaydedilir.
  language?: string;
  country_code?: string;
}

