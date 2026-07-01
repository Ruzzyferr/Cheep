/**
 * 👤 User Service
 * `/users/me` üzerinden kullanıcı kaydını günceller (dil/ülke/ad gibi
 * users tablosu alanları — profileService'in yönettiği household_size/diet/
 * allergies gibi ayrı "profile" tablosu alanlarıyla KARIŞTIRILMAMALI).
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { ApiResponse, User } from '../types';

export const userService = {
  /**
   * Dil + ülke (ve gerekirse ad) tercihlerini `/users/me`'ye yazar.
   * Onboarding ve Profil'deki dil/ülke seçicileri bu tek uçtan geçmeli —
   * bu alanlar `profileService.updateProfile` (`/profile`) tarafından
   * bilinmez ve sessizce atılır.
   */
  async updatePreferences(prefs: {
    name?: string;
    language?: string;
    country_code?: string;
  }): Promise<User> {
    const response = await apiClient.put<ApiResponse<User>>(
      API_ENDPOINTS.USERS.ME,
      prefs
    );
    return response.data.data!;
  },
};
