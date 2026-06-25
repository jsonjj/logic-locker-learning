// ---------- Lesson content types (local, hand-authored) ----------

export type StepPhase =
  | 'intro'
  | 'micro-practice'
  | 'guided-practice'
  | 'pattern-check'
  | 'challenge'
  | 'reflection'
  | 'completion'

export type StepType =
  | 'dialogue'
  | 'concept'
  | 'multipleChoice'
  | 'clueSort'
  | 'deductionGrid'
  | 'logicSwitches'
  | 'ordering'
  | 'caseSummary'
  | 'symbolTap'
  | 'singleCellGrid'
  | 'miniGrid'
  | 'prediction'
  | 'highlightChoice'

export interface StepFeedback {
  correct: string
  firstWrong: string
  secondWrong: string
  /**
   * Optional override naming the exact reasoning move that failed (e.g.
   * "You treated a possibility as a fact."). When omitted, the UI derives a
   * default from the step/lesson skill via `failedMoveFor` in game3d/skills.
   */
  failedMove?: string
}

/**
 * The five core deductive-reasoning skills Logic Locker teaches, plus the
 * cumulative final test. Used for skill tagging, interleaving, spaced audits,
 * the Warden retention gate, prerequisite re-routing, and naming failed moves.
 */
export type SkillId =
  | 'fact-vs-guess'
  | 'grid-elimination'
  | 'if-then'
  | 'logic-gates'
  | 'ordered-explanation'
  | 'cumulative'

export interface BaseStep {
  id: string
  type: StepType
  phase: StepPhase
  prompt: string
  feedback?: StepFeedback
  guidedReasoning?: string[]
  /**
   * Optional per-question skill tag. When omitted, the question inherits its
   * lesson's skill (see `sectorSkillId` in game3d/skills).
   */
  skill?: SkillId
  /** Optional supporting graphic shown above the interaction. */
  visual?: StepVisual
  /**
   * Optional alternate versions of this question. Each run picks one (the base
   * step is index 0; variants are 1..N) so players get slightly different
   * questions, and retries re-roll a different version.
   */
  variants?: StepVariant[]
}

/**
 * A content-only override applied on top of a step for a given run. Only the
 * fields that differ from the base step need to be provided.
 */
export interface StepVariant {
  prompt?: string
  feedback?: StepFeedback
  guidedReasoning?: string[]
  visual?: StepVisual
  // choice-style
  choices?: Choice[]
  // clue sort
  categories?: string[]
  cards?: ClueCard[]
  // grids
  rows?: string[]
  cols?: string[]
  clues?: string[]
  showConsequences?: boolean
  targetRow?: string
  targetCol?: string
  // logic switches
  switches?: SwitchDef[]
  rule?: SwitchRule
  expectedSolution?: Record<string, boolean>
  // ordering
  items?: OrderingItem[]
  /** The shape depends on the step type (string, boolean, grid map, etc.). */
  correctAnswer?: string | string[] | boolean | Record<string, string> | GridSolution
}

// ---------- Supporting visuals (read-only graphics for context) ----------

export interface VisualGrid {
  kind: 'grid'
  rows: string[]
  cols: string[]
  /** Pre-filled, read-only marks. */
  marks?: GridSolution
  /** Cells to highlight as [row, col]. */
  highlight?: [string, string][]
  caption?: string
}

export interface VisualLegend {
  kind: 'legend'
  caption?: string
}

export interface VisualClues {
  kind: 'clues'
  title?: string
  items: string[]
}

export interface VisualOptions {
  kind: 'options'
  title?: string
  items: { label: string; mark?: 'X' | 'check' | 'unknown' }[]
}

export interface VisualSwitches {
  kind: 'switches'
  title?: string
  op?: string
  items: { label: string; on: boolean }[]
  result?: { label: string; open: boolean }
}

export type StepVisual =
  | VisualGrid
  | VisualLegend
  | VisualClues
  | VisualOptions
  | VisualSwitches

/** A clickable choice (multiple choice, prediction, highlight, symbol tap, meaning checks). */
export interface Choice {
  id: string
  label: string
}

export interface DialogueStep extends BaseStep {
  type: 'dialogue'
  speaker: string
  text: string
  correctAnswer: null
}

