import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheepBird } from '../brand/CheepBird'
import { Footer } from '../sections/Footer'

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <>
      <header className="border-b border-line bg-paper/80 backdrop-blur">
        <div className="container-cheep flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-2">
            <CheepBird size={36} shadow={false} />
            <span className="font-display text-xl font-bold text-forest-deep">Cheep</span>
          </Link>
          <Link
            to="/"
            className="rounded-full border border-forest/20 px-4 py-2 text-sm font-semibold text-forest-deep transition-colors hover:bg-mint-soft"
          >
            ← Ana sayfa
          </Link>
        </div>
      </header>

      <main className="bg-cream py-16 md:py-24">
        <article className="container-cheep max-w-3xl">
          <p className="eyebrow mb-4 text-clementine">Cheep · Yasal</p>
          <h1 className="text-4xl font-bold text-ink md:text-5xl">{title}</h1>
          <p className="mt-3 font-mono text-sm text-ink-soft">Son güncelleme: {updated}</p>
          <div className="prose-cheep mt-10">{children}</div>
        </article>
      </main>

      <Footer />
    </>
  )
}
