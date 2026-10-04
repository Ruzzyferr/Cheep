/**
 * Bir listedeki ürün adetlerini okur ve yazar — ürün ızgaralarında kullanılır.
 *
 * NEDEN KANCA: aynı mantık hem aramada hem kategori listesinde lazım. İki
 * ekrana ayrı ayrı yazılsaydı geciktirme süresi, bekleyen-değişiklik yönetimi
 * ve silme eşiği zamanla birbirinden kayardı.
 *
 * BEKLEYEN DEĞİŞİKLİK: `+`'ya basıldığı anda sayı yerel olarak artar, sunucuya
 * 500 ms sonra tek istekte yazılır. Üç kez basmak üç istek değil bir istek
 * eder ve sayı parmağın gerisinde kalmaz.
 *
 * EKRANDAN ÇIKIŞTA BOŞA DÜŞÜRME: zamanlayıcıyı iptal etmek yetmez —
 * kullanıcı `+`'ya basıp 500 ms dolmadan geri giderse değişikliği SESSİZCE
 * kaybederdik. Bu yüzden sökülürken bekleyen yazmalar iptal değil, DERHAL
 * gönderiliyor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useListDetail, useListMutations } from '../queries';
import { listService } from '../services';
import { adetHaritasiKur, type AdetKaydi } from '../utils/quantity';

/** Geciktirme penceresi: hızlı art arda dokunuşları tek isteğe toplar. */
const GECIKME_MS = 500;

export function useListQuantities(listId?: number) {
  const { data: liste } = useListDetail(listId);
  const { invalidateLists } = useListMutations();

  // Sunucudaki gerçek: product_id -> { itemId, quantity }. Saf kısmı
  // `utils/quantity` içinde ve testli (alan adı tuzağı orada anlatılıyor).
  const sunucu = useMemo(() => adetHaritasiKur(liste), [liste]);

  // Henüz yazılmamış yerel değişiklikler: product_id -> adet
  const [bekleyen, setBekleyen] = useState<Record<number, number>>({});
  const zamanlayicilar = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  // Sökülme anında ne göndereceğimizi bilmek için: product_id -> { kayit, adet }
  const kuyruk = useRef(new Map<number, { kayit: AdetKaydi; adet: number }>());

  /** Asıl ağ işi. Sökülme sırasında da çağrıldığı için setState İÇERMEZ. */
  const gonder = useCallback(
    async (kayit: AdetKaydi, adet: number) => {
      if (adet <= 0) await listService.deleteItem(listId as number, kayit.itemId);
      else await listService.updateItem(kayit.itemId, { quantity: adet });
    },
    [listId],
  );

  // Sökülürken: zamanlayıcıları durdur ama bekleyen yazmaları GÖNDER.
  // `gonder` ve `invalidateLists` ref üzerinden okunuyor; effect'in bağımlılığı
  // boş kalsın ki temizlik yalnızca gerçekten sökülürken çalışsın.
  const gonderRef = useRef(gonder);
  gonderRef.current = gonder;
  const invalidateRef = useRef(invalidateLists);
  invalidateRef.current = invalidateLists;

  useEffect(() => {
    const zamanlar = zamanlayicilar.current;
    const bekleyenler = kuyruk.current;
    return () => {
      zamanlar.forEach(clearTimeout);
      zamanlar.clear();
      if (bekleyenler.size === 0) return;
      const isler = [...bekleyenler.values()].map(({ kayit, adet }) =>
        gonderRef.current(kayit, adet).catch(() => {}),
      );
      bekleyenler.clear();
      // Yazmalar bittikten sonra önbelleği tazele ki geri dönülen ekran
      // güncel adedi göstersin.
      Promise.all(isler).then(() => invalidateRef.current()).catch(() => {});
    };
  }, []);

  const adetAl = useCallback(
    (productId: number): number => bekleyen[productId] ?? sunucu.get(productId)?.quantity ?? 0,
    [bekleyen, sunucu],
  );

  const planla = useCallback(
    (productId: number, yeni: number) => {
      const kayit = sunucu.get(productId);
      if (!kayit) return; // Ürün listede değil — eklemek `onAddToCart`in işi.

      kuyruk.current.set(productId, { kayit, adet: yeni });
      const mevcut = zamanlayicilar.current.get(productId);
      if (mevcut) clearTimeout(mevcut);

      zamanlayicilar.current.set(
        productId,
        setTimeout(async () => {
          zamanlayicilar.current.delete(productId);
          kuyruk.current.delete(productId);
          try {
            await gonder(kayit, yeni);
            await invalidateLists();
          } finally {
            // Başarıda da hatada da yereli bırak: sunucu tek doğru kaynak.
            setBekleyen((o) => {
              const { [productId]: _birakilan, ...kalan } = o;
              return kalan;
            });
          }
        }, GECIKME_MS),
      );
    },
    [sunucu, gonder, invalidateLists],
  );

  const adetDegistir = useCallback(
    (productId: number, yeni: number) => {
      setBekleyen((o) => ({ ...o, [productId]: yeni }));
      planla(productId, yeni);
    },
    [planla],
  );

  const adetSil = useCallback(
    (productId: number) => {
      setBekleyen((o) => ({ ...o, [productId]: 0 }));
      planla(productId, 0);
    },
    [planla],
  );

  return { adetAl, adetDegistir, adetSil };
}