export interface CaseSummaryStep extends BaseStep {
  type: 'caseSummary'
  text: string
  akashLine?: string
  correctAnswer: null
}

/** A single concept taught in a room briefing. */
export interface ConceptPoint {
  term: string
  detail: string
  example?: string
}

/** A short, read-only teaching screen shown before the questions in a room. */
export interface ConceptStep extends BaseStep {
  type: 'concept'
  title: string
  intro?: string
  points: ConceptPoint[]
  akashLine?: string
  correctAnswer: null
}

export interface ChoiceStep extends BaseStep {
  type: 'multipleChoice' | 'prediction' | 'highlightChoice' | 'symbolTap'
  choices: Choice[]
  correctAnswer: string
}

export interface ClueCard {
  id: string
  text: string
}

export interface ClueSortStep extends BaseStep {
  type: 'clueSort'
  categories: string[]
  cards: ClueCard[]
  /** cardId -> category name */
  correctAnswer: Record<string, string>
}

export type GridSymbol = 'blank' | 'X' | 'check'

/** Solution maps rowLabel -> colLabel -> 'X' | 'check'. Cells left out are blank. */
export type GridSolution = Record<string, Record<string, Exclude<GridSymbol, 'blank'>>>

export interface DeductionGridStep extends BaseStep {
  type: 'deductionGrid' | 'miniGrid'
  rows: string[]
  cols: string[]
  clues: string[]
  correctAnswer: GridSolution
  /** When true, checking a cell pulses the same-row / same-col impossible cells. */
  showConsequences?: boolean
}

export interface SingleCellGridStep extends BaseStep {
  type: 'singleCellGrid'
  rows: string[]
  cols: string[]
  clues?: string[]
  targetRow: string
  targetCol: string
  correctAnswer: Exclude<GridSymbol, 'blank'>
}

export type SwitchRule =
  | { kind: 'var'; id: string }
  | { kind: 'not'; operand: SwitchRule }
  | { kind: 'and'; operands: SwitchRule[] }
  | { kind: 'or'; operands: SwitchRule[] }

export interface SwitchDef {
  id: string
  label: string
}

export interface LogicSwitchesStep extends BaseStep {
  type: 'logicSwitches'
  switches: SwitchDef[]
  rule: SwitchRule
  /** Human description of the target state (shown after success). */
  expectedSolution?: Record<string, boolean>
  /** The door opens (and the step is solved) when rule(states) === correctAnswer. */
  correctAnswer: boolean
}

export interface OrderingItem {
  id: string
  text: string
}

export interface OrderingStep extends BaseStep {
  type: 'ordering'
  items: OrderingItem[]
  /** Item ids in the correct order. */
  correctAnswer: string[]
}

export type Step =
  | DialogueStep
  | CaseSummaryStep
  | ConceptStep
  | ChoiceStep
  | ClueSortStep
  | DeductionGridStep
  | SingleCellGridStep
  | LogicSwitchesStep
  | OrderingStep

export interface Lesson {
  id: string
  title: string
  subtitle: string
  doorLabel: string
  estimatedMinutes: number
  conceptTags: string[]
  unlockAfter: string | null
  badgeId: string
  steps: Step[]
}

// ---------- Firestore persistence types ----------

export type BadgeType = 'gold' | 'silver' | 'bronze' | 'retry'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  avatarId: string
  createdAt: unknown
  lastActiveAt: unknown
  currentLessonId: string
  currentStepId: string
  unlockedLessonIds: string[]
  completedLessonIds: string[]
  streakCount: number
  lastLessonCompletedDate: string
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed'

export interface StepAnswer {
  attempts: number
  isCorrect: boolean
  submittedValue: unknown
  completedAt: unknown
}

export interface LessonProgress {
  lessonId: string
  status: LessonStatus
  currentStepId: string
  completedStepIds: string[]
  mistakes: number
  failedRoundTriggered: boolean
  answers: Record<string, StepAnswer>
  /** Which case track (question versions) was chosen for the current/most-recent run. */
  variantTrack?: number
  startedAt: unknown
  updatedAt: unknown
  completedAt: unknown | null
  earnedBadge: BadgeType | null
}

export interface BadgeRecord {
  badgeId: string
  lessonId: string
  badgeType: BadgeType
  label: string
  earnedAt: unknown
}
