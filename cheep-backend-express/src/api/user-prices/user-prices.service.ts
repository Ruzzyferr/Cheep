/**
 * Kullanıcı fiyat bildirimi servisi.
 *
 * AKIŞ: kullanıcı bildirir → ham kayıt (`user_price_reports`) → uzlaşı
 * yeniden hesaplanır → yeterliyse `store_prices`a `source='user'` yazılır.
 *
 * NEDEN `store_prices`a YAZIYORUZ: karşılaştırma motoru, arama, rota ve
 * anasayfa zaten oradan okuyor. Paralel bir tablo kurup her okuma yolunu
 * değiştirmek, aynı sonucu çok daha geniş bir kırılma yüzeyiyle verirdi.
 */
import { prisma } from '../../utils/prisma.client.js';
import { notFound, badRequest } from '../../utils/app-error.js';
import { uzlasiHesapla, type Bildirim } from '../../services/user-price-consensus.js';

/** Uzlaşı penceresi — saf mantıktaki TAZELIK_GUN ile aynı olmak zorunda. */
const PENCERE_GUN = 14;

/** Bugünün tarihi, saat bileşeni olmadan (günlük tek bildirim kuralı için). */
const bugun = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Bir (ürün, market) çifti için uzlaşıyı yeniden hesaplar ve `store_prices`a
 * yansıtır.
 *
 * SCRAPE FİYATININ ÜSTÜNE YAZMAZ — yalnızca BOŞLUK doldurur. Kullanıcı
 * gözlemi doğası gereği daha oynak ve kötüye kullanıma açık; mevcut doğru
 * bir fiyatı bozma riski, boşluk doldurma kazancından büyüktür.
 */
export const uzlasiyiYenile = async (product_id: number, store_id: number) => {
  const esik = new Date(Date.now() - PENCERE_GUN * 86400_000);

  const ham = await prisma.userPriceReport.findMany({
    where: { product_id, store_id, status: 'active', observed_on: { gte: esik } },
    select: { user_id: true, price: true, observed_on: true },
  });

  const bildirimler: Bildirim[] = ham.map((r) => ({
    user_id: r.user_id,
    price: Number(r.price),
    observed_on: r.observed_on,
  }));

  const uzlasi = uzlasiHesapla(bildirimler);
  if (!uzlasi) return null;

  const mevcut = await prisma.storePrice.findUnique({
    where: { store_id_product_id: { store_id, product_id } },
    select: { id: true, source: true },
  });

  if (!mevcut) {
    await prisma.storePrice.create({
      data: {
        store_id,
        product_id,
        price: uzlasi.price,
        source: 'user',
        confidence_score: uzlasi.confidence,
      },
    });
    return uzlasi;
  }

  if (mevcut.source !== 'user') return uzlasi;

  await prisma.storePrice.update({
    where: { id: mevcut.id },
    data: {
      price: uzlasi.price,
      confidence_score: uzlasi.confidence,
      last_updated_at: new Date(),
    },
  });
  return uzlasi;
};

/** Kullanıcının fiyat bildirimini kaydeder (aynı çift için günde bir). */
export const bildirimOlustur = async (data: {
  user_id: number;
  product_id: number;
  store_id: number;
  price: number;
  unit?: string;
}) => {
  if (!(data.price > 0)) throw badRequest('Fiyat sıfırdan büyük olmalı');
  // Gerçekçilik sınırı: yanlış basılan bir rakam katalogu bozmasın.
  if (data.price > 100000) throw badRequest('Fiyat beklenen aralığın dışında');

  const [urun, market] = await Promise.all([
    prisma.product.findUnique({ where: { id: data.product_id }, select: { id: true, country_id: true } }),
    prisma.store.findUnique({ where: { id: data.store_id }, select: { id: true, country_id: true } }),
  ]);
  if (!urun) throw notFound('Ürün bulunamadı');
  if (!market) throw notFound('Market bulunamadı');
  // Ülke karışmasın: PL kullanıcısı TR ürününe TR marketinden fiyat yazmasın.
  if (urun.country_id !== market.country_id) {
    throw badRequest('Ürün ve market aynı ülkeye ait olmalı');
  }

  const gun = bugun();
  await prisma.userPriceReport.upsert({
    where: {
      user_id_product_id_store_id_observed_on: {
        user_id: data.user_id,
        product_id: data.product_id,
        store_id: data.store_id,
        observed_on: gun,
      },
    },
    update: { price: data.price, unit: data.unit ?? 'adet', status: 'active' },
    create: {
      user_id: data.user_id,
      product_id: data.product_id,
      store_id: data.store_id,
      price: data.price,
      unit: data.unit ?? 'adet',
      observed_on: gun,
    },
  });

  const uzlasi = await uzlasiyiYenile(data.product_id, data.store_id);
  return { kaydedildi: true, uzlasi: uzlasi ?? null };
};

/** Kullanıcının kendi bildirimleri (şeffaflık + silme hakkı). */
export const bildirimlerim = async (user_id: number) =>
  prisma.userPriceReport.findMany({
    where: { user_id },
    orderBy: { created_at: 'desc' },
    take: 100,
    include: {
      product: { select: { id: true, name: true, image_url: true } },
      store: { select: { id: true, name: true } },
    },
  });
