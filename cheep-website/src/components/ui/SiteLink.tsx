import { Link, type LinkProps } from 'react-router-dom'

/**
 * Sayfalar arası bağlantı — TAM BELGE YÜKLER.
 *
 * NEDEN: bu site istemci tarafında yönlendirilen bir SPA DEĞİL. Her sayfa
 * ayrı ayrı prerender ediliyor ve verisi o sayfanın HTML'ine gömülüyor
 * (`window.__CHEEP__`, bkz. `data/context.tsx`). React yalnızca hydrate
 * ediyor.
 *
 * Düz `<Link>` istemci tarafı geçiş yapıyordu: URL değişiyor ama BELGE
 * değişmiyor, dolayısıyla yeni sayfanın gömülü verisi hiç gelmiyordu.
 * `ContentRoute` veriyi bulamayınca "Bu sayfa bulunamadı" basıyordu —
 * anasayfadaki "En ucuz market hangisi", "Zam raporu" ve kategori hapları
 * tam olarak bu yüzden çalışmıyordu.
 *
 * `reloadDocument` tarayıcıya normal bir gezinme yaptırır: doğru HTML, doğru
 * veri, doğru `<head>`. Statik üretilmiş bir sitede zaten istenen davranış bu.
 *
 * DİKKAT — aynı sayfa içindeki durum değişiklikleri (ürünler sayfasının
 * filtreleri) `useSearchParams` ile yapılır ve buradan GEÇMEZ; onlar belge
 * yenilemeden çalışmalı.
 */
export function SiteLink(props: LinkProps) {
  return <Link {...props} reloadDocument />
}
