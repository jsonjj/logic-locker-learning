/**
 * [Agent 3] Pure helpers (no React) that assemble a fixed-length, mode-agnostic
 * quiz from a Lesson and map each lesson Step type onto a security-device
 * archetype.
 *
 * The quiz is built around retrieval-practice principles rather than a
 * difficulty dial:
 *   - the run is always ~QUIZ_LEN questions regardless of learning mode,
 *   - the room's core skill is rehearsed SAME -> VARIED (surface tier first,
 *     deep/scenario-changed variation later),
 *   - a slice of questions INTERLEAVES earlier skills for spaced review.
 */
import type { Lesson, SkillId, Step, StepPhase } from '../../types'
import { trackCount, varyStepDeep, varyStepSurface, type VariationTier } from '../../logic/variants'
import { SKILL_CHAIN, sectorSkillId } from '../skills'
import type { LearningMode } from '../skills'
import type { DeviceKind, InteractiveStep } from './types'

const INTERACTIVE_TYPES = new Set<Step['type']>([
  'multipleChoice',
  'prediction',
  'highlightChoice',
  'symbolTap',
  'clueSort',
  'deductionGrid',
  'miniGrid',
  'singleCellGrid',
  'logicSwitches',
  'ordering',
])

/** Narrowing guard: is this a step a device can be built from? */
export function isInteractive(step: Step): step is InteractiveStep {
  return INTERACTIVE_TYPES.has(step.type)
}

/** Map a lesson step type onto the device that renders it. */
export function deviceKindForStep(step: InteractiveStep): DeviceKind {
  switch (step.type) {
    case 'multipleChoice':
    case 'prediction':
    case 'highlightChoice':
    case 'symbolTap':
      return 'console'
    case 'clueSort':
      return 'locker'
    case 'deductionGrid':
    case 'miniGrid':
    case 'singleCellGrid':
      return 'grid'
    case 'logicSwitches':
      return 'gate'
    case 'ordering':
      return 'wiring'
  }
}

/** Short in-fiction name for a device archetype. */
export function deviceLabel(kind: DeviceKind): string {
  switch (kind) {
    case 'console':
      return 'Override Console'
    case 'locker':
      return 'Evidence Locker'
    case 'grid':
      return 'Deduction Terminal'
    case 'gate':
      return 'Logic-Gate Panel'
    case 'wiring':
      return 'Relay Sequencer'
  }
}

const PHASE_WEIGHT: Record<StepPhase, number> = {
  intro: 0,
  'micro-practice': 1,
  'guided-practice': 2,
  'pattern-check': 3,
  challenge: 4,
  reflection: 1,
  completion: 0,
}

/** Relative difficulty of a single question (higher = harder). */
export function stepWeight(step: InteractiveStep): number {
  return PHASE_WEIGHT[step.phase] ?? 2
}

/** Fixed number of questions per run — identical across every learning mode. */
export const QUIZ_LEN = 10

/** How many of the opening questions stay SURFACE tier (same / near-identical). */
const SURFACE_COUNT = 2

/** Share of the run dedicated to interleaved earlier-skill review (~30%). */
const INTERLEAVE_RATIO = 0.3

/** Options for assembling a run. Mode is accepted for API symmetry but does not
 *  change WHICH questions are asked — only PuzzleScene's presentation differs. */
export interface BuildQuizOpts {
  /** Replay prestige — fades scaffolding and re-rolls authored tracks. */
  prestige?: number
  /** The core skill the room teaches (defaults to the lesson's sector skill). */
  skill?: SkillId
  /** Learning-style mode — does not affect selection, only presentation. */
  mode?: LearningMode
  /** All lessons, so earlier-skill questions can be pulled in for interleaving. */
  allLessons?: Lesson[]
}

/** Skills taught strictly before `skill` in the chain (for interleaving). */
function earlierSkillsOf(skill: SkillId): SkillId[] {
  const idx = skill === 'cumulative' ? SKILL_CHAIN.length : SKILL_CHAIN.indexOf(skill)
  return SKILL_CHAIN.slice(0, Math.max(0, idx))
}

