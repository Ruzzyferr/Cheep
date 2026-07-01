/**
 * 🏪 Store Service
 * Store API calls
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { Store, ApiResponse, NearbyStore } from '../types';

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

  /**
   * Get nearest store branches to a given coordinate (country-scoped).
   */
  async getNearbyStores(lat: number, lon: number): Promise<NearbyStore[]> {
    const response = await apiClient.get<ApiResponse<NearbyStore[]>>(
      API_ENDPOINTS.STORES.NEARBY, { params: { lat, lon } }
    );
    return response.data.data || [];
  },
};

