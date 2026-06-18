/**
 * 👤 Profile Service
 * User profile API calls
 */

import apiClient from './api.client';
import type { UserProfile, ApiResponse } from '../types';

export const profileService = {
  /**
   * Get user profile
   */
  async getProfile(): Promise<UserProfile | null> {
    const response = await apiClient.get<ApiResponse<UserProfile>>(
      '/profile'
    );
    return response.data.data ?? null;
  },

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    const response = await apiClient.put<ApiResponse<UserProfile>>(
      '/profile',
      data
    );
    return response.data.data!;
  },
};
