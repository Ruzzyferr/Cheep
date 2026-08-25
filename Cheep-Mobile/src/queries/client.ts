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
                /**
                 * AĞ HATASINDA YENİDEN DENEME YOK; sunucu hatasında 2 deneme.
                 *
                 * Sabit `retry: 2` ile çevrimdışı bir kullanıcı şu merdiveni
                 * yaşıyordu: 10 sn zaman aşımı + 1 sn bekle + 10 sn + 2 sn +
                 * 10 sn = 33 SANİYE iskelet, sonunda hata. Üstelik bu üç
                 * denemenin hiçbirinin başarı şansı yok — taşıma katmanı
                 * ölü. api.client interceptor'ı ağ hatasını `NETWORK_ERROR`
                 * koduyla ve `status` OLMADAN normalize ediyor, bu yüzden
                 * ayrım yapmak mümkün: bağlantı yoksa HEMEN hata göster
                 * (kullanıcı 1 saniyede öğrensin), sunucu 5xx verdiyse
                 * yeniden dene (o gerçekten geçici olabilir).
                 */
                retry: (failureCount, error) => {
                    const e = error as { code?: string; status?: number } | null;
                    const isNetwork = e?.code === 'NETWORK_ERROR' || e?.status == null;
                    if (isNetwork) return false;
                    // 4xx tekrar denemekle düzelmez (401 zaten interceptor'da
                    // yenileniyor); yalnızca sunucu tarafı hatalarını dene.
                    if (e.status! < 500) return false;
                    return failureCount < 2;
                },
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
