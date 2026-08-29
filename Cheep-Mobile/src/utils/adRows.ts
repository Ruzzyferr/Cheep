/**
 * Izgara listesine reklam satırı yerleştirme kararı.
 *
 * NEDEN AYRI VE SAF: yerleşim kuralı ("kaçıncı satırdan sonra, hangi
 * koşulda") bir ÜRÜN kararı ve yanlış olduğunda pahalı — çok yukarıda olursa
 * kullanıcı sonuç yerine reklam görür, çok aşağıda olursa kimse görmez ve
 * reklam hiç gelir üretmez. Bileşenin içine gömülse hiçbiri test edilemezdi.
 */

export interface AdRow {
  kind: 'ad';
  key: string;
}

export interface ItemsRow<T> {
  kind: 'items';
  key: string;
  items: T[];
}

export type GridRow<T> = ItemsRow<T> | AdRow;

/**
 * Reklamın görünmesi için gereken EN AZ sonuç sayısı.
 *
 * 2 sonuç, iki sütunlu ızgarada tek satır demek — oraya reklam koymak ekranı
 * reklamın domine etmesi olurdu (yarısı sonuç, yarısı reklam). Reklam ancak
 * ALTINDA da içerik varken meşru: kullanıcı gerçek sonuçların arasında bir
 * reklam görür, reklamın etrafında birkaç sonuç değil.
 */
export const MIN_RESULTS_FOR_AD = 3;

/**
 * Reklam KAÇINCI satırdan sonra?
 *
 * 1 = ilk satırdan (iki sütunlu ızgarada ilk İKİ üründen) sonra.
 * Bilerek yukarıda: kullanıcıların çoğu arama sonuçlarında aşağı inmiyor,
 * 8. sonuçtan sonraki bir reklam pratikte hiç görülmez. Ama ilk satırın
 * ÜSTÜNE de konulmuyor — aranan şeyin cevabı her zaman reklamdan önce gelir.
 */
export const AD_AFTER_ROW = 1;

/**
 * Düz öğe listesini, aralarına reklam satırı serpiştirilmiş ızgara
 * satırlarına çevirir (SAF).
 *
 * @param items    sonuç listesi
 * @param columns  ızgara sütun sayısı
 * @param withAd   reklam yerleştirilsin mi (premium/rıza kapalıysa false)
 */
export function buildGridRows<T>(
  items: readonly T[],
  columns: number,
  withAd: boolean,
): GridRow<T>[] {
  if (columns < 1) throw new Error(`sütun sayısı en az 1 olmalı: ${columns}`);

  const rows: GridRow<T>[] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push({ kind: 'items', key: `r${i}`, items: items.slice(i, i + columns) });
  }

  const eligible = withAd && items.length >= MIN_RESULTS_FOR_AD && rows.length > AD_AFTER_ROW;
  if (eligible) {
    rows.splice(AD_AFTER_ROW, 0, { kind: 'ad', key: 'ad-0' });
  }
  return rows;
}
