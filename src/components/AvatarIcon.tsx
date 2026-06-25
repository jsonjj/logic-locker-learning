import type { ReactNode } from 'react'
import { getAvatar } from '../data/avatars'

/** White symbol drawn on a 64x64 canvas, one per avatar id. */
const SYMBOLS: Record<string, ReactNode> = {
  // Magnifying glass
  inspector: (
    <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
      <circle cx="28" cy="28" r="11" />
      <line x1="36" y1="36" x2="46" y2="46" strokeWidth="5.5" />
    </g>
  ),
  // Fingerprint
  sleuth: (
    <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
      <path d="M20 36 a13 15 0 0 1 24 0" />
      <path d="M24 38 a9 11 0 0 1 16 0" />
      <path d="M28 40 a5 7 0 0 1 8 0" />
      <path d="M32 30 v14" />
    </g>
  ),
  // Fox face
  fox: (
    <g>
      <path d="M18 20 L26 28 L20 18 Z" fill="#fff" />
      <path d="M46 20 L38 28 L44 18 Z" fill="#fff" />
      <path d="M22 24 L42 24 L32 46 Z" fill="#fff" />
      <circle cx="27" cy="31" r="2.4" fill={'currentColor'} />
      <circle cx="37" cy="31" r="2.4" fill={'currentColor'} />
    </g>
  ),
  // Owl
  owl: (
    <g>
      <path d="M20 18 L26 28 L18 26 Z" fill="#fff" />
      <path d="M44 18 L38 28 L46 26 Z" fill="#fff" />
      <ellipse cx="32" cy="34" rx="15" ry="16" fill="#fff" />
      <circle cx="26" cy="31" r="5" fill="currentColor" />
      <circle cx="38" cy="31" r="5" fill="currentColor" />
      <path d="M32 36 l3 5 -6 0 Z" fill="currentColor" />
    </g>
  ),
  // Bar chart
  analyst: (
    <g fill="#fff">
      <rect x="20" y="34" width="6" height="12" rx="1.5" />
      <rect x="29" y="26" width="6" height="20" rx="1.5" />
      <rect x="38" y="20" width="6" height="26" rx="1.5" />
    </g>
  ),
  // Silhouette bust
  shadow: (
    <g fill="#fff">
      <circle cx="32" cy="25" r="8" />
      <path d="M17 48 a15 15 0 0 1 30 0 Z" />
    </g>
  ),
}

export default function AvatarIcon({
  id,
  size = 44,
  className,
}: {
  id: string | undefined
  size?: number
  className?: string
}) {
  const avatar = getAvatar(id)
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={avatar.label}
      style={{ color: avatar.color }}
    >
      <circle cx="32" cy="32" r="32" fill={avatar.color} />
      {SYMBOLS[avatar.id] ?? SYMBOLS.inspector}
    </svg>
  )
}
