import type { Facet } from '../../lib/api'
import { formatNumber } from '../../lib/format'
import type { Locale } from '../../i18n'
import { cn } from '../../lib/utils'

/**
 * Sol kategori sütunu — Getir/Trendyol Market deseni.
 *
 * Sayılar API'nin facet'lerinden gelir ve KENDİ boyutu hariç hesaplanır:
 * kullanıcı "Süt Ürünleri"ndeyken diğer kategorilerin sayısını hâlâ görür ve
 * seçimini genişletebilir. Aksi halde panel çıkmaz sokağa dönerdi.
 */
export function CategorySidebar({
  categories,
  selected,
  onSelect,
  locale,
  labels,
}: {
  categories: Facet[]
  selected: string | null
  onSelect: (slug: string | null) => void
  locale: Locale
  labels: { allCategories: string }
}) {
  const n = (v: number) => formatNumber(locale, v)

  return (
    <nav aria-label={labels.allCategories} className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-current={selected === null ? 'true' : undefined}
        className={cn(
          'flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
          selected === null
            ? 'bg-mint-soft font-semibold text-forest-deep'
            : 'text-ink-soft hover:bg-cream-deep hover:text-ink',
        )}
      >
        <span>{labels.allCategories}</span>
      </button>

      {categories.map((cat) => {
        const active = selected === cat.slug
        return (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelect(active ? null : cat.slug)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
              active
                ? 'bg-mint-soft font-semibold text-forest-deep'
                : 'text-ink-soft hover:bg-cream-deep hover:text-ink',
            )}
          >
            <span className="line-clamp-2">{cat.name}</span>
            <span className="shrink-0 tabular-nums text-xs text-ink-hint">{n(cat.n)}</span>
          </button>
        )
      })}
    </nav>
  )
}
