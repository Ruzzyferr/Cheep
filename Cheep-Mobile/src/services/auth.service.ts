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
  ApiResponse,
  User,
  VerifyEmailResponse
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
  async getMe(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>(
      API_ENDPOINTS.USERS.ME
    );
    return response.data;
  },

  /**
   * E-posta doğrulama (6 haneli kod)
   */
  async verifyEmail(code: string): Promise<VerifyEmailResponse> {
    const response = await apiClient.post<VerifyEmailResponse>(
      API_ENDPOINTS.AUTH.VERIFY_EMAIL,
      { code }
    );
    return response.data;
  },

  /**
   * Doğrulama kodunu yeniden gönder
   */
  async resendVerification(): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      API_ENDPOINTS.AUTH.RESEND_VERIFICATION
    );
    return response.data;
  },

  /**
   * "Şifremi unuttum": e-postaya 6 haneli sıfırlama kodu ister.
   *
   * ADRES KAYITLI OLMASA DA BAŞARILI DÖNER — sunucu bilerek ayrım yapmıyor,
   * yoksa uç "bu e-posta Cheep'te kayıtlı mı?" sorgusuna dönerdi. Bu yüzden
   * arayüz de "kod gönderildi" diyemez; "kayıtlıysa gönderildi" demek
   * zorunda (bkz. `auth.forgot_sent`).
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      API_ENDPOINTS.AUTH.FORGOT_PASSWORD,
      { email }
    );
    return response.data;
  },

  /**
   * Kodu doğrulayıp yeni parolayı yazar. Sunucu taze token çifti döner —
   * kullanıcı ayrıca giriş yapmak zorunda kalmaz.
   */
  async resetPassword(data: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.RESET_PASSWORD,
      data
    );
    return response.data;
  },
};

