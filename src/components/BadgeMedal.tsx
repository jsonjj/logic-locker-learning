import type { BadgeType } from '../types'
import { BADGE_META } from '../logic/badgeLogic'

const STAR =
  'M24 14 l3 6.3 6.9 1 -5 4.9 1.2 6.9 -6.1-3.2 -6.1 3.2 1.2-6.9 -5-4.9 6.9-1 z'

/** A flat SVG award medal, colored per badge tier. Retry shows a redo arrow. */
export default function BadgeMedal({
  type,
  size = 40,
}: {
  type: BadgeType
  size?: number
}) {
  const { color, dark } = BADGE_META[type]
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      {/* ribbons */}
      <path d="M18 3 L24 24 L14 22 Z" fill={dark} />
      <path d="M30 3 L24 24 L34 22 Z" fill={dark} />
      {/* medal */}
      <circle cx="24" cy="30" r="14" fill={color} />
      <circle cx="24" cy="30" r="14" fill="none" stroke={dark} strokeWidth="2" />
      <circle cx="24" cy="30" r="10" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4" />
      {type === 'retry' ? (
        <g
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(0 6)"
        >
          <path d="M30 24 a6.5 6.5 0 1 1 -2.1 -4.8" />
          <path d="M30 17 v3.4 h-3.4" />
        </g>
      ) : (
        <path d={STAR} transform="translate(0 6)" fill="#ffffff" />
      )}
    </svg>
  )
}
