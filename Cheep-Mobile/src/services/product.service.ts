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
   * Not: backend yanıtı doğrudan döndürür (ApiResponse sarmalı yok).
   */
  async getPriceHistory(id: number, days = 90): Promise<PriceHistoryResponse> {
    const response = await apiClient.get<PriceHistoryResponse>(
      API_ENDPOINTS.PRODUCTS.HISTORY(id),
      { params: { days } }
    );
    return response.data;
  },

  /**
   * Compare product prices across stores
   */
  async compareProductPrices(id: number): Promise<any> {
    const response = await apiClient.get<ApiResponse<any>>(
      API_ENDPOINTS.PRODUCTS.COMPARE(id)
    );
    return response.data.data;
  },

  /**
   * Search products
   */
  async searchProducts(query: string): Promise<Product[]> {
    const response = await apiClient.get<ApiResponse<Product[]>>(
      API_ENDPOINTS.PRODUCTS.SEARCH,
      { params: { search: query } }
    );
    return response.data.data || [];
  },
};

