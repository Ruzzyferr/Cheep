/**
 * 🏷️ Kullanıcı fiyat bildirimi istemcisi.
 *
 * NEDEN VAR: TÜBİTAK veri iznini REDDETTİ (5 Eki 2026) ve zincirlerin kendi
 * koşulları yazılı izin olmadan kopyalamayı yasaklıyor (bkz.
 * `docs/VERI-IZINLERI.md`). Kullanıcının rafta gördüğünü bildirmesi,
 * hukuken tartışmasız bize ait TEK fiyat kaynağı.
 */
import apiClient from './api.client';
import { API_ENDPOINTS } from '../constants/api';
import type { ApiResponse } from '../types';

export interface UzlasiOzeti {
  price: number;
  kullanici_sayisi: number;
  aykiri_sayisi: number;
  confidence: number;
}

export interface BildirimSonucu {
  kaydedildi: boolean;
  /** null ise: kaydedildi ama yayımlanacak kadar onay toplamadı. */
  uzlasi: UzlasiOzeti | null;
}

export const userPriceService = {
  async bildir(input: {
    product_id: number;
    store_id: number;
    price: number;
    unit?: string;
  }): Promise<BildirimSonucu> {
    const res = await apiClient.post<ApiResponse<BildirimSonucu>>(
      API_ENDPOINTS.USER_PRICES.CREATE,
      input,
    );
    return res.data.data as BildirimSonucu;
  },

  async bildirimlerim(): Promise<unknown[]> {
    const res = await apiClient.get<ApiResponse<unknown[]>>(API_ENDPOINTS.USER_PRICES.MINE);
    return res.data.data ?? [];
  },
};
