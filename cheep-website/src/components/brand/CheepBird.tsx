/**
 * 🐦 Cheep bird — the brand character, ported 1:1 from the mobile app's
 * CheepMascot (single source of truth: same geometry, same palette) and
 * lightly enriched for the web (glossy body, idle blink, expressions).
 */
import { useId } from 'react'

export type BirdExpression = 'happy' | 'wink' | 'celebrate' | 'search'

const C = {
  bodyMint: '#57C99A',
  mintDark: '#36A77B',
  mintDeep: '#2E9E78',
  belly: '#E8F7EF',
  beak: '#F4772E',
  beakEdge: '#E0631F',
  ink: '#16261F',
  blush: '#FB9C86',
}

export function CheepBird({
  size = 120,
  expression = 'happy',
  blink = true,
  shadow = true,
  className,
  style,
  label = 'Cheep',
}: {
  size?: number
  expression?: BirdExpression
  blink?: boolean
  shadow?: boolean
  className?: string
  style?: React.CSSProperties
  /** Erişilebilir ad. Dekoratif kullanımlarda marka adı yeterli. */
  label?: string
}) {
  const gid = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient id={`body-${gid}`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#7EDBB4" />
          <stop offset="55%" stopColor={C.bodyMint} />
          <stop offset="100%" stopColor={C.mintDeep} />
        </radialGradient>
        <radialGradient id={`belly-${gid}`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor={C.belly} />
        </radialGradient>
        <linearGradient id={`beak-${gid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8A3D" />
          <stop offset="100%" stopColor={C.beak} />
        </linearGradient>
      </defs>

      {shadow && <ellipse cx={60} cy={115} rx={30} ry={4.5} fill={C.ink} opacity={0.08} />}

      {/* tail */}
      <path d="M30 70 L9 60 L27 80 Z" fill={C.mintDeep} />
      <path d="M29 78 L11 78 L30 90 Z" fill={C.mintDark} />

      {/* crest */}
      <path d="M52 24 q3 -9 8 -3 q2 -9 8 -3 q3 6 -2 9 q-7 -3 -14 -3 Z" fill={C.mintDark} />

      {/* body */}
      <ellipse
        cx={60}
        cy={66}
        rx={37}
        ry={39}
        fill={`url(#body-${gid})`}
        stroke={C.mintDeep}
        strokeWidth={3}
      />
      {/* belly */}
      <ellipse cx={64} cy={76} rx={21} ry={24} fill={`url(#belly-${gid})`} />
      {/* wing */}
      <path d="M40 50 C30 54 30 74 42 80 C48 74 48 56 40 50 Z" fill={C.mintDark}>
        {expression === 'celebrate' && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="0 41 65; -18 41 65; 0 41 65"
            dur="0.7s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* eye */}
      {expression === 'wink' ? (
        <path
          d="M71 55 Q78 61 85 55"
          stroke={C.ink}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <g
          style={
            blink
              ? { animation: 'blink 4.2s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }
              : undefined
          }
        >
          <circle cx={78} cy={55} r={6.5} fill={C.ink} />
          <circle cx={80.5} cy={52.5} r={2.1} fill="#fff" />
        </g>
      )}

      {/* blush */}
      <ellipse cx={86} cy={66} rx={5.5} ry={3.6} fill={C.blush} opacity={0.65} />

      {/* beak */}
      <path
        d="M93 57 Q104 60 110 63 Q104 66 93 67 Q90 62 93 57 Z"
        fill={`url(#beak-${gid})`}
        stroke={C.beakEdge}
        strokeWidth={1}
      />

      {/* feet */}
      <g stroke={C.beak} strokeWidth={3.5} strokeLinecap="round" fill="none">
        <path d="M53 104 L53 112" />
        <path d="M48 115 L53 112 L58 115" />
        <path d="M69 104 L69 112" />
        <path d="M64 115 L69 112 L74 115" />
      </g>

      {/* expression extras */}
      {expression === 'celebrate' && (
        <g stroke={C.beak} strokeWidth={2.5} strokeLinecap="round">
          <line x1={104} y1={24} x2={104} y2={32} />
          <line x1={100} y1={28} x2={108} y2={28} />
          <line x1={20} y1={34} x2={20} y2={40} />
          <line x1={17} y1={37} x2={23} y2={37} />
        </g>
      )}
      {expression === 'search' && (
        <g stroke={C.beak} strokeWidth={3} fill="none" strokeLinecap="round">
          <circle cx={26} cy={40} r={7} />
          <line x1={31} y1={45} x2={37} y2={51} />
        </g>
      )}
    </svg>
  )
}
