import { Nav } from '../components/ui/Nav'
import { Hero } from '../components/sections/Hero'
import { Compare } from '../components/sections/Compare'
import { LiveDrops } from '../components/sections/LiveDrops'
import { HowItWorks } from '../components/sections/HowItWorks'
import { Savings } from '../components/sections/Savings'
import { Coverage } from '../components/sections/Coverage'
import { Features } from '../components/sections/Features'
import { Faq } from '../components/sections/Faq'
import { Download } from '../components/sections/Download'
import { Footer } from '../components/sections/Footer'
import { PausedHome } from './PausedHome'

/**
 * DURAKLATMA BAYRAGI — 5 Eki 2026.
 *
 * `true` iken ana sayfa yerine dürüst bir durum sayfası çiziliyor
 * (`PausedHome.tsx`). Asagidaki pazarlama bölümleri kodda OLDUGU GIBI
 * duruyor; bayrak `false` yapilinca hepsi geri gelir.
 *
 * NEDEN: uygulama iki mağazadan da çekildi ve sunucu kapatildi. Eski ana
 * sayfa "5 ülkede canlı · 120.000+ ürün", ülke başına "Canlı" rozeti, 20
 * zincirin logosu ve "Resmi veri · düzenli güncellenir" diyordu. Hiçbiri
 * artik dogru degil. Ayrica alt bilgideki `/zam-raporu` ve `/en-ucuz-market`
 * baglantilari 404 veriyor (içerik sayfalari artik üretilmiyor), `#how`
 * `#features` gibi çapalar da bos.
 *
 * GERI ACARKEN: bayragi `false` yap, `PausedHome.tsx` ve
 * `components/PauseBanner.tsx` dosyalarini sil, `AppRoutes.tsx` içindeki
 * `<PauseBanner />` satirini kaldir.
 */
const DURAKLATILDI = true

export function Home() {
  if (DURAKLATILDI) return <PausedHome />

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Compare />
        {/* Canlı kanıt, iddiadan hemen sonra. Veri yoksa kendini render etmez. */}
        <LiveDrops />
        <HowItWorks />
        <Savings />
        <Coverage />
        <Features />
        <Faq />
        <Download />
      </main>
      <Footer />
    </>
  )
}
