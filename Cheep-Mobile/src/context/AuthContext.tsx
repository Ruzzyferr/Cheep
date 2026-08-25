/**
 * 🔐 Auth Context
 * Global authentication state
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, profileService } from '../services';
import { authStorage, userStorage, introStorage } from '../utils/storage';
import type { User, LoginRequest, RegisterRequest } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  emailVerified: boolean;
  onboardingDone: boolean;
  introSeen: boolean;
  markIntroSeen: () => Promise<void>;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);

  const markIntroSeen = async () => {
    // State'i ÖNCE çevir → kapı anında Auth'a geçsin. Depolama (SecureStore)
    // başarısız olsa/asılsa bile kullanıcı intro'da takılı kalmaz.
    setIntroSeen(true);
    try {
      await introStorage.markSeen();
    } catch (e) {
      console.warn('intro_seen kaydedilemedi:', e);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ağ kaynaklı bir hata mı? (bağlantı yok / zaman aşımı)
   *
   * api.client interceptor'ı ayrımı zaten yapıyor: taşıma katmanı hatalarında
   * `code: 'NETWORK_ERROR'` ve `status` YOK; sunucu yanıt verdiyse `status` var.
   * Bu ayrım kritik, çünkü "sunucuya ulaşamadım" ile "sunucu hayır dedi"
   * birbirinin yerine geçerse kullanıcının oturumu ve verisi çöpe gidiyor.
   */
  const isNetworkError = (err: unknown): boolean => {
    const e = err as { code?: string; status?: number } | null;
    return e?.code === 'NETWORK_ERROR' || e?.status == null;
  };

  const refreshOnboarding = async () => {
    try {
      const p = await profileService.getProfile();
      setOnboardingDone(!!p?.onboarding_done);
    } catch (error) {
      // AĞ HATASINDA DOKUNMA. Eskiden her hata `false` yazıyordu; sonuç:
      // metroda uygulamayı açan MEVCUT kullanıcı listeleri yerine onboarding
      // sihirbazını görüyordu, sihirbazı bitirmeye çalışınca `updateProfile`
      // de ağ yüzünden patlıyor ve kullanıcı sihirbazın içinde KİLİTLENİYORDU.
      // Her çevrimdışı açılışta tekrarlıyordu.
      if (isNetworkError(error)) return;
      setOnboardingDone(false);
    }
  };

  const checkAuth = async () => {
    try {
      // Intro tour'u daha önce gördü mü? (auth'tan bağımsız, ilk açılış kapısı)
      setIntroSeen(await introStorage.hasSeen());

      const hasToken = await authStorage.hasToken();

      if (hasToken) {
        const savedUser = await userStorage.getUser<User>();
        if (savedUser) {
          setUser(savedUser);
          // KAYITLI KULLANICI BAYAT OLABİLİR — özellikle `email_verified`.
          //
          // Doğrulama başka bir yerde tamamlanabiliyor (e-postadaki bağlantı,
          // ikinci bir cihaz, destek). Depodaki kopya `false` kaldığı için
          // uygulama açılışta doğrulama kapısında TAKILI kalıyor ve kullanıcı
          // çıkış yapıp yeniden girmeden kurtulamıyordu. Sunucudan sessizce
          // tazeliyoruz: hata olursa kayıtlı kullanıcı zaten ekranda, kimse
          // kaybetmiyor (refreshUser ağ hatasında oturumu kapatmıyor).
          void refreshUser();
        } else {
          // Fetch user if token exists but user data is missing
          await refreshUser();
        }
        // Load onboarding status after establishing the session
        await refreshOnboarding();
      }
    } catch (error) {
      console.error('Check auth error:', error);
      // Ağ hatasında oturumu KAPATMA — bkz. refreshUser'daki gerekçe.
      if (!isNetworkError(error)) await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginRequest) => {
    try {
      const response = await authService.login(data);

      // Save tokens and user
      await authStorage.saveToken(response.token);
      if (response.refreshToken) {
        await authStorage.saveRefreshToken(response.refreshToken);
      }
      await userStorage.saveUser(response.user);

      setUser(response.user);
      await refreshOnboarding();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      const response = await authService.register(data);

      // Save tokens and user
      await authStorage.saveToken(response.token);
      if (response.refreshToken) {
        await authStorage.saveRefreshToken(response.refreshToken);
      }
      await userStorage.saveUser(response.user);

      setUser(response.user);
      await refreshOnboarding();
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authStorage.clearAuth();
      setUser(null);
      setOnboardingDone(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authService.getMe();
      if (response.data) {
        await userStorage.saveUser(response.data);
        setUser(response.data);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // AĞ HATASINDA OTURUMU KAPATMA — çıkış yapmak token'ı siler ve kullanıcı
      // geri giremez, çünkü GİRİŞ DE ağ ister. Yani bir tünelden geçerken
      // uygulamayı açmak, kullanıcıyı ağ geri gelene kadar dışarıda bırakıyordu.
      // Oturumu yalnızca sunucu kimliği GERÇEKTEN reddettiyse kapat.
      if (isNetworkError(error)) return;
      await logout();
    }
  };

  // E-posta doğrulama: kodu gönderir, dönen güncel kullanıcıyı kaydeder (gate açılır)
  const verifyEmail = async (code: string) => {
    const res = await authService.verifyEmail(code);
    await userStorage.saveUser(res.user);
    setUser(res.user);
  };

  const resendVerification = async () => {
    await authService.resendVerification();
  };

  // Eski kayıtlarda email_verified olmayabilir → undefined "doğrulanmış" sayılır.
  const emailVerified = user ? user.email_verified !== false : false;

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    emailVerified,
    onboardingDone,
    introSeen,
    markIntroSeen,
    login,
    register,
    logout,
    refreshUser,
    refreshOnboarding,
    verifyEmail,
    resendVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

