import { useEffect, useState } from 'react'
import type { LevelResult } from '../game/lockdown/contracts'
import StarRow from '../scoring/StarRow'
import { formatTime } from '../scoring/score'
import { effectsAllowed, useQuality } from '../game3d/engine/quality'
import '../styles/scoring.css'

/** Count a number up from 0 to `target` over ~900ms (or snap if disabled). */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, enabled])
  return value
}

interface ResultsScreenProps {
  result: LevelResult
  /** Whether this run is the player's new personal best. */
  isBest: boolean
  sectorName?: string
  /** Name of the next block, shown as a hint to walk back to its door. */
  nextSectorName?: string
  onRetry: () => void
  onMap: () => void
  onLeaderboard: () => void
  /** Reopen the per-question debrief, when one is available. */
  onReview?: () => void
}

const STAR_HEADLINE: Record<number, string> = {
  3: 'Flawless run',
  2: 'Clean escape',
  1: 'Sector cleared',
  0: 'Sector cleared',
}

/** End-of-run summary: stars, stats, best ribbon, and navigation. */
export default function ResultsScreen({
  result,
  isBest,
  sectorName,
  nextSectorName,
  onRetry,
  onMap,
  onLeaderboard,
  onReview,
}: ResultsScreenProps) {
  useQuality()
  const animate = effectsAllowed()
  const displayScore = useCountUp(result.score, animate)
  return (
    <div className="lockdown ll-results">
      <div className="ll-results-card">
        {isBest && (
          <div className="ll-results-ribbon" aria-label="New best run">
            New Best!
          </div>
        )}

        {sectorName && <p className="ll-results-sector">{sectorName}</p>}
        <h2 className="ll-results-headline">{STAR_HEADLINE[result.stars]}</h2>

        <div className="ll-results-stars">
          <StarRow stars={result.stars} size={48} animate />
        </div>

        <div className="ll-results-score">
          <span className="ll-results-score-value">{displayScore.toLocaleString()}</span>
          <span className="ll-results-score-label">SCORE</span>
        </div>

        <dl className="ll-results-stats">
          <div className="ll-results-stat">
            <dt>Time</dt>
            <dd>{formatTime(result.timeMs)}</dd>
          </div>
          <div className="ll-results-stat">
            <dt>Mistakes</dt>
            <dd>{result.mistakes}</dd>
          </div>
          <div className={`ll-results-stat ${result.caught ? 'is-danger' : 'is-safe'}`}>
            <dt>Pursuer</dt>
            <dd>{result.caught ? 'Caught' : 'Evaded'}</dd>
          </div>
        </dl>

        <p className="ll-results-hint">
          {nextSectorName
            ? `Next up: ${nextSectorName} — head back into the prison and walk to its door.`
            : 'Head back into the prison to take on the Warden.'}
        </p>

        <div className="ll-results-actions">
          <button type="button" className="ll-btn ll-btn-primary" onClick={onMap}>
            Back to the prison
          </button>
          <button type="button" className="ll-btn ll-btn-ghost" onClick={onRetry}>
            Retry
          </button>
          {onReview && (
            <button type="button" className="ll-btn ll-btn-ghost" onClick={onReview}>
              Review answers
            </button>
          )}
          <button type="button" className="ll-btn ll-btn-ghost" onClick={onLeaderboard}>
            Leaderboard
          </button>
        </div>
      </div>
    </div>
  )
}
