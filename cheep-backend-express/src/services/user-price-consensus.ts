/**
 * Kullanıcı katkılı fiyat — uzlaşı hesabı (SAF, test edilebilir).
 *
 * NEDEN VAR: TÜBİTAK 5 Eki 2026'da veri iznini reddetti; zincirlerin kendi
 * koşulları da yazılı izin olmadan kopyalamayı yasaklıyor (bkz.
 * `docs/VERI-IZINLERI.md`). Hukuken tartışmasız bize ait olan tek fiyat
 * verisi, kullanıcının rafta gördüğünü kendi bildirmesi.
 *
 * TASARIM İLKESİ: yanlış fiyat göstermek, hiç fiyat göstermemekten DAHA
 * KÖTÜ. Uygulamanın tek vaadi doğru karşılaştırma; bir kez yanlış sepet
 * tutarı gösterirsek güven geri gelmez. Bu yüzden her eşik "emin değilsen
 * üretme" tarafına ayarlı.
 */

export interface Bildirim {
  user_id: number;
  price: number;
  observed_on: Date;
}

export interface Uzlasi {
  price: number;
  kullanici_sayisi: number;
  aykiri_sayisi: number;
  /** 0–1. Scrape fiyatı 1.0 kabul edildiği için bu HER ZAMAN 1.0'ın altında. */
  confidence: number;
}

/** Bundan eski bildirimler sayılmaz — market fiyatı iki haftada değişir. */
const TAZELIK_GUN = 14;

/** En az bu kadar FARKLI kullanıcı aynı fiyatta buluşmalı. */
const MIN_KULLANICI = 2;

/**
 * Medyandan sapma eşiği. Ortanca mutlak sapmanın (MAD) bu katından uzak
 * bildirimler aykırı sayılır. Ortalama yerine medyan+MAD kullanılıyor çünkü
 * tek bir uç değer ortalamayı tamamen kaydırır — "5000 TL süt" vakası.
 */
const AYKIRI_KAT = 3;

/**
 * Aykırı ayıklandıktan sonra kalanların yayılımı medyanın bu oranını aşarsa
 * uzlaşı YOK sayılır. Kullanıcılar birbirini tutmuyorsa tahmin yürütmeyiz.
 */
const MAX_DAGILIM = 0.2; // %20

const medyan = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o]! : (s[o - 1]! + s[o]!) / 2;
};

/** Kuruş hassasiyeti: 24.9 girildiyse 24.9 çıkmalı, 24.900000000000002 değil. */
const kurusaYuvarla = (n: number): number => Math.round(n * 100) / 100;

export function uzlasiHesapla(bildirimler: Bildirim[]): Uzlasi | null {
  if (!bildirimler.length) return null;

  const esik = Date.now() - TAZELIK_GUN * 86400_000;

  // Geçerli + taze olanlar. Aynı kullanıcının birden çok bildirimi varsa
  // yalnızca EN YENİSİ sayılır: bir kişi tekrar ederek ağırlık kazanamaz.
  const sonBildirim = new Map<number, Bildirim>();
  for (const b of bildirimler) {
    if (!(b.price > 0)) continue;
    const t = b.observed_on.getTime();
    if (t < esik) continue;
    const mevcut = sonBildirim.get(b.user_id);
    if (!mevcut || mevcut.observed_on.getTime() < t) sonBildirim.set(b.user_id, b);
  }

  const gecerli = [...sonBildirim.values()];
  if (gecerli.length < MIN_KULLANICI) return null;

  const fiyatlar = gecerli.map((b) => b.price);
  const m = medyan(fiyatlar);
  if (!(m > 0)) return null;

  // MAD ile aykırı ayıklama.
  const mad = medyan(fiyatlar.map((p) => Math.abs(p - m)));
  // MAD sıfırsa (herkes aynı fiyatı söylemiş) medyanın küçük bir oranını
  // tolerans olarak kullan; aksi halde hiçbir sapma kabul edilmezdi.
  const tolerans = mad > 0 ? AYKIRI_KAT * mad : m * 0.02;

  const temiz = gecerli.filter((b) => Math.abs(b.price - m) <= tolerans);
  const aykiri_sayisi = gecerli.length - temiz.length;

  if (temiz.length < MIN_KULLANICI) return null;

  const temizFiyatlar = temiz.map((b) => b.price);
  const sonuc = medyan(temizFiyatlar);

  // Kalanlar hâlâ dağınıksa uzlaşı yok say.
  const yayilim = (Math.max(...temizFiyatlar) - Math.min(...temizFiyatlar)) / sonuc;
  if (yayilim > MAX_DAGILIM) return null;

  // Güven: kullanıcı sayısıyla artar, 0.85'te doyar. Scrape (1.0) seviyesine
  // ASLA çıkmaz — kullanıcı gözlemi doğası gereği daha oynak.
  const confidence = Math.min(0.85, 0.4 + 0.1 * temiz.length);

  return {
    price: kurusaYuvarla(sonuc),
    kullanici_sayisi: temiz.length,
    aykiri_sayisi,
    confidence: kurusaYuvarla(confidence),
  };
}
