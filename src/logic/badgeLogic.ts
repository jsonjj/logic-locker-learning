import type { BadgeType } from '../types'

export const ROUND_FAILED_THRESHOLD = 7

export const BADGE_META: Record<
  BadgeType,
  { label: string; icon: string; color: string; dark: string }
> = {
  gold: { label: 'Master Detective', icon: 'G', color: '#e0a900', dark: '#9a7100' },
  silver: { label: 'Case Solver', icon: 'S', color: '#9a9aa2', dark: '#5e5e64' },
  bronze: { label: 'Case Closed', icon: 'B', color: '#c07b34', dark: '#8a531f' },
  retry: { label: 'Back on the Case', icon: 'R', color: '#3b82f6', dark: '#1f4fc4' },
}

/** Higher is better. Used to keep a learner's best badge across replays. */
export const BADGE_RANK: Record<BadgeType, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
  retry: 0,
}

/** Returns the stronger of two badges (the previous one may not exist yet). */
export function betterBadge(previous: BadgeType | null, next: BadgeType): BadgeType {
  if (!previous) return next
  return BADGE_RANK[next] > BADGE_RANK[previous] ? next : previous
}

/**
 * Badge from mistake count alone:
 *  - Gold: 0-1 mistakes
 *  - Silver: 2-4 mistakes
 *  - Bronze: 5+ mistakes
 */
export function calculateBadge(mistakes: number): BadgeType {
  if (mistakes <= 1) return 'gold'
  if (mistakes <= 4) return 'silver'
  return 'bronze'
}

/**
 * The badge actually earned on completion. If the learner triggered a round
 * failure during the lesson and still finished, they earn the Retry badge.
 */
export function determineEarnedBadge(mistakes: number, failedRoundTriggered: boolean): BadgeType {
  if (failedRoundTriggered) return 'retry'
  return calculateBadge(mistakes)
}

export function shouldTriggerRoundFailed(mistakes: number): boolean {
  return mistakes >= ROUND_FAILED_THRESHOLD
}
