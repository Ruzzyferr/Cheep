/**
 * 🤖 Assistant Service
 * Chat threads and messaging API calls
 */

import apiClient from './api.client';
import type { ApiResponse } from '../types';

// ============================================
// TYPES
// ============================================

export interface ChatThread {
  id: number;
  title: string | null;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  role: string;
  content: string;
  tool_calls?: any;
}

export interface SendMessageResponse {
  message: string;
  toolCalls: any[];
  remaining?: number;
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
      const response = await apiClient.post<ApiResponse<SendMessageResponse>>(
        `/assistant/threads/${id}/messages`,
        { content }
      );
      return response.data.data!;
    } catch (e: any) {
      if (e?.response?.status === 429 && e?.response?.data?.code === 'DAILY_LIMIT') {
        throw Object.assign(new Error(e.response.data.message), { dailyLimit: true });
      }
      throw e;
    }
  },
};
