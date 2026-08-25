/**
 * 🤖 Assistant Service
 * Chat threads and messaging API calls
 */

import apiClient from './api.client';
import { ASSISTANT_TIMEOUT } from '../constants/api';
import type { ApiResponse } from '../types';

// ============================================
// TYPES
// ============================================

export interface ChatThread {
  id: number;
  title: string | null;
  updated_at: string;
}

/**
 * Bir LLM araç çağrısı. Backend agent-loop her çağrıyı
 * `{ name, args, result }` olarak döndürür (bkz. agent-loop.ts AgentResult).
 */
export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  tool_calls?: ToolCall[];
}

export interface SendMessageResponse {
  message: string;
  toolCalls: ToolCall[];
  /** Baglayici pencerede kalan mesaj hakki. */
  remaining?: number;
  /** Baglayici pencerenin tavani — ucretsizde 5/gun, premiumda 300/ay. */
  limit?: number;
  /** Hangi pencere baglayici: gunluk mu aylik mi. */
  window?: 'day' | 'month';
  isPremium?: boolean;
}

// ============================================
// SERVICE
// ============================================

export const assistantService = {
  /**
   * List all chat threads
   */
  async listThreads(): Promise<ChatThread[]> {
    const response = await apiClient.get<ApiResponse<ChatThread[]>>(
      '/assistant/threads'
    );
    return response.data.data ?? [];
  },

  /**
   * Create a new chat thread
   */
  async createThread(): Promise<ChatThread> {
    const response = await apiClient.post<ApiResponse<ChatThread>>(
      '/assistant/threads'
    );
    return response.data.data!;
  },

  /**
   * Get a specific thread with messages
   */
  async getThread(id: number): Promise<ChatThread & { messages: ChatMessage[] }> {
    const response = await apiClient.get<
      ApiResponse<ChatThread & { messages: ChatMessage[] }>
    >(`/assistant/threads/${id}`);
    return response.data.data!;
  },

  /**
   * Delete a thread
   */
  async deleteThread(id: number): Promise<void> {
    await apiClient.delete(`/assistant/threads/${id}`);
  },

  /**
   * Send a message to a thread
   */
  async sendMessage(
    id: number,
    content: string
  ): Promise<SendMessageResponse> {
    try {
      // Araç çağıran mesajlar üretimde 13–34 sn sürüyor; ortak 10 sn'lik
      // zaman aşımı bunları sistematik olarak düşürüyordu (bkz.
      // ASSISTANT_TIMEOUT). Sunucu isteği tamamladığı için kullanıcı hem
      // hata görüyor hem günlük kotasından oluyordu.
      const response = await apiClient.post<ApiResponse<SendMessageResponse>>(
        `/assistant/threads/${id}/messages`,
        { content },
        { timeout: ASSISTANT_TIMEOUT }
      );
      return response.data.data!;
    } catch (e: any) {
      if (e?.status === 429 && e?.data?.code === 'DAILY_LIMIT') {
        throw Object.assign(new Error(e?.data?.message ?? 'Günlük mesaj limitin doldu.'), { dailyLimit: true });
      }
      throw e;
    }
  },
};
