/**
 * 🌐 API Client
 * Axios instance with interceptors
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT, API_ENDPOINTS } from '../constants/api';
import { authStorage, countryStorage } from '../utils/storage';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Eşzamanlı 401'lerde tek bir refresh isteği yapmak için paylaşılan promise
let refreshPromise: Promise<string | null> | null = null;

async function performTokenRefresh(): Promise<string | null> {
  const refreshToken = await authStorage.getRefreshToken();
  if (!refreshToken) return null;
  try {
    // Interceptor özyinelemesini önlemek için saf axios kullan
    const resp = await axios.post(
      `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
      { refreshToken },
      { timeout: API_TIMEOUT, headers: { 'Content-Type': 'application/json' } }
    );
    const newToken: string | undefined = resp.data?.token;
    const newRefresh: string | undefined = resp.data?.refreshToken;
    if (newToken) {
      await authStorage.saveToken(newToken);
      if (newRefresh) await authStorage.saveRefreshToken(newRefresh);
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

// Request interceptor (add auth token)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Get token from storage
    const token = await authStorage.getToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ülke scoping: saklanan ISO ülke kodunu x-country header'ı olarak gönder
    const country = await countryStorage.getCountry();
    if (country && config.headers) {
      config.headers['x-country'] = country;
    }
    
    // Log request in development
    if (__DEV__) {
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data,
      });
    }
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor (handle errors)
apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (__DEV__) {
      console.log('📥 API Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
    }
    
    return response;
  },
  async (error: AxiosError) => {
    // Log error in development
    if (__DEV__) {
      console.error('❌ API Error:', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.message,
        data: error.response?.data,
      });
    }
    
    // Handle 401 Unauthorized — önce sessiz token refresh dene, sonra isteği tekrarla
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isRefreshCall = originalRequest?.url?.includes(API_ENDPOINTS.AUTH.REFRESH);

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshCall
    ) {
      originalRequest._retry = true;

      // Eşzamanlı 401'leri tek refresh isteğinde birleştir
      if (!refreshPromise) {
        refreshPromise = performTokenRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;

      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      // Refresh başarısız → tüm auth verisini temizle (logout)
      await authStorage.clearAuth();
    }
    
    // Handle network error
    if (!error.response) {
      return Promise.reject({
        message: 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.',
        code: 'NETWORK_ERROR',
      });
    }
    
    // Extract error message
    const errorMessage = 
      (error.response?.data as any)?.message || 
      error.message || 
      'Bir hata oluştu';
    
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

export default apiClient;

