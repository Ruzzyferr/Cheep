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
 * Ağ durumu köprüsü — İSTEK SONUÇLARINDAN türetilir.
 *
 * NetInfo (native bağımlılık) bilerek EKLENMEDİ, ama eski hâli de yanlıştı:
 * `onlineManager.setOnline(true)` bir kez çağrılıp bırakılıyordu, yani durum
 * ASLA `false` olmuyordu. Sonuçları: `refetchOnReconnect: true` ölü koddu
 * (false→true geçişi hiç yaşanmadığı için tünelden çıkan kullanıcının verisi
 * tazelenmiyordu) ve mutasyonlar hiç kuyruğa girmiyordu.
 *
 * Burada durumu GÖZLEMDEN türetiyoruz: cache'teki sorgular ağ hatası
 * verdiğinde çevrimdışına geçiyoruz, herhangi bir istek başarılı olduğunda
 * geri dönüyoruz. Kusursuz bir bağlantı dedektörü değil — ama gerçek olan
 * tek sinyale (isteklerimiz geçiyor mu?) dayanıyor ve `false → true` geçişini
 * ürettiği için `refetchOnReconnect` artık gerçekten çalışıyor.
 */
export function useOnlineBridge() {
    useEffect(() => {
        onlineManager.setOnline(true);

        const unsubscribe = queryClientRef?.getQueryCache().subscribe((event) => {
            if (event.type !== 'updated') return;
            const state = event.query.state;
            if (state.status === 'success') {
                if (!onlineManager.isOnline()) onlineManager.setOnline(true);
                return;
            }
            if (state.status === 'error') {
                const e = state.error as { code?: string; status?: number } | null;
                const isNetwork = e?.code === 'NETWORK_ERROR' || e?.status == null;
                if (isNetwork && onlineManager.isOnline()) onlineManager.setOnline(false);
            }
        });
        return () => { unsubscribe?.(); };
    }, []);
}

/**
 * Köprünün gözlemleyeceği istemci. `App.tsx` tek istemciyi burada kaydeder;
 * hook bir bileşen gövdesinde çalıştığı için `useQueryClient` de kullanılabilirdi
 * ama o, köprüyü sağlayıcının İÇİNDE olmaya zorlar — kayıt daha esnek.
 */
let queryClientRef: import('@tanstack/react-query').QueryClient | null = null;
export function registerQueryClient(client: import('@tanstack/react-query').QueryClient): void {
    queryClientRef = client;
}
