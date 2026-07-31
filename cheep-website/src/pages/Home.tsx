import { Nav } from '../components/ui/Nav'
import { Hero } from '../components/sections/Hero'
import { Compare } from '../components/sections/Compare'
import { HowItWorks } from '../components/sections/HowItWorks'
import { Savings } from '../components/sections/Savings'
import { Coverage } from '../components/sections/Coverage'
import { Features } from '../components/sections/Features'
import { Faq } from '../components/sections/Faq'
import { Download } from '../components/sections/Download'
import { Footer } from '../components/sections/Footer'

export function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Compare />
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
