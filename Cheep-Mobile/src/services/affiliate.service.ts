/**
 * 🛒 Affiliate Service
 * "Markete git / sepeti tamamla" tıklamasını kaydeder ve açılacak URL'yi alır.
 * URL üretimi backend'de yapılır (affiliate linkine geçiş mobil güncelleme gerektirmez).
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { AffiliateClickRequest, AffiliateClickResponse } from '../types';

export const affiliateService = {
  async trackClick(data: AffiliateClickRequest): Promise<AffiliateClickResponse> {
    const response = await apiClient.post<AffiliateClickResponse>(
      API_ENDPOINTS.AFFILIATES.CLICK,
      data
    );
    return response.data;
  },
};
