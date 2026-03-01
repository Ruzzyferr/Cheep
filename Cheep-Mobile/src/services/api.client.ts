/**
 * 🌐 API Client
 * Axios instance with interceptors
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../constants/api';
import { authStorage } from '../utils/storage';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (add auth token)
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Get token from storage
    const token = await authStorage.getToken();
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
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
    
    // Handle 401 Unauthorized (token expired)
    if (error.response?.status === 401) {
      // Clear auth data
      await authStorage.removeToken();
      // Navigate to login (will be handled by auth context)
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

