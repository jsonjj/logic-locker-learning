import type { LevelResult, RunStats, StarRank } from '../game/lockdown/contracts'

/**
 * Scoring rules for "Logic Locker: Lockdown".
 *
 * LEARNING-SAFE & PRODUCTIVE-FAILURE FRIENDLY:
 *  - Time NEVER penalizes. It flows through as a displayed stat only; stars and
 *    score ignore it entirely (no countdown, no overage penalty).
 *  - Mistakes are CHEAP, so experimenting is encouraged.
 *  - A "comeback" (a question you got wrong, then corrected) earns a bonus, and
 *    stars are based on UNRECOVERED mistakes only — fixing yourself never costs
 *    you a star. Clearing a sector ALWAYS earns at least one star.
 */

const BASE_SCORE = 1000
/** Errors are cheap now (was 120) so productive failure is encouraged. */
const MISTAKE_PENALTY = 40
/** Reward for each question erred-then-corrected (a self-correction "comeback"). */
const COMEBACK_BONUS = 40
const CAUGHT_PENALTY = 150
const MIN_SCORE = 50

/** Human-readable description of the star rules, for UI and tests. */
export const STAR_RULES = {
  three: 'Flawless reasoning: no uncorrected mistakes and not caught. Take your time.',
  two: 'Sharp: at most 1 uncorrected mistake and not caught.',
  one: 'Cleared: you escaped the sector — every clear earns a star.',
  summary:
    '3 stars = no uncorrected mistakes & uncaught · 2 stars = nearly clean & not caught · 1 star = cleared. Time never counts against you.',
} as const

/**
 * Compute the star rank for a run. Time is ignored entirely; stars depend only
 * on UNRECOVERED mistakes (`stats.mistakes`, already refunded for comebacks) and
 * whether the player was caught. Clearing always yields >= 1 star.
 */
function computeStars(stats: RunStats): StarRank {
  if (stats.mistakes === 0 && !stats.caught) {
    return 3
  }
  if (stats.mistakes <= 1 && !stats.caught) {
    return 2
  }
  return 1
}

/** Turn live run stats into a persisted result (stars + composite score). */
export function computeResult(stats: RunStats): LevelResult {
  const stars = computeStars(stats)
  const comebacks = Math.max(0, stats.comebacks ?? 0)

  // No time penalty: the clock is a stat, never a cost.
  const raw =
    BASE_SCORE -
    stats.mistakes * MISTAKE_PENALTY +
    comebacks * COMEBACK_BONUS -
    (stats.caught ? CAUGHT_PENALTY : 0)

  const score = Math.max(MIN_SCORE, raw)

  return {
    sectorId: stats.sectorId,
    stars,
    timeMs: stats.timeMs,
    mistakes: stats.mistakes,
    caught: stats.caught,
    score,
    completedAt: Date.now(),
  }
}

/** Format milliseconds as "M:SS" (e.g. 83000 -> "1:23"). */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
