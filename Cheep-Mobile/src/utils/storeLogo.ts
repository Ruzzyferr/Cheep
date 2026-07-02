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
export function getStoreTint(storeName?: string | null): string {
  const n = (storeName || '').toLowerCase();
  const map = colors.storeChips as Record<string, string>;
  if (n.includes('bim')) return map.bim;
  if (n.includes('migros')) return map.migros;
  if (n.includes('a101')) return map.a101;
  if (n.includes('şok') || n.includes('sok')) return map.sok;
  if (n.includes('carrefour')) return map.carrefoursa;
  return colors.primary.main;
}

/** Rozet etiketi — markanın baş harfi. */
export function getStoreInitial(storeName?: string | null): string {
  const s = (storeName || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
}
