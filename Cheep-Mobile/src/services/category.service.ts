/**
 * 📁 Category Service
 * Kategori API çağrıları
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { ApiResponse } from '../types';

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon?: string;
  created_at: string;
  updated_at: string;
  parent?: Category | null;
}

class CategoryService {
  /**
   * Tüm kategorileri getir
   */
  async getAllCategories(): Promise<Category[]> {
    const response = await apiClient.get<ApiResponse<Category[]>>(
      API_ENDPOINTS.CATEGORIES.ALL
    );
    return response.data.data || [];
  }

  /**
   * Ana kategorileri getir (parent_id = null)
   */
  async getParentCategories(): Promise<Category[]> {
    const response = await apiClient.get<ApiResponse<Category[]>>(
      API_ENDPOINTS.CATEGORIES.PARENT
    );
    return response.data.data || [];
  }

  /**
   * Belirli bir kategorinin alt kategorilerini getir
   */
  async getSubcategories(categoryId: number): Promise<Category[]> {
    const response = await apiClient.get<ApiResponse<Category[]>>(
      API_ENDPOINTS.CATEGORIES.SUBCATEGORIES(categoryId)
    );
    return response.data.data || [];
  }

  /**
   * Kategori detayını getir
   */
  async getCategoryById(categoryId: number): Promise<Category> {
    const response = await apiClient.get<ApiResponse<Category>>(
      API_ENDPOINTS.CATEGORIES.BY_ID(categoryId)
    );
    return response.data.data!;
  }
}

export const categoryService = new CategoryService();

