import { prisma } from '../utils/prisma.client.js';

export interface BranchLite {
  id: number; store_id: number; name: string; lat: number; lon: number; address: string | null; city: string | null;
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearestBranchPerStore(branches: BranchLite[], user: { lat: number; lon: number }) {
  const best = new Map<number, { store_id: number; branch: BranchLite; distanceKm: number }>();
  for (const b of branches) {
    const d = haversineKm(user, b);
    const cur = best.get(b.store_id);
    if (!cur || d < cur.distanceKm) best.set(b.store_id, { store_id: b.store_id, branch: b, distanceKm: d });
  }
  return Array.from(best.values()).sort((x, y) => x.distanceKm - y.distanceKm);
}

export function resolveNearestBranchCoords(
  branches: BranchLite[],
  user: { lat: number; lon: number },
  maxKm = Infinity,
): Map<number, { lat: number; lon: number }> {
  const out = new Map<number, { lat: number; lon: number }>();
  for (const { store_id, branch, distanceKm } of nearestBranchPerStore(branches, user)) {
    // Yalnızca kullanıcıya GERÇEKTEN yakın bir şube varsa mesafe göster. Şube verimiz
    // henüz seyrek (çoğu İstanbul); uzaktaki bir kullanıcıya "en yakın 350 km" göstermek
    // yanıltıcıdır — o durumda mesafeyi bilinmiyor bırakırız (arayüz gizler). Veri
    // zenginleştikçe daha çok kullanıcı gerçek mesafe görür.
    if (distanceKm > maxKm) continue;
    out.set(store_id, { lat: branch.lat, lon: branch.lon });
  }
  return out;
}

/** DB: nearest branch per store near the user, widening the bbox until non-empty.
 *
 *  `deltas` DERECE cinsindendir, kilometre değil — ±1° ≈ 111 km. Yani ilk geçiş
 *  bile geniş bir alanı tarar ve kutu genişletme yalnızca "hiç şube yoksa daha
 *  uzağa bak" içindir. Fonksiyon TASARIM GEREĞİ mesafe kesmesi uygulamaz:
 *  çağıranların bir kısmı (mobil konum kapısı) "kullanıcının seçebileceği EN
 *  GENİŞ yarıçapta hiç şube var mı?" sorusunu sorabilmek için geniş kümeyi
 *  ister ve süzmeyi kendisi yapar.
 *
 *  `radiusKm` VERİLİRSE gerçek haversine mesafesiyle süzülür. Bu ekleme
 *  bilerek YALNIZCA EKLEMELİDİR: parametre yokken davranış birebir eskisi
 *  gibidir, yani mevcut çağıranların hiçbiri etkilenmez. Eklenme sebebi,
 *  `/nearby` adlı bir ucun 4,6 km'deki (ve veri seyrekken teoride yüzlerce km
 *  ötedeki) bir şubeyi "yakın" diye döndürmesinin çağıranı şaşırtması —
 *  mobil istemcideki uzun savunma yorumu bu şaşkınlığın kanıtı.
 */
export async function getNearbyStores(
  countryId: number,
  user: { lat: number; lon: number },
  deltas: number[] = [1.0, 3.0, 8.0],
  radiusKm?: number,
) {
  for (const delta of deltas) {
    const rows = await prisma.storeBranch.findMany({
      where: {
        country_id: countryId,
        lat: { gte: user.lat - delta, lte: user.lat + delta },
        lon: { gte: user.lon - delta, lte: user.lon + delta },
      },
      select: { id: true, store_id: true, name: true, lat: true, lon: true, address: true, city: true },
    });
    if (rows.length === 0) continue;
    const nearest = nearestBranchPerStore(rows as BranchLite[], user);
    if (radiusKm === undefined) return nearest;
    const inRadius = nearest.filter((n) => n.distanceKm <= radiusKm);
    // Bu delta'da şube VARDI ama hiçbiri yarıçapta değilse daha geniş kutuya
    // bakmanın anlamı yok: kutu büyüdükçe mesafeler yalnızca ARTAR.
    return inRadius;
  }
  return [];
}

/** En yakın şubenin geçerli sayılacağı azami mesafe (km). Bunun ötesinde "yakın şubemiz
 *  yok" kabul edilir ve mesafe gösterilmez. Metropol içi (ör. İstanbul iki yaka) kapsar. */
export const MAX_BRANCH_DISTANCE_KM = 60;

/** DB: nearest branch coords per given store within a country (for compare distance).
 *  Yalnızca kullanıcıya azami mesafedeki şubeler döner. radiusKm verilirse o kullanılır
 *  (kullanıcının seçtiği yürüme/araba yarıçapı), yoksa MAX_BRANCH_DISTANCE_KM (mesafeyi
 *  gösterme eşiği). radiusKm ile çağrı hem konum verir hem de o marketin rotaya alınıp
 *  alınmayacağını belirler — bu yüzden değeri döndürülen map'te olan mağazalar "yakın"dır. */
export async function nearestBranchCoordsForStores(
  storeIds: number[],
  countryId: number,
  user: { lat: number; lon: number },
  radiusKm?: number,
) {
  const rows = await prisma.storeBranch.findMany({
    where: { country_id: countryId, store_id: { in: storeIds } },
    select: { id: true, store_id: true, name: true, lat: true, lon: true, address: true, city: true },
  });
  return resolveNearestBranchCoords(rows as BranchLite[], user, radiusKm ?? MAX_BRANCH_DISTANCE_KM);
}
