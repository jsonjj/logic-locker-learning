import type { Lesson, BadgeType } from '../types'
import Badge from './Badge'

export type DoorState = 'locked' | 'unlocked' | 'in-progress' | 'completed'

const STATE_LABEL: Record<DoorState, string> = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

export default function DoorCard({
  lesson,
  state,
  badge,
  onClick,
}: {
  lesson: Lesson
  state: DoorState
  badge?: BadgeType | null
  onClick: () => void
}) {
  const locked = state === 'locked'
  const roomNumber = lesson.id.replace(/[^0-9]/g, '') || lesson.doorLabel
  return (
    <button
      type="button"
      className={`door-card ${state}`}
      onClick={locked ? undefined : onClick}
      disabled={locked}
      aria-label={`${lesson.doorLabel}: ${lesson.title} (${STATE_LABEL[state]})`}
    >
      {badge && (
        <span className="door-badge">
          <Badge type={badge} showLabel={false} />
        </span>
      )}
      <div className="door-frame">{roomNumber}</div>
      <div className="door-label">{lesson.doorLabel}</div>
      <div className="door-title">{lesson.title}</div>
      <div className={`door-state ${state}`}>{STATE_LABEL[state]}</div>
    </button>
  )
}
