/**
 * 🔄 Odak ve ağ köprüsü.
 *
 * React Query varsayılan olarak `window.focus` dinler — React Native'de böyle
 * bir olay yok. Bu köprü olmadan uygulama arka plandan döndüğünde veri
 * kendiliğinden tazelenmez ve kullanıcı saatler önceki fiyatları görür.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';

/** `AppState` → React Query odak yöneticisi. */
export function useAppStateFocus() {
    useEffect(() => {
        const onChange = (status: AppStateStatus) => {
            // Web'de tarayıcının kendi odak olayı zaten çalışıyor.
            if (Platform.OS !== 'web') {
                focusManager.setFocused(status === 'active');
            }
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => sub.remove();
    }, []);
}

/**
 * Ağ durumu köprüsü.
 *
 * NetInfo bağımlılığı eklemek yerine React Query'nin varsayılan davranışını
 * koruyoruz (çevrimiçi varsay, hata olursa yeniden dene). Uygulamada zaten
 * axios interceptor'ı ağ hatasını yakalayıp kullanıcıya gösteriyor; ikinci bir
 * bağımlılık taşımanın karşılığı yok.
 */
export function useOnlineBridge() {
    useEffect(() => {
        onlineManager.setOnline(true);
    }, []);
}
