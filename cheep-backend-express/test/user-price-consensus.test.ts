import { describe, it, expect } from 'vitest';
import { uzlasiHesapla, type Bildirim } from '../src/services/user-price-consensus.js';

/**
 * Kullanıcı katkılı fiyat — uzlaşı mantığı.
 *
 * NEDEN VAR: TÜBİTAK 5 Eki 2026'da veri iznini REDDETTİ ve zincirlerin kendi
 * koşulları da yazılı izin olmadan kopyalamayı yasaklıyor. Hukuken bize ait
 * TEK veri, kullanıcının kendi gözlemi. Bu yüzden bu mantık uygulamanın
 * Türkiye'deki geleceğini taşıyor — yanlış fiyat üretmesi, hiç fiyat
 * üretmemesinden daha kötü.
 */
const b = (user_id: number, price: number, gunOnce = 0): Bildirim => ({
  user_id,
  price,
  observed_on: new Date(Date.now() - gunOnce * 86400_000),
});

describe('uzlasiHesapla — guven esigi', () => {
  it('TEK kullanici fiyat olusturamaz', () => {
    // Kotuye kullanim onlemi: bir kisi istedigi fiyati yazip katalogu
    // zehirleyemesin.
    expect(uzlasiHesapla([b(1, 50)])).toBeNull();
  });

  it('ayni kullanicinin cok bildirimi TEK sayilir', () => {
    expect(uzlasiHesapla([b(1, 50), b(1, 51, 1), b(1, 52, 2)])).toBeNull();
  });

  it('iki FARKLI kullanici uzlasirsa fiyat olusur', () => {
    const s = uzlasiHesapla([b(1, 50), b(2, 50)]);
    expect(s?.price).toBe(50);
    expect(s?.kullanici_sayisi).toBe(2);
  });
});

describe('uzlasiHesapla — aykiri deger', () => {
  it('tek asiri deger medyani BOZMAZ', () => {
    const s = uzlasiHesapla([b(1, 50), b(2, 51), b(3, 49), b(4, 5000)]);
    expect(s?.price).toBe(50);
  });

  it('aykiri bildirim sayilmaz ama kayit disi birakilmaz', () => {
    const s = uzlasiHesapla([b(1, 50), b(2, 51), b(3, 49), b(4, 5000)]);
    expect(s?.aykiri_sayisi).toBe(1);
  });

  it('hepsi dagiliksa fiyat URETILMEZ', () => {
    // Uzlasi yoksa tahmin yurutmek yanlis fiyat gostermekten iyi degil.
    expect(uzlasiHesapla([b(1, 10), b(2, 90), b(3, 300)])).toBeNull();
  });
});

describe('uzlasiHesapla — tazelik', () => {
  it('ESKI bildirimler sayilmaz', () => {
    expect(uzlasiHesapla([b(1, 50, 40), b(2, 50, 45)])).toBeNull();
  });

  it('taze ve eski karisiksa yalnizca taze olanlar kullanilir', () => {
    const s = uzlasiHesapla([b(1, 50), b(2, 50), b(3, 999, 40)]);
    expect(s?.price).toBe(50);
    expect(s?.kullanici_sayisi).toBe(2);
  });
});

describe('uzlasiHesapla — guven skoru', () => {
  it('daha cok kullanici daha yuksek guven', () => {
    const az = uzlasiHesapla([b(1, 50), b(2, 50)])!;
    const cok = uzlasiHesapla([b(1, 50), b(2, 50), b(3, 50), b(4, 50), b(5, 50)])!;
    expect(cok.confidence).toBeGreaterThan(az.confidence);
  });

  it('guven 0 ile 1 arasinda kalir', () => {
    const c = uzlasiHesapla(Array.from({ length: 50 }, (_, i) => b(i + 1, 50)))!;
    expect(c.confidence).toBeGreaterThan(0);
    expect(c.confidence).toBeLessThanOrEqual(1);
  });

  it('SCRAPE fiyatindan daha DUSUK guvende baslar', () => {
    // store_prices.confidence_score varsayilani 1.0 (scrape). Kullanici
    // uzlasisi hicbir zaman onun kadar guvenilir sayilmamali.
    const c = uzlasiHesapla([b(1, 50), b(2, 50)])!;
    expect(c.confidence).toBeLessThan(1.0);
  });
});

describe('uzlasiHesapla — gecersiz girdi', () => {
  it('bos liste null', () => {
    expect(uzlasiHesapla([])).toBeNull();
  });
  it('sifir/negatif fiyat sayilmaz', () => {
    expect(uzlasiHesapla([b(1, 0), b(2, -5), b(3, 50)])).toBeNull();
  });
  it('kurus hassasiyeti korunur', () => {
    const s = uzlasiHesapla([b(1, 24.9), b(2, 24.9)]);
    expect(s?.price).toBe(24.9);
  });
});
