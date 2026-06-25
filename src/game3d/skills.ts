/**
 * Logic Locker — shared skill + learning-mode layer.
 *
 * This is the FOUNDATION every pedagogical feature builds on:
 *  - skill tagging (each sector/lesson maps to one core reasoning skill)
 *  - feedback that names the exact failed reasoning move
 *  - same -> varied retrieval + interleaving of earlier skills
 *  - spaced "audit" review of earlier skills (expanding intervals)
 *  - the Warden retention gate (must retain earlier skills)
 *  - prerequisite re-routing (on repeated failure, go back one skill)
 *  - three equal-length learning-style MODES (visual / narrative / hands-on)
 *
 * Treat the maps below as the single source of truth for skill identity and
 * ordering so the parallel feature modules stay consistent.
 */
import type { SkillId } from '../types'
import type { SectorId } from '../game/lockdown/contracts'

export type { SkillId }

// ---------------------------------------------------------------------------
// Learning-style modes (replaces the old 4-hard / 10-easy difficulty split).
// Every mode covers the SAME skills with the SAME number of questions; only
// the presentation differs, so players pick how they want to learn — not how
// little. Difficulty scales through prestige (fading help), never via fewer Qs.
// ---------------------------------------------------------------------------

export type LearningMode = 'visual' | 'narrative' | 'handson'

export interface LearningModeDef {
  id: LearningMode
  label: string
  tagline: string
  /** One-line description of the presentation style. */
  description: string
  /** Emoji/glyph for the picker card. */
  glyph: string
}

export const LEARNING_MODES: LearningModeDef[] = [
  {
    id: 'visual',
    label: 'Visual',
    tagline: 'See the logic',
    description: 'Grids, diagrams, and color-coded clues you can scan at a glance.',
    glyph: '▦',
  },
  {
    id: 'narrative',
    label: 'Narrative',
    tagline: 'Reason through the story',
    description: 'Work the case through dialogue and written clues from Akash.',
    glyph: '✎',
  },
  {
    id: 'handson',
    label: 'Hands-on',
    tagline: 'Build the answer',
    description: 'Drag, toggle, and assemble the logic with your own hands.',
    glyph: '✦',
  },
]

export const DEFAULT_MODE: LearningMode = 'visual'

export function isLearningMode(v: unknown): v is LearningMode {
  return v === 'visual' || v === 'narrative' || v === 'handson'
}

export function learningModeDef(id: LearningMode): LearningModeDef {
  return LEARNING_MODES.find((m) => m.id === id) ?? LEARNING_MODES[0]
}

// ---------------------------------------------------------------------------
// Skill metadata
// ---------------------------------------------------------------------------

export interface SkillDef {
  id: SkillId
  label: string
  /** Short tag shown in HUD/review chips. */
  short: string
  /** Names the exact reasoning move that fails — used for immediate feedback. */
  failedMove: string
  /** One-line description of the skill. */
  blurb: string
}

export const SKILLS: Record<SkillId, SkillDef> = {
  'fact-vs-guess': {
    id: 'fact-vs-guess',
    label: 'Fact vs. Guess',
    short: 'Facts',
    failedMove: 'You treated a possibility as a fact.',
    blurb: 'Tell what a clue actually proves apart from what you assume.',
  },
  'grid-elimination': {
    id: 'grid-elimination',
    label: 'Grid Elimination',
    short: 'Grid',
    failedMove: "You marked a cell the clues don't actually force.",
    blurb: 'Use X, check, and blank to drive a chain of eliminations.',
  },
  'if-then': {
    id: 'if-then',
    label: 'If–Then Reasoning',
    short: 'If–Then',
    failedMove: 'You kept a possibility that contradicts a known clue.',
    blurb: 'Test a guess against the clues and reject it when it breaks one.',
  },
  'logic-gates': {
    id: 'logic-gates',
    label: 'Logic Gates',
    short: 'Gates',
    failedMove: "You set the gates so the rule's logic does not hold.",
    blurb: 'Bend AND, OR, and NOT to make a rule come out true.',
  },
  'ordered-explanation': {
    id: 'ordered-explanation',
    label: 'Ordered Reasoning',
    short: 'Order',
    failedMove: 'You placed a step before the one it depends on.',
    blurb: 'Stack every reasoning step into a valid, dependency-respecting order.',
  },
  cumulative: {
    id: 'cumulative',
    label: 'Combined Skills',
    short: 'All',
    failedMove: 'You reached for the wrong reasoning move for this case.',
    blurb: 'Combine every earlier skill to break the final locks.',
  },
}

/** The teaching order / prerequisite chain (cumulative sits after the chain). */
export const SKILL_CHAIN: SkillId[] = [
  'fact-vs-guess',
  'grid-elimination',
  'if-then',
  'logic-gates',
  'ordered-explanation',
]

/** Map each sector/lesson id to the core skill it teaches. */
const SECTOR_SKILL: Record<string, SkillId> = {
  'lesson-1': 'fact-vs-guess',
  'lesson-2': 'grid-elimination',
  'lesson-3': 'grid-elimination',
  'lesson-4': 'if-then',
  'lesson-5': 'logic-gates',
  'lesson-6': 'ordered-explanation',
  'lesson-7': 'cumulative',
}

/** The skill a sector/lesson teaches (defaults to fact-vs-guess). */
export function sectorSkillId(sectorId: string): SkillId {
  return SECTOR_SKILL[sectorId] ?? 'fact-vs-guess'
}

/** The skill that must come before `skill`, or null for the first skill. */
export function prereqSkill(skill: SkillId): SkillId | null {
  if (skill === 'cumulative') return 'ordered-explanation'
  const i = SKILL_CHAIN.indexOf(skill)
  if (i <= 0) return null
  return SKILL_CHAIN[i - 1]
}

/** The first sector that teaches a given skill, if any. */
export function sectorForSkill(skill: SkillId): SectorId | null {
  const id = Object.keys(SECTOR_SKILL).find((k) => SECTOR_SKILL[k] === skill)
  return (id as SectorId) ?? null
}

/** The sector to send a struggling player back to (prerequisite skill room). */
export function prereqSectorId(sectorId: string): SectorId | null {
  const skill = sectorSkillId(sectorId)
  const pre = prereqSkill(skill)
  if (!pre) return null
  return sectorForSkill(pre)
}

/** The canonical "you failed THIS move" message for a skill. */
export function failedMoveFor(skill: SkillId | undefined): string {
  if (!skill) return 'Re-check which clue actually forces your answer.'
  return SKILLS[skill].failedMove
}

/** Skills taught strictly before this sector (earlier rooms) — for interleaving/audits. */
export function earlierSkills(sectorId: string): SkillId[] {
  const skill = sectorSkillId(sectorId)
  const idx = skill === 'cumulative' ? SKILL_CHAIN.length : SKILL_CHAIN.indexOf(skill)
  return SKILL_CHAIN.slice(0, Math.max(0, idx))
}
