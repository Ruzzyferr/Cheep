/**
 * 🛍️ Product Service
 * Product API calls
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { Product, StorePrice, ApiResponse } from '../types';

export interface PriceHistoryPoint {
  price: number;
  recorded_at: string;
}

export interface PriceHistorySeries {
  store: { id: number; name: string; logo_url: string | null };
  points: PriceHistoryPoint[];
}

export interface PriceHistoryResponse {
  product_id: number;
  days: number;
  series: PriceHistorySeries[];
  summary: { lowest: number | null; highest: number | null; dataPoints: number };
}

export const productService = {
  /**
   * Get all products (with filters)
   */
  async getProducts(params?: {
    search?: string;
    category_id?: number;
    page?: number;
    limit?: number;
  }): Promise<Product[]> {
    const response = await apiClient.get<ApiResponse<Product[]>>(
      API_ENDPOINTS.PRODUCTS.ALL,
      { params }
    );
    return response.data.data || [];
  },

  /**
   * Get product by ID
   */
  async getProductById(id: number): Promise<Product> {
    const response = await apiClient.get<ApiResponse<Product>>(
      API_ENDPOINTS.PRODUCTS.BY_ID(id)
    );
    return response.data.data!;
  },

  /**
   * Get product prices
   */
  async getProductPrices(id: number): Promise<StorePrice[]> {
    const response = await apiClient.get<ApiResponse<StorePrice[]>>(
      API_ENDPOINTS.PRODUCTS.PRICES(id)
    );
    return response.data.data || [];
  },

  /**
   * Get product price history (per-store time series)
   *
   * Not: bu uç, diğerlerinden farklı olarak yanıtı DOĞRUDAN döndürür
   * (ApiResponse `{ success, data }` sarmalı YOKTUR — backend `res.json(history)`).
   * Bu yüzden burada bilinçli olarak `response.data.data` değil `response.data`
   * okuruz. Olası bozuk/eksik yanıtlara karşı güvenli bir varsayılana normalize
   * ederiz ki tüketiciler (PriceTrendCard) çökmesin.
   */
  async getPriceHistory(id: number, days = 90): Promise<PriceHistoryResponse> {
    const response = await apiClient.get<Partial<PriceHistoryResponse>>(
      API_ENDPOINTS.PRODUCTS.HISTORY(id),
      { params: { days } }
    );
    const raw = response.data;
    return {
      product_id: raw?.product_id ?? id,
      days: raw?.days ?? days,
      series: Array.isArray(raw?.series) ? raw.series : [],
      summary: raw?.summary ?? { lowest: null, highest: null, dataPoints: 0 },
    };
  },
};