/** Interactive review questions drawn from earlier-skill lessons. */
function reviewPool(currentSkill: SkillId, currentLessonId: string, allLessons: Lesson[]): InteractiveStep[] {
  const earlier = earlierSkillsOf(currentSkill)
  if (earlier.length === 0) return []
  const out: InteractiveStep[] = []
  for (const skill of earlier) {
    const src = allLessons.find((l) => l.id !== currentLessonId && sectorSkillId(l.id) === skill)
    if (!src) continue
    out.push(...src.steps.filter(isInteractive))
  }
  return out
}

/**
 * Assemble a fixed-length retrieval-practice quiz for a lock.
 *
 * Sequencing (for QUIZ_LEN questions):
 *   1. The first `SURFACE_COUNT` questions are the room's core skill at SURFACE
 *      tier — the same / near-identical wording it was taught with, easiest
 *      first, so the move is rehearsed cleanly before it's disguised.
 *   2. Remaining core-skill questions ramp into DEEP tier — authored variants
 *      that change the scenario while exercising the same reasoning move.
 *   3. ~`INTERLEAVE_RATIO` of the run is spaced review drawn from EARLIER skills
 *      (never in the first two slots), so the player keeps transferring old
 *      moves. Earlier-skill questions are always presented at DEEP tier.
 *
 * Prestige offsets the variant tracks so replays surface fresh disguises rather
 * than the same set. The returned steps are already resolved + answer-shuffled.
 */
export function buildQuiz(lesson: Lesson, opts: BuildQuizOpts = {}): InteractiveStep[] {
  const { prestige = 0, allLessons = [] } = opts
  const base = lesson.steps.filter(isInteractive)
  if (base.length === 0) return []

  const currentSkill = opts.skill ?? sectorSkillId(lesson.id)
  const count = QUIZ_LEN

  const easyFirst = [...base].sort((a, b) => stepWeight(a) - stepWeight(b))
  const hardFirst = [...base].sort((a, b) => stepWeight(b) - stepWeight(a))
  const review = reviewPool(currentSkill, lesson.id, allLessons)

  // How many slots become interleaved review — never the first two, and only if
  // there are earlier-skill questions to draw from.
  const interleaveTarget = review.length > 0 ? Math.round(count * INTERLEAVE_RATIO) : 0
  const reviewPositions = new Set<number>()
  if (interleaveTarget > 0) {
    // Spread review evenly across the slots AFTER the opening surface block.
    const start = SURFACE_COUNT
    const usable = count - start
    for (let k = 0; k < interleaveTarget; k++) {
      const pos = start + Math.floor(((k + 1) * usable) / (interleaveTarget + 1))
      reviewPositions.add(Math.min(count - 1, Math.max(start, pos)))
    }
  }

  // Per-id occurrence counters give repeats a rotating track so duplicates never
  // read identically; prestige offsets the starting track.
  const occ = new Map<string, number>()
  const trackFor = (id: string) => {
    const n = occ.get(id) ?? 0
    occ.set(id, n + 1)
    return n + prestige
  }

  const tracks = trackCount(lesson)
  let currentIdx = 0
  let reviewIdx = 0
  const out: InteractiveStep[] = []

  for (let i = 0; i < count; i++) {
    if (reviewPositions.has(i) && review.length > 0) {
      const step = review[reviewIdx % review.length]
      reviewIdx++
      out.push(varyStepDeep(step, trackFor(step.id)) as InteractiveStep)
      continue
    }
    const surface = i < SURFACE_COUNT
    const tier: VariationTier = surface ? 'surface' : 'deep'
    const pool = surface ? easyFirst : hardFirst
    const step = pool[currentIdx % pool.length]
    currentIdx++
    const track = tracks > 1 ? trackFor(step.id) : 0
    out.push(
      (tier === 'deep' ? varyStepDeep(step, track) : varyStepSurface(step, track)) as InteractiveStep,
    )
  }

  return out
}
