import type { BadgeType } from '../types'
import { BADGE_META } from '../logic/badgeLogic'
import BadgeMedal from './BadgeMedal'

export default function Badge({
  type,
  large = false,
  showLabel = true,
}: {
  type: BadgeType
  large?: boolean
  showLabel?: boolean
}) {
  const meta = BADGE_META[type]
  return (
    <span className={`badge ${type} ${large ? 'badge-lg' : ''}`} title={meta.label}>
      <BadgeMedal type={type} size={large ? 40 : 24} />
      {showLabel && <span>{meta.label}</span>}
    </span>
  )
}
