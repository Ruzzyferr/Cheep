import type { ReactNode } from 'react'
import { SiteLink as Link } from '../ui/SiteLink'
import { CheepBird } from '../brand/CheepBird'
import { Footer } from '../sections/Footer'
import { useT, useHref } from '../../i18n'

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  const t = useT()
  const href = useHref()

  return (
    <>
      <header className="border-b border-line bg-paper/80 backdrop-blur">
        <div className="container-cheep flex items-center justify-between gap-4 py-3">
          <Link to={href('/')} className="flex items-center gap-2 py-2" aria-label={t.nav.home}>
            <CheepBird size={36} shadow={false} />
            <span className="font-display text-xl font-bold text-forest-deep">Cheep</span>
          </Link>
          <Link
            to={href('/')}
            className="rounded-full border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest-deep transition-colors hover:bg-mint-soft"
          >
            {t.legal.backHome}
          </Link>
        </div>
      </header>

      <main className="bg-cream py-14 md:py-24">
        <article className="container-cheep max-w-3xl">
          <p className="eyebrow mb-4 text-clementine-deep">{t.legal.eyebrow}</p>
          <h1 className="text-4xl font-bold text-ink md:text-5xl">{title}</h1>
          <p className="mt-3 font-mono text-sm text-ink-soft">
            {t.legal.updatedPrefix} {updated}
          </p>
          <div className="prose-cheep mt-10">{children}</div>
        </article>
      </main>

      <Footer />
    </>
  )
}
