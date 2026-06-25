/**
 * Spaced "audit" review schedule — the heart of the Mastery Loop.
 *
 * Deliberately NOT Firebase: this is a tiny, dependency-free, offline,
 * localStorage-backed store so reviews work instantly and survive reloads even
 * when signed out. It tracks, per reasoning skill, when it was last reviewed and
 * how far apart the next review should be (an EXPANDING interval — the better you
 * retain a skill, the less often you need to revisit it).
 *
 * CLOCK: we measure time in "rooms cleared", not wall-clock. A room-cleared
 * counter is the natural cadence for this game (one block ≈ one study session),
 * it can't be gamed by leaving the tab open, and it lines up with how the player
 * actually progresses. Callers pass the current cleared count (derived from
 * sector progress); it is also persisted so the count is optional on later calls.
 *
 * Expanding intervals (in rooms cleared): [1, 3, 7, 14, 30]. A freshly reviewed
 * skill won't be due again for 1 room, then 3, then 7, and so on, capped at 30.
 */
import type { SkillId } from '../types'
import { SKILL_CHAIN } from '../game3d/skills'

const STORAGE_KEY = 'll-review-schedule-v1'

/** Expanding spacing, measured in rooms cleared between reviews. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const

/** Need at least this many cleared rooms before audits make sense (earlier skills exist). */
const MIN_CLEARED_FOR_AUDIT = 2

interface SkillRecord {
  /** Wall-clock of the last review (informational only; the clock is `lastReviewedRoom`). */
  lastReviewedAt: number
  /** The rooms-cleared count at the moment this skill was last reviewed. */
  lastReviewedRoom: number
  /** Index into REVIEW_INTERVALS — advances (expands) every time the skill is reviewed. */
  intervalIndex: number
}

interface ScheduleState {
  /** Last cleared count we were told about (so callers can omit it later). */
  clearedCount: number
  skills: Partial<Record<SkillId, SkillRecord>>
}

function emptyState(): ScheduleState {
  return { clearedCount: 0, skills: {} }
}

/** In-memory fallback when there is no window (SSR / tests). */
let memoryState: ScheduleState = emptyState()

function hasWindow(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function load(): ScheduleState {
  if (!hasWindow()) return memoryState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<ScheduleState>
    return {
      clearedCount: typeof parsed.clearedCount === 'number' ? parsed.clearedCount : 0,
      skills: parsed.skills ?? {},
    }
  } catch {
    return emptyState()
  }
}

function save(state: ScheduleState): void {
  if (!hasWindow()) {
    memoryState = state
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full / blocked — degrade silently */
  }
}

/** Resolve an effective cleared count: explicit arg wins, else the stored value. */
function resolveCleared(state: ScheduleState, clearedCount?: number): number {
  return typeof clearedCount === 'number' ? clearedCount : state.clearedCount
}

function intervalFor(intervalIndex: number): number {
  const i = Math.min(Math.max(0, intervalIndex), REVIEW_INTERVALS.length - 1)
  return REVIEW_INTERVALS[i]
}

/** Position of a skill in the teaching chain (cumulative sits at the end). */
function chainIndex(skill: SkillId): number {
  const i = SKILL_CHAIN.indexOf(skill)
  return i < 0 ? SKILL_CHAIN.length : i
}

/**
 * Is this skill due for a review right now (at `cc` rooms cleared)?
 * - Never reviewed: due once the player has moved at least two rooms past it,
 *   so there's something later to interleave it against.
 * - Reviewed before: due when enough rooms have been cleared to exceed its
 *   current (expanding) interval.
 */
function skillDue(rec: SkillRecord | undefined, skill: SkillId, cc: number): boolean {
  if (!rec) return cc >= chainIndex(skill) + MIN_CLEARED_FOR_AUDIT
  return cc - rec.lastReviewedRoom >= intervalFor(rec.intervalIndex)
}

/** Persist the latest cleared count if the caller supplied one. */
function noteCleared(clearedCount?: number): void {
  if (typeof clearedCount !== 'number') return
  const state = load()
  if (state.clearedCount === clearedCount) return
  state.clearedCount = clearedCount
  save(state)
}

/**
 * Record that the player just reviewed `skillId`. Resets its spacing clock and
 * EXPANDS its interval so the next review is further out.
 */
export function markSkillReviewed(skillId: SkillId, clearedCount?: number): void {
  const state = load()
  const cc = resolveCleared(state, clearedCount)
  const prev = state.skills[skillId]
  state.skills[skillId] = {
    lastReviewedAt: Date.now(),
    lastReviewedRoom: cc,
    intervalIndex: Math.min((prev?.intervalIndex ?? -1) + 1, REVIEW_INTERVALS.length - 1),
  }
  state.clearedCount = cc
  save(state)
}

/** Convenience: mark several skills reviewed in one pass (e.g. a full audit deck). */
export function markSkillsReviewed(skillIds: SkillId[], clearedCount?: number): void {
  for (const id of skillIds) markSkillReviewed(id, clearedCount)
}

/**
 * Every skill currently due for an audit, ordered by the teaching chain. Pass
 * the current rooms-cleared count (falls back to the stored value).
 */
export function dueSkills(clearedCount?: number): SkillId[] {
  noteCleared(clearedCount)
  const state = load()
  const cc = resolveCleared(state, clearedCount)
  return SKILL_CHAIN.filter((skill) => skillDue(state.skills[skill], skill, cc))
}

/**
 * A simple staleness weight for a skill (used to bias the audit deck toward the
 * skills that most need revisiting). 0 = not due; higher = more overdue.
 */
export function auditWeight(skillId: SkillId, clearedCount?: number): number {
  const state = load()
  const cc = resolveCleared(state, clearedCount)
  const rec = state.skills[skillId]
  if (!skillDue(rec, skillId, cc)) return 0
  if (!rec) return 2
  const overdue = cc - rec.lastReviewedRoom - intervalFor(rec.intervalIndex)
  return 1 + Math.max(0, overdue)
}

/** Should the world surface a "Skills Audit" affordance right now? */
export function isAuditDue(clearedCount?: number): boolean {
  noteCleared(clearedCount)
  const state = load()
  const cc = resolveCleared(state, clearedCount)
  if (cc < MIN_CLEARED_FOR_AUDIT) return false
  return dueSkills(cc).length > 0
}
