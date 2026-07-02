# Cheep — Website (cheep.live)

Cheep'in halka açık tanıtım sitesi ve yasal sayfaları. Yüksek etkileşimli, "Fresh Market"
temalı tek-sayfa (landing) + yasal rotalar.

## Stack

- **Vite + React 19 + TypeScript**
- **Tailwind CSS v4** (design token'ları `src/index.css` → `@theme`)
- **React Three Fiber + drei + postprocessing** — hero'daki WebGL aurora + refraktif cam etiketler
- **GSAP + ScrollTrigger** — giriş animasyonları, scroll-parallax, reveal, count-up
- **Lenis** — yumuşak scroll
- **react-router-dom** — `/`, `/privacy`, `/delete`, `/terms`

Marka DNA'sı mobil uygulamayla birebir: Space Grotesk / Hanken Grotesk / Space Mono,
forest–mint–clementine paleti, ve `CheepBird` (maskot, mobildeki `CheepMascot`'tan port).

## Geliştirme

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build → dist/
npm run preview
```

### Ortam değişkeni

Hesap silme formu backend'e POST eder. Varsayılan `https://api.cheep.live/api/v1`.
Gerekirse `.env` içine:

```
VITE_API_URL=https://api.cheep.live/api/v1
```

## Yapı

```
src/
  components/
    brand/CheepBird.tsx        # maskot (SVG, tek kaynak)
    canvas/HeroCanvas.tsx      # WebGL aurora + cam etiketler + post-processing
    sections/                  # Hero, Compare, HowItWorks, Savings, Coverage, Features, Download, Footer
    legal/LegalLayout.tsx      # yasal sayfa şablonu
    ui/                        # Nav, Reveal, CountUp
  pages/                       # Home, Privacy, DeleteAccount, Terms
  lib/                         # useSmoothScroll, utils
```

## Görsel QA

`scripts/shot.py` ve `scripts/shotpaths.py` (Playwright) dev sunucusunu ekran görüntüsüyle
inceler. `reduced_motion` ile Lenis/reveal devre dışı bırakılır (native scroll + içerik görünür).

## Dağıtım (deploy)

Statik SPA. Vercel/Netlify gibi bir yere `dist/` olarak çıkar; SPA fallback (tüm yolları
`index.html`'e yönlendir) gerekir ki `/privacy`, `/delete` derin bağlantıları çalışsın.
`cheep.live` DNS'i o sağlayıcıya yöneltilir.
