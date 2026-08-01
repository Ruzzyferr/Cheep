import { SiteLink as Link } from '../ui/SiteLink'
import { CheepBird } from '../brand/CheepBird'
import { useT, useHref } from '../../i18n'

export function Footer() {
  const t = useT()
  const href = useHref()
  const home = href('/')

  /** Çapa bağlantıları ana sayfaya döner (yasal sayfalardan da çalışsın diye). */
  const resolve = (h: string) =>
    h.startsWith('#') ? (home === '/' ? `/${h}` : `${home}${h}`) : href(h)

  return (
    <footer className="bg-forest-night pt-16 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-cream/80 md:pt-20">
      <div className="container-cheep">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-5">
          <div className="col-span-2">
            <Link to={home} className="inline-flex items-center gap-2 py-1">
              <CheepBird size={40} shadow={false} />
              <span className="font-display text-2xl font-bold text-cream">Cheep</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-cream/60">{t.footer.tagline}</p>
          </div>

          {t.footer.cols.map((c) => (
            <div key={c.title}>
              <p className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-mint">
                {c.title}
              </p>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('/') ? (
                      <Link
                        to={href(l.href)}
                        className="-mx-2 block rounded-lg px-2 py-3 text-sm text-cream/70 transition-colors hover:bg-cream/5 hover:text-cream"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={resolve(l.href)}
                        className="-mx-2 block rounded-lg px-2 py-3 text-sm text-cream/70 transition-colors hover:bg-cream/5 hover:text-cream"
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-14 border-t border-cream/10 pt-8 text-xs leading-relaxed text-cream/65">
          {t.footer.disclaimer}
        </p>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-sm text-cream/50 md:flex-row">
          <p>{t.footer.copyright}</p>
          <p className="font-mono text-xs">{t.footer.madeIn}</p>
        </div>
      </div>
    </footer>
  )
}
