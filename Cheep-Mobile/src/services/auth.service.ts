/**
 * 🔐 Auth Service
 * Authentication API calls
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { 
  AuthResponse, 
  LoginRequest, 
  RegisterRequest,
  ApiResponse 
} from '../types';

export const authService = {
  /**
   * User registration
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      data
    );
    return response.data;
  },

  /**
   * User login
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      data
    );
    return response.data;
  },

  /**
   * Get current user
   */
  async getMe() {
    const response = await apiClient.get<ApiResponse<any>>(
      API_ENDPOINTS.USERS.ME
    );
    return response.data;
  },
};

