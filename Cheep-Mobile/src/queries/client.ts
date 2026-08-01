/**
 * 🗄️ Query client — uygulamanın tek veri cache'i.
 *
 * NEDEN VAR: her ekran `useEffect(..., [])` ile mount'ta bir kez veri
 * çekiyordu. Ekranlar arasında bağ yoktu: kullanıcı listeye ürün ekleyip
 * anasayfaya döndüğünde eski veriyi görüyor, elle aşağı çekip yenilemesi
 * gerekiyordu. Cache + geçersizleştirme bunu yapısal olarak çözer.
 */
import { QueryClient } from '@tanstack/react-query';

/**
 * Bayatlık süreleri veri tipine göre. Sabit tek bir değer yanlış olurdu:
 * kategori ağacı günde bir değişir, aktif listenin sayısı saniyeler içinde.
 */
export const STALE = {
    /** Kategoriler ve marketler — taksonomi gün içinde değişmez. */
    static: 30 * 60 * 1000,
    /** Ürün listeleri ve fiyatlar — fiyat güncellemeleri günlük. */
    catalog: 5 * 60 * 1000,
    /** Listeler, sepet, karşılaştırma — kullanıcının kendi eylemleri değiştirir. */
    live: 0,
} as const;

export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: STALE.catalog,
                // Ekrana dönüldüğünde bayat veri arka planda tazelenir; ekran
                // BOŞALMAZ — eski veri gösterilirken yenisi gelir.
                refetchOnMount: true,
                refetchOnReconnect: true,
                retry: 2,
                // Hücresel veride uzun bekleme yerine hızlı ikinci deneme.
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            },
            mutations: {
                // Mutasyonlar kullanıcı eylemidir; sessiz tekrar yanlış olur
                // (aynı ürün iki kez eklenebilir).
                retry: 0,
            },
        },
    });
}
