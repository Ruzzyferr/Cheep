/**
 * 🔔 Bildirim ÇALIŞMA ZAMANI — kanal, ön plan davranışı ve dokunma yönlendirmesi.
 *
 * NEDEN AYRI BİR DOSYA: `notificationGate.ts` yalnızca İZİN ve TOKEN ile
 * ilgileniyor. Bir bildirimin cihaza ulaştıktan SONRA ne olacağı bambaşka bir
 * mesele ve uygulamada hiç ele alınmamıştı. Üç eksik vardı; üçü de push'u
 * "gönderiliyor ama işe yaramıyor" durumuna sokuyordu:
 *
 * ① `setNotificationHandler` yoktu → uygulama AÇIKKEN gelen bildirim hiç
 *    gösterilmiyordu. expo-notifications'ın varsayılanı, handler tanımlı
 *    değilse ön plandaki bildirimi SESSİZCE düşürmektir. Fiyat düşüşü
 *    bildirimleri sabah 08:00'de üretiliyor; uygulamayı o sırada açık tutan
 *    kullanıcı hiçbir şey görmüyordu.
 *
 * ② Android bildirim KANALI hiç oluşturulmuyordu. `app.json`'daki
 *    `defaultChannel: "price-drops"` manifeste bir kanal KİMLİĞİ yazıyor ama
 *    kanalın kendisini yaratmıyor — onu uygulama çalışırken oluşturmak
 *    zorunda. Var olmayan bir kanala gelen bildirimi Android kendi açtığı
 *    "Miscellaneous" kanalına düşürüyor: marka rengi, önem derecesi ve
 *    kullanıcının kanal bazlı kontrolü kayboluyor.
 *
 * ③ Dokunma dinleyicisi yoktu → bildirime dokunan kullanıcı uygulamayı
 *    en son bıraktığı ekranda buluyordu. "5 üründe fiyat düştü" deyip
 *    kullanıcıyı hiçbir yere götürmemek bildirimin tüm amacını iptal ediyor.
 *
 * Hepsi `Device.isDevice` arkasında: emülatörde push token alınamaz, kurulum
 * gereksiz yere hata üretmesin.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { createNavigationContainerRef } from '@react-navigation/native';
import { colors } from '../theme';

/** Backend'in `android.notification.channel_id` ile gönderdiği kanal. */
export const PRICE_DROP_CHANNEL = 'price-drops';

/**
 * Navigasyon köküne referans.
 *
 * Bildirim dinleyicisi bir React bileşeni DEĞİL — `useNavigation` kullanamaz.
 * Yönlendirme yapabilmesi için konteynere modül düzeyinde bir referans şart.
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Ön plan davranışı: bildirim uygulama açıkken de GÖSTERİLSİN.
 *
 * Modül düzeyinde kuruluyor (bileşen içinde değil) çünkü expo-notifications
 * handler'ı, bildirim gelmeden önce tanımlı olmak zorunda.
 */
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/** Android bildirim kanalını oluşturur (varsa günceller). */
export async function ensureNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
        await Notifications.setNotificationChannelAsync(PRICE_DROP_CHANNEL, {
            name: 'Fiyat düşüşleri',
            description: 'Listendeki ürünler ucuzladığında haber verir.',
            importance: Notifications.AndroidImportance.DEFAULT,
            lightColor: colors.primary.main,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    } catch (e) {
        // Kanal kurulamazsa bildirim yine gelir (varsayılan kanala düşer);
        // uygulamayı bu yüzden durdurmak yanlış olur.
        console.error('[bildirim] kanal oluşturulamadı:', e);
    }
}

/** Bildirim verisinden hedef ekranı çözer. */
function targetFor(data: unknown): 'Notifications' | null {
    const d = data as { type?: string } | null | undefined;
    // Şu an tek push türü var; yeni tür eklenince buraya girer.
    return d?.type === 'price_drop' ? 'Notifications' : null;
}

/** Bildirime dokunulduğunda ilgili ekrana götürür. */
function handleResponse(response: Notifications.NotificationResponse): void {
    const target = targetFor(response.notification.request.content.data);
    if (!target) return;
    if (!navigationRef.isReady()) {
        // Uygulama SOĞUK açılışta ise konteyner henüz hazır olmayabilir.
        // Kısa bir gecikmeyle bir kez daha dene; hâlâ hazır değilse vazgeç —
        // kullanıcı zaten uygulamanın içinde olur, zil rozeti onu yönlendirir.
        setTimeout(() => {
            if (navigationRef.isReady()) navigationRef.navigate(target as never);
        }, 1200);
        return;
    }
    navigationRef.navigate(target as never);
}

/**
 * Bildirim çalışma zamanını kurar. Uygulama kökünde BİR KEZ çağrılır.
 *
 * Soğuk açılışı da kapsar: uygulama bildirime dokunularak açıldıysa olay
 * dinleyici bağlanmadan önce gerçekleşmiştir, bu yüzden
 * `getLastNotificationResponseAsync` ile ayrıca sorulur.
 */
export function useNotificationRuntime(): void {
    useEffect(() => {
        if (!Device.isDevice) return;

        void ensureNotificationChannel();

        // Uygulama bildirime dokunularak AÇILDIYSA (soğuk başlangıç).
        let cancelled = false;
        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (!cancelled && response) handleResponse(response);
            })
            .catch(() => {});

        const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
        return () => {
            cancelled = true;
            sub.remove();
        };
    }, []);
}
