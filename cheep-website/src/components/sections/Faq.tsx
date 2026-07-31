import { Reveal } from '../ui/Reveal'
import { useT } from '../../i18n'

/**
 * Native `<details>` kullanılıyor: JS'siz de açılır, klavye/ekran okuyucu
 * desteği hazır gelir ve içerik kapalıyken de HTML'de bulunur — arama motoru
 * cevapları görür. Aynı sorular FAQPage JSON-LD'sine de girer (src/seo/pages.ts).
 */
export function Faq() {
  const t = useT()

  return (
    <section id="faq" className="relative bg-cream py-24 md:py-36">
      <div className="container-cheep">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="eyebrow mb-4 text-clementine-deep">{t.faq.eyebrow}</p>
          <h2 className="text-section text-ink">{t.faq.title}</h2>
          <p className="mt-5 text-lg text-ink-soft">{t.faq.sub}</p>
        </Reveal>

        <Reveal stagger className="mx-auto flex max-w-3xl flex-col gap-3">
          {t.faq.items.map((item) => (
            <details
              key={item.q}
              className="faq-item group rounded-3xl border border-line bg-paper px-6 shadow-soft transition-colors duration-300 open:border-mint/50"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-display text-lg font-bold text-ink md:text-xl">
                {item.q}
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint-soft text-forest transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-6 pr-12 text-ink-soft">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
