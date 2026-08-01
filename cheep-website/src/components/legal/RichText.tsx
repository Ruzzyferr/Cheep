import { Fragment, type ReactNode } from 'react'
import { SiteLink as Link } from '../ui/SiteLink'
import type { Block } from '../../i18n/types'
import { useHref } from '../../i18n'

/**
 * Yasal metinler sözlükte düz string olarak durur (çevirmesi kolay olsun diye).
 * Desteklenen satır içi biçimler yalnızca iki tane: `**kalın**` ve `[etiket](href)`.
 * Bilinçli olarak markdown kütüphanesi yok — bu iki kural yeterli.
 */
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g

function Inline({ text }: { text: string }): ReactNode {
  const href = useHref()
  const parts = text.split(INLINE).filter((p) => p !== '')

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }

        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (link) {
          const [, label, target] = link
          // Site içi yollar aktif dile göre önek alır (/terms → /pl/terms).
          if (target.startsWith('/')) {
            return (
              <Link key={i} to={href(target)}>
                {label}
              </Link>
            )
          }
          return (
            <a key={i} href={target}>
              {label}
            </a>
          )
        }

        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

export function RichText({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if ('h2' in block) return <h2 key={i}>{block.h2}</h2>
        if ('h3' in block) return <h3 key={i}>{block.h3}</h3>
        if ('p' in block)
          return (
            <p key={i}>
              <Inline text={block.p} />
            </p>
          )
        return (
          <ul key={i}>
            {block.ul.map((item, j) => (
              <li key={j}>
                <Inline text={item} />
              </li>
            ))}
          </ul>
        )
      })}
    </>
  )
}
