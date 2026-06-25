import type { BadgeType } from '../types'
import Badge from './Badge'
import { BADGE_META } from '../logic/badgeLogic'

export default function CompletionScreen({
  lessonTitle,
  badge,
  mistakes,
  isFinal,
  nextLabel,
  onNext,
  onHallway,
  onReplay,
}: {
  lessonTitle: string
  badge: BadgeType
  mistakes: number
  isFinal: boolean
  nextLabel: string | null
  onNext: () => void
  onHallway: () => void
  onReplay: () => void
}) {
  const content = (
    <div className={isFinal ? 'completion-content' : 'card pop-in'} style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ marginBottom: 4 }}>{isFinal ? 'You Escaped the Logic Locker!' : 'Room Complete!'}</h2>
      <p className="muted" style={{ marginTop: 0 }}>{lessonTitle}</p>

      <div className="badge-celebrate" style={{ margin: '18px 0' }}>
        <span className="spark spark-1" aria-hidden />
        <span className="spark spark-2" aria-hidden />
        <span className="spark spark-3" aria-hidden />
        <span className="spark spark-4" aria-hidden />
        <div className="badge-pop">
          <Badge type={badge} large />
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-num">{mistakes}</div>
          <div className="stat-label">Mistakes</div>
        </div>
        <div className="stat">
          <div className="stat-num">{BADGE_META[badge].label.split(' ')[0]}</div>
          <div className="stat-label">Badge Earned</div>
        </div>
        <div className="stat">
          <div className="stat-num">{isFinal ? '7/7' : 'Done'}</div>
          <div className="stat-label">{isFinal ? 'Rooms' : 'Cleared'}</div>
        </div>
      </div>

      <div className="stack">
        {nextLabel && (
          <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
            {nextLabel}
          </button>
        )}
        <button type="button" className="btn btn-block" onClick={onHallway}>
          Back to Hallway
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onReplay}>
          Replay this room
        </button>
      </div>
    </div>
  )

  if (isFinal) {
    return (
      <div className="completion-overlay">
        <div className="escape-doors" aria-hidden>
          <div className="escape-door left" />
          <div className="escape-door right" />
        </div>
        {content}
      </div>
    )
  }
  return content
}
