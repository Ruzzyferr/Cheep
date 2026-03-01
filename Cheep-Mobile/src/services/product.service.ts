/**
 * 🛍️ Product Service
 * Product API calls
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { Product, StorePrice, ApiResponse } from '../types';

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

