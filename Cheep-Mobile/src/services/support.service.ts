/**
 * ✉️ Support Service
 * Uygulama içi iletişim formu. Giriş ZORUNLU DEĞİL — sorun yaşayan kullanıcı
 * çoğu zaman giriş yapamadığı için yazıyor.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import i18n from '../i18n';
import type { ApiResponse } from '../types';

export type SupportTopic = 'bug' | 'suggestion' | 'price' | 'account' | 'other';

export const supportService = {
  /**
   * Mesajı gönderir. Uygulama sürümü, platform ve dil OTOMATİK eklenir —
   * kullanıcıya "hangi sürümü kullanıyorsun" diye sormak zorunda kalmayalım.
   */
  async contact(input: {
    email: string;
    message: string;
    topic: SupportTopic;
    countryCode?: string;
  }): Promise<number> {
    const res = await apiClient.post<ApiResponse<{ id: number }>>(
      API_ENDPOINTS.SUPPORT.CONTACT,
      {
        email: input.email.trim(),
        message: input.message.trim(),
        topic: input.topic,
        app_version: Constants.expoConfig?.version ?? undefined,
        platform: Platform.OS,
        os_version: String(Platform.Version),
        locale: i18n.language,
        country_code: input.countryCode,
      },
    );
    return res.data.data?.id ?? 0;
  },
};
