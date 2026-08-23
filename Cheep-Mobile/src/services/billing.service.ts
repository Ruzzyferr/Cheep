/**
 * 💳 Abonelik durumu (backend)
 *
 * Mağazadaki gerçeği RevenueCat biliyor, ama kotayı uygulayan BACKEND. Bu yüzden
 * premium rozetini ve kalan hakkı her zaman backend'den okuyoruz; SDK'nın yerel
 * cevabı yalnızca satın alma anında anlık geri bildirim için kullanılır.
 */

import apiClient from './api.client';
import type { ApiResponse } from '../types';

export interface BillingStatus {
  isPremium: boolean;
  status: string | null;
  productId: string | null;
  store: string | null;
  currentPeriodEnd: string | null;
  willRenew: boolean;
  monthlyLimit: number;
  dailyLimit: number;
}

export const billingService = {
  /** Kayıtlı durum — hızlı, dış servise gitmez. */
  async getStatus(): Promise<BillingStatus> {
    const res = await apiClient.get<ApiResponse<BillingStatus>>('/billing/status');
    return res.data.data!;
  },

  /**
   * Durumu RevenueCat'ten tazeler. Girişte ve satın alma dönüşünde çağrılır;
   * webhook kaçarsa kullanıcı hakkını bu yolla alır.
   */
  async sync(): Promise<BillingStatus> {
    const res = await apiClient.post<ApiResponse<BillingStatus>>('/billing/sync');
    return res.data.data!;
  },
};
