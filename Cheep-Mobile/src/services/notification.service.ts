/**
 * 🔔 Notification Service
 * Fiyat düşüşü bildirimleri + push token yönetimi.
 */

import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { ApiResponse } from '../types';

export interface PriceDropNotification {
  id: number;
  old_price: string;
  new_price: string;
  drop_pct: number;
  read_at: string | null;
  created_at: string;
  product: { id: number; name: string; brand: string | null; image_url: string | null };
  store: { id: number; name: string; logo_url: string | null };
  country: { code: string; currency: string };
}

interface ListResponse extends ApiResponse<never> {
  items: PriceDropNotification[];
  total: number;
  hasMore: boolean;
}

export const notificationService = {
  async list(limit = 30, offset = 0): Promise<{ items: PriceDropNotification[]; total: number; hasMore: boolean }> {
    const res = await apiClient.get<ListResponse>(API_ENDPOINTS.NOTIFICATIONS.LIST, {
      params: { limit, offset },
    });
    return {
      items: res.data.items ?? [],
      total: res.data.total ?? 0,
      hasMore: res.data.hasMore ?? false,
    };
  },

  /** Zil rozetinin kaynağı. Hata durumunda 0 döner — rozet yüzünden ekran patlamasın. */
  async unreadCount(): Promise<number> {
    try {
      const res = await apiClient.get<ApiResponse<{ count: number }>>(
        API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
      );
      return res.data.data?.count ?? 0;
    } catch {
      return 0;
    }
  },

  async markRead(id: number): Promise<void> {
    await apiClient.post(API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  },

  async markAllRead(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },

  async registerPushToken(token: string, platform: string, locale?: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.NOTIFICATIONS.PUSH_TOKEN, { token, platform, locale });
  },

  async removePushToken(token: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.NOTIFICATIONS.PUSH_TOKEN_REMOVE, { token });
  },
};
