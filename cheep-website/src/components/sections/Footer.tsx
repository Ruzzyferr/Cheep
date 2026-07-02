import { CheepBird } from '../brand/CheepBird'

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Ürün',
    links: [
      { label: 'Nasıl çalışır', href: '/#how' },
      { label: 'Özellikler', href: '/#features' },
      { label: 'Ülkeler', href: '/#coverage' },
      { label: 'İndir', href: '/#download' },
    ],
  },
  {
    title: 'Yasal',
    links: [
      { label: 'Gizlilik Politikası', href: '/privacy' },
      { label: 'Hesap Silme', href: '/delete' },
      { label: 'Kullanım Şartları', href: '/terms' },
    ],
  },
  {
    title: 'İletişim',
    links: [
      { label: 'destek@cheep.live', href: 'mailto:destek@cheep.live' },
      { label: 'gizlilik@cheep.live', href: 'mailto:gizlilik@cheep.live' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-forest-night pt-20 pb-10 text-cream/80">
      <div className="container-cheep">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <a href="#top" className="flex items-center gap-2">
              <CheepBird size={40} shadow={false} />
              <span className="font-display text-2xl font-bold text-cream">Cheep</span>
            </a>
            <p className="mt-4 max-w-xs text-sm text-cream/60">
              Aynı ürün, en ucuz fiyat. Marketlerin fiyatlarını karşılaştır, her sepette tasarruf et.
            </p>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <p className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-mint">{c.title}</p>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-cream/70 transition-colors hover:text-cream">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-cream/10 pt-8 text-sm text-cream/50 md:flex-row">
          <p>© 2026 Cheep. Tüm hakları saklıdır.</p>
          <p className="font-mono text-xs">Türkiye’de sevgiyle yapıldı 🇹🇷</p>
        </div>
      </div>
    </footer>
  )
}
