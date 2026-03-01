/**
 * 📋 List Service
 * Shopping list API calls
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type {
  ShoppingList,
  CreateListRequest,
  AddListItemRequest,
  CompareRequest,
  CompareResponse,
  ApiResponse,
} from '../types';

export const listService = {
  /**
   * Get all lists (with status filter)
   */
  async getLists(status?: 'active' | 'completed' | 'all'): Promise<ShoppingList[]> {
    const params = status ? { status } : {};
    const response = await apiClient.get<ApiResponse<ShoppingList[]>>(
      API_ENDPOINTS.LISTS.ALL,
      { params }
    );
    return response.data.data || [];
  },

  /**
   * Get list by ID
   */
  async getListById(id: number): Promise<ShoppingList> {
    const response = await apiClient.get<ApiResponse<ShoppingList>>(
      API_ENDPOINTS.LISTS.BY_ID(id)
    );
    return response.data.data!;
  },

  /**
   * Create new list
   */
  async createList(data: CreateListRequest): Promise<ShoppingList> {
    const response = await apiClient.post<ApiResponse<ShoppingList>>(
      API_ENDPOINTS.LISTS.CREATE,
      data
    );
    return response.data.data!;
  },

  /**
   * Update list
   */
  async updateList(id: number, data: Partial<CreateListRequest>): Promise<ShoppingList> {
    const response = await apiClient.put<ApiResponse<ShoppingList>>(
      API_ENDPOINTS.LISTS.UPDATE(id),
      data
    );
    return response.data.data!;
  },

  /**
   * Delete list
   */
  async deleteList(id: number): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.LISTS.DELETE(id));
  },

  /**
   * Add item to list
   */
  async addItem(listId: number, data: AddListItemRequest): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>(
      API_ENDPOINTS.LISTS.ADD_ITEM(listId),
      data
    );
    return response.data.data;
  },

  /**
   * Delete item from list
   */
  async deleteItem(listId: number, itemId: number): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.LISTS.DELETE_ITEM(listId, itemId));
  },

  /**
   * Compare list (get routes)
   */
  async compareList(id: number, data: CompareRequest): Promise<CompareResponse> {
    const response = await apiClient.post<ApiResponse<CompareResponse>>(
      API_ENDPOINTS.LISTS.COMPARE(id),
      data
    );
    return response.data.data!;
  },

  /**
   * Use selected route - Mark list as completed
   */
  async useRoute(listId: number): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      API_ENDPOINTS.LISTS.USE_ROUTE(listId)
    );
  },

  /**
   * Get templates
   */
  async getTemplates(): Promise<ShoppingList[]> {
    const response = await apiClient.get<ApiResponse<ShoppingList[]>>(
      API_ENDPOINTS.LISTS.TEMPLATES
    );
    return response.data.data || [];
  },

  /**
   * Create from template
   */
  async createFromTemplate(templateId: number, name?: string): Promise<ShoppingList> {
    const response = await apiClient.post<ApiResponse<ShoppingList>>(
      API_ENDPOINTS.LISTS.FROM_TEMPLATE(templateId),
      { name }
    );
    return response.data.data!;
  },

  /**
   * Import completed list to existing
   */
  async importToExisting(completedId: number, targetListId: number): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>(
      API_ENDPOINTS.LISTS.IMPORT_TO_EXISTING(completedId),
      { targetListId }
    );
    return response.data.data;
  },

  /**
   * Create new from completed list
   */
  async createNewFromCompleted(completedId: number, oldActiveListId?: number): Promise<ShoppingList> {
    const response = await apiClient.post<ApiResponse<ShoppingList>>(
      API_ENDPOINTS.LISTS.CREATE_NEW(completedId),
      { oldActiveListId }
    );
    return response.data.data!;
  },
};

