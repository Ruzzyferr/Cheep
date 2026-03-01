/**
 * 🏪 Store Service
 * Store API calls
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { Store, ApiResponse } from '../types';

export const storeService = {
  /**
   * Get all stores
   */
  async getStores(): Promise<Store[]> {
    const response = await apiClient.get<ApiResponse<Store[]>>(
      API_ENDPOINTS.STORES.ALL
    );
    return response.data.data || [];
  },

  /**
   * Get store by ID
   */
  async getStoreById(id: number): Promise<Store> {
    const response = await apiClient.get<ApiResponse<Store>>(
      API_ENDPOINTS.STORES.BY_ID(id)
    );
    return response.data.data!;
  },
};

