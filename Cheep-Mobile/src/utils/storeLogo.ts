/**
 * 🏪 Store Badge Utility
 *
 * Telifli market logoları KULLANILMAZ. Marka adları yalnızca atıf amacıyla
 * (hangi markete ait fiyat gösteriliyor) metin/renk rozetiyle belirtilir — bu
 * hukuki riski (logo telifi + marka tecavüzü) en aza indirir.
 *
 * `getStoreLogoAsset` geriye dönük uyumluluk için korunur ama daima null döner;
 * böylece tüm çağrı yerleri renkli baş-harf rozeti fallback'ine düşer. İleride
 * LİSANSLI bir logo eklenirse buraya konabilir.
 */
import { colors } from '../theme';

/** Lisanslı logo yok → her zaman null (çağrı yerleri renkli rozete düşer). */
export function getStoreLogoAsset(_country?: string | null, _storeName?: string | null): any {
  return null;
}

export function getStoreLogoSource(_country?: string | null, _storeName?: string | null): { source: any } | null {
  return null;
}

/** Markanın rozet arka-plan rengi (marka renk paleti; eşleşme yoksa forest). */
/**
 * Ad eşleştirme için normalleştirme: küçük harf + BİRLEŞEN İŞARETLERİ AT.
 *
 * NEDEN GEREKLİ (gerçek hata): JavaScript'te `'BİM'.toLowerCase()` çıktısı
 * `'bim'` DEĞİL, `'bi̇m'`dir — Türkçe noktalı büyük İ, küçük 'i' + BİRLEŞEN
 * NOKTA (U+0307) olarak açılır. Dolayısıyla `n.includes('bim')` FALSE dönüyor
 * ve Türkiye'nin en büyük indirimcisi rozet renginde jenerik yedeğe düşüyordu.
 * Aynı sınıf hata Lehçe/Hırvatça/Macarca/Romence adlarda da yaşanabilirdi.
 *
 * NFD ile ayrıştırıp birleşen işaretleri silmek hepsini birden çözüyor.
 */
function foldName(input?: string | null): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function getStoreTint(storeName?: string | null): string {
  const n = foldName(storeName);
  const map = colors.storeChips as Record<string, string>;

  // SIRA ÖNEMLİ: daha ÖZGÜL ad önce gelmeli. "mega image" satırı "migros"tan
  // önce değil ama "sok" satırı "konzum"dan SONRA olmalı değil — burada
  // çakışan tek çift 'carrefoursa'/'carrefour' ve ikisi aynı renge gidiyor.
  // Yeni zincir eklerken, adının başka bir zincirin adının İÇİNDE geçip
  // geçmediğini kontrol et.
  if (n.includes('bim')) return map.bim;
  if (n.includes('migros')) return map.migros;
  if (n.includes('a101')) return map.a101;
  if (n.includes('sok')) return map.sok;   // 'ŞOK' da buraya düşer (aksan katlandı)
  if (n.includes('carrefour')) return map.carrefoursa;
  // Polonya
  if (n.includes('biedronka')) return map.biedronka;
  if (n.includes('zabka')) return map.zabka;   // 'Żabka' da buraya düşer
  if (n.includes('dino')) return map.dino;
  // Çok ülkeli
  if (n.includes('auchan')) return map.auchan;
  if (n.includes('lidl')) return map.lidl;
  if (n.includes('kaufland')) return map.kaufland;
  if (n.includes('spar')) return map.spar;          // Interspar da buraya düşer
  if (n.includes('tesco')) return map.tesco;
  if (n.includes('aldi')) return map.aldi;
  if (n.includes('penny')) return map.penny;
  // Hırvatistan
  if (n.includes('konzum')) return map.konzum;
  if (n.includes('plodine')) return map.plodine;
  if (n.includes('tommy')) return map.tommy;
  // Romanya
  if (n.includes('mega image') || n.includes('megaimage')) return map.megaimage;
  if (n.includes('profi')) return map.profi;
  return colors.primary.main;
}

/** Rozet etiketi — markanın baş harfi. */
export function getStoreInitial(storeName?: string | null): string {
  const s = (storeName || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}
