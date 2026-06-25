/**
 * [Agent 3] PUZZLE SCENE CONTROLLER — one focused DOM overlay per sector.
 *
 * Responsibilities:
 *   - Run a FIXED-length (~QUIZ_LEN) retrieval-practice quiz assembled from the
 *     sector's real lesson content: same -> varied core-skill questions with a
 *     slice of interleaved earlier-skill review. There is NO difficulty picker;
 *     every run is the same length and only the LEARNING MODE (visual / narrative
 *     / hands-on) changes how each question is presented.
 *   - Fade scaffolding across the run AND with prestige: the first question(s)
 *     get a fully-worked "Watch Akash solve one" example at prestige 0, a hint at
 *     prestige 1, and nothing from prestige 2 on.
 *   - Track productive failure per question (wrong-then-fixed = a "comeback") and
 *     report it via onComplete for the (other team's) economy/refund.
 *   - Never hard-fail; surface hints and the named failed move on a wrong answer.
 *
 * Rendered by the integrator on top of the R3F canvas. Self-contained: the only
 * 3D it uses is its own decorative mini-canvas (LockInset).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PuzzleReviewItem, PuzzleSceneProps } from '../contracts'
import { getSector } from '../../data/sectors'
import { buildQuiz, deviceKindForStep, deviceLabel } from './routes'
import type { InteractiveStep } from './types'
import DeviceRenderer from './DeviceRenderer'
import LockInset from './LockInset'
import { effectsAllowed } from '../engine/quality'
import { usePuzzleTimer } from './usePuzzleTimer'
import StepVisual from '../../components/StepVisual'
import { DEFAULT_MODE, learningModeDef, sectorSkillId, type LearningMode } from '../skills'
import type { SkillId } from '../../types'
import { lessons } from '../../data/lessons'
import '../../styles/puzzles3d.css'

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm}:${ss.toString().padStart(2, '0')}`
}

/** Worked / hint / none — the most help available at a given prestige. */
type Scaffold = 'worked' | 'hint' | 'none'

/** Maximum scaffold a player gets at a prestige level (fades as they prestige). */
function scaffoldLevel(prestige: number): Scaffold {
  if (prestige <= 0) return 'worked'
  if (prestige === 1) return 'hint'
  return 'none'
}

/**
 * Scaffold for one question = the prestige ceiling FADED across the run. Only the
 * opening question(s) get the strongest support; it tapers off after that.
 *  - prestige 0: q1 worked, q2 hint, rest none.
 *  - prestige 1: q1 hint, rest none.
 *  - prestige >=2: none.
 */
function scaffoldForStep(index: number, prestige: number): Scaffold {
  const ceiling = scaffoldLevel(prestige)
  if (ceiling === 'none') return 'none'
  if (ceiling === 'worked') {
    if (index === 0) return 'worked'
    if (index === 1) return 'hint'
    return 'none'
  }
  // ceiling === 'hint'
  return index === 0 ? 'hint' : 'none'
}

export default function PuzzleScene({
  sectorId,
  lesson,
  prestige = 0,
  mode: modeProp,
  skill: skillProp,
  onComplete,
  onMistake,
}: PuzzleSceneProps) {
  const elapsed = usePuzzleTimer()

  const mode: LearningMode = modeProp ?? DEFAULT_MODE
  const roomSkill: SkillId = skillProp ?? sectorSkillId(sectorId)
  const modeDef = learningModeDef(mode)

  // Raw wrong taps across the whole run (for analytics / alarm display).
  const rawMistakesRef = useRef(0)
  // Wrong taps on the CURRENT question (resets per question).
  const stepMistakes = useRef(0)
  // Questions that had >=1 wrong attempt but were then solved (productive failure).
  const comebacksRef = useRef(0)
  const reviewRef = useRef<PuzzleReviewItem[]>([])

  const [rawMistakes, setRawMistakes] = useState(0)
  const [stepIndex, setStepIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [workedDismissed, setWorkedDismissed] = useState(false)
  const [, forceTick] = useState(0)
  // Increments each time a wrong-then-fixed question is cleared, retriggering the
  // "Nice recovery!" celebration. 0 = never fired yet.
  const [comebackFlash, setComebackFlash] = useState(0)

  // The quiz is built once per run. Mode is passed for API symmetry but does not
  // change WHICH questions appear — only the presentation below differs.
  const quiz = useMemo<InteractiveStep[]>(
    () => buildQuiz(lesson, { prestige, skill: roomSkill, mode, allLessons: lessons }),
    [lesson, prestige, roomSkill, mode],
  )

  // Tick once a second so the on-screen clock stays live.
  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const scaffold = scaffoldForStep(stepIndex, prestige)

  // Reset per-question scaffold state whenever we advance to a new question.
  useEffect(() => {
    setWorkedDismissed(false)
    setShowHint(scaffoldForStep(stepIndex, prestige) === 'hint')
  }, [stepIndex, prestige])

  const sector = getSector(sectorId)
  const sectorName = sector?.name ?? lesson.title

  const registerMistake = () => {
    rawMistakesRef.current += 1
    stepMistakes.current += 1
    setRawMistakes(rawMistakesRef.current)
    onMistake?.()
  }

  const recordCurrent = () => {
    const step = quiz[stepIndex]
    if (!step) return
    const erred = stepMistakes.current > 0
    if (erred) comebacksRef.current += 1
    const stepSkill = step.skill ?? roomSkill
    reviewRef.current.push({
      prompt: step.prompt,
      correct: !erred,
      explanation: step.feedback?.secondWrong,
      takeaways: step.guidedReasoning,
      // Only name the failed move when they actually erred on this question.
      failedMove: erred ? step.feedback?.failedMove ?? undefined : undefined,
      recovered: erred,
      skill: stepSkill,
    })
  }

  const handleSolved = () => {
    // A "comeback" = this question had >=1 wrong attempt before being solved.
    // Celebrate it MORE than a first-try correct — this game rewards the dip.
    const wasComeback = stepMistakes.current > 0
    recordCurrent()
    if (wasComeback && effectsAllowed()) {
      setComebackFlash((n) => n + 1)
    }
    if (stepIndex + 1 < quiz.length) {
      setStepIndex((i) => i + 1)
      stepMistakes.current = 0
    } else {
      onComplete({
        solved: true,
        // PRODUCTIVE-FAILURE accounting: a completed room means every question
        // was eventually solved, so corrections are "refunded" — `mistakes`
        // (unrecovered) is 0. The raw wrong-tap count and the number of
        // recovered questions are reported separately for the economy team.
        mistakes: 0,
        rawMistakes: rawMistakesRef.current,
        comebacks: comebacksRef.current,
        timeMs: elapsed(),
        route: mode,
        mode,
        review: reviewRef.current,
      })
    }
  }

  const abandon = () => {
    onComplete({
      solved: false,
      // Bailing out: the questions not yet solved are the genuinely-missed ones.
      mistakes: Math.max(0, quiz.length - stepIndex),
      rawMistakes: rawMistakesRef.current,
      comebacks: comebacksRef.current,
      timeMs: elapsed(),
      route: mode,
      mode,
      review: reviewRef.current,
    })
  }

  const sectorKicker = sector
    ? `Security Lock · ${sector.name.split('·').pop()?.trim() ?? sectorId}`
    : 'Security Lock'
  const progress = quiz.length > 0 ? stepIndex / quiz.length : 0
  const currentStep = quiz[stepIndex]
  const showWorked = scaffold === 'worked' && !workedDismissed

  return (
    <div className="p3-overlay" role="dialog" aria-modal="true" aria-label={`Security lock — ${sectorName}`}>
      <div className={`p3-frame mode-${mode}`}>
        <header className="p3-header">
          <LockInset progress={progress} />
          <div className="p3-header-text">
            <span className="p3-kicker">{sectorKicker}</span>
            <h2 className="p3-title">{lesson.title}</h2>
            <p className="p3-subtitle">
              Node {Math.min(stepIndex + 1, quiz.length || 1)} of {quiz.length} ·{' '}
              <span className="p3-mode-chip">
                {modeDef.glyph} {modeDef.label} mode
              </span>
            </p>
          </div>
          <div className="p3-meta">
            <div className="p3-chip">
              <span className="p3-chip-num">{formatTime(elapsed())}</span>
              <span className="p3-chip-label">Time</span>
            </div>
            <div className={`p3-chip${rawMistakes > 0 ? ' is-alert' : ''}`}>
              <span className="p3-chip-num">{rawMistakes}</span>
              <span className="p3-chip-label">Alarm</span>
            </div>
          </div>
        </header>

        <div className="p3-body">
          {currentStep && (
            <QuizRun
              step={currentStep}
              stepIndex={stepIndex}
              total={quiz.length}
              mode={mode}
              roomSkill={roomSkill}
              showHint={showHint}
              showWorked={showWorked}
              onDismissWorked={() => setWorkedDismissed(true)}
              progress={progress}
              onSolved={handleSolved}
              onMistake={registerMistake}
            />
          )}

          {quiz.length === 0 && (
            <div className="p3-device">
              <p className="p3-prompt">No reasoning node is wired to this lock.</p>
            </div>
          )}
        </div>

        <footer className="p3-footer">
          {currentStep?.guidedReasoning?.length ? (
            <button type="button" className="p3-btn-hint" onClick={() => setShowHint((s) => !s)}>
              {showHint ? 'Hide reasoning' : 'Request hint'}
            </button>
          ) : (
            <span />
          )}
          <span className="spacer" />
          <button type="button" className="p3-btn ghost" onClick={abandon}>
            Abandon breach
          </button>
        </footer>

        {comebackFlash > 0 && <ComebackBurst key={comebackFlash} />}
      </div>
    </div>
  )
}

/**
 * A brief, celebratory "Nice recovery!" flourish shown when a player corrects a
 * question they first got wrong. Deliberately punchier than first-try success.
 * Mounted with a changing key so it replays; the controller only renders it when
 * effectsAllowed() is true, so it is already gated on quality + reduced-motion.
 */
function ComebackBurst() {
  const sparks = useMemo(() => {
    const count = 9
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const dist = 64 + (i % 3) * 14
      return {
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist}px`,
        delay: `${(i % 4) * 30}ms`,
      }
    })
  }, [])
  return (
    <div className="p3-comeback" aria-hidden>
      <div className="p3-comeback-badge">
        {sparks.map((s, i) => (
          <span
            key={i}
            className="p3-comeback-spark"
            style={{ '--dx': s.dx, '--dy': s.dy, animationDelay: s.delay } as React.CSSProperties}
          />
        ))}
        <span className="p3-comeback-title">Nice recovery! ✦</span>
        <span className="p3-comeback-sub">Fixed it yourself — that&apos;s the win</span>
      </div>
    </div>
  )
}

/** A fully-worked example: Akash walks the correct reasoning before you answer. */
function WorkedExample({ step, onDismiss }: { step: InteractiveStep; onDismiss: () => void }) {
  const reasoning = step.guidedReasoning ?? []
  const conclusion = step.feedback?.correct
  return (
    <div className="p3-worked" role="note">
      <div className="p3-worked-head">
        <span className="p3-worked-avatar" aria-hidden="true">
          A
        </span>
        <div>
          <span className="p3-worked-title">Watch Akash solve one</span>
          <span className="p3-worked-sub">I'll talk through it once — then it's all you.</span>
        </div>
      </div>
      <p className="p3-worked-prompt">{step.prompt}</p>
      {reasoning.length > 0 && (
        <ol className="p3-worked-steps">
          {reasoning.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      )}
      {conclusion && <p className="p3-worked-conclusion">{conclusion}</p>}
      <button type="button" className="p3-btn primary" onClick={onDismiss}>
        Got it — let me try
      </button>
    </div>
  )
}

/** Mode-specific framing shown above the device (presentation only). */
function ModeFraming({ step, mode, roomSkill }: { step: InteractiveStep; mode: LearningMode; roomSkill: SkillId }) {
  if (mode === 'visual') {
    if (!step.visual) return null
    return (
      <div className="p3-framing mode-visual" aria-label="Visual aid">
        <StepVisual visual={step.visual} />
      </div>
    )
  }
  if (mode === 'narrative') {
    return (
      <div className="p3-framing mode-narrative">
        <p className="p3-narrative-line">
          <span className="p3-worked-avatar" aria-hidden="true">
            A
          </span>
          <span>
            Read it like a case file — let the words do the work. {failedMoveReminder(step, roomSkill)}
          </span>
        </p>
      </div>
    )
  }
  // handson
  return (
    <div className="p3-framing mode-handson">
      <p className="p3-handson-line">✦ Drag / toggle / tap to build your answer.</p>
    </div>
  )
}

/** A gentle, spoiler-free nudge toward the move this question rehearses. */
function failedMoveReminder(step: InteractiveStep, roomSkill: SkillId): string {
  const skill = step.skill ?? roomSkill
  switch (skill) {
    case 'fact-vs-guess':
      return 'Separate what is stated from what you are assuming.'
    case 'grid-elimination':
      return 'Let each clue force the next mark.'
    case 'if-then':
      return 'Test every guess against the clues.'
    case 'logic-gates':
      return 'Make the rule come out true.'
    case 'ordered-explanation':
      return 'Put each step after the one it depends on.'
    default:
      return 'Pick the move the clues actually call for.'
  }
}

function QuizRun({
  step,
  stepIndex,
  total,
  mode,
  roomSkill,
  showHint,
  showWorked,
  onDismissWorked,
  progress,
  onSolved,
  onMistake,
}: {
  step: InteractiveStep
  stepIndex: number
  total: number
  mode: LearningMode
  roomSkill: SkillId
  showHint: boolean
  showWorked: boolean
  onDismissWorked: () => void
  progress: number
  onSolved: () => void
  onMistake: () => void
}) {
  const kind = deviceKindForStep(step)
  return (
    <div className={`p3-device mode-${mode}`}>
      <div className="p3-progress">
        <span>{deviceLabel(kind)}</span>
        <span className="p3-progress-track">
          <span className="p3-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
        <span>
          {stepIndex + 1}/{total}
        </span>
      </div>

      {showWorked && <WorkedExample step={step} onDismiss={onDismissWorked} />}

      <ModeFraming step={step} mode={mode} roomSkill={roomSkill} />

      <DeviceRenderer
        key={`${stepIndex}:${step.id}`}
        step={step}
        mode={mode}
        skill={roomSkill}
        onSolved={onSolved}
        onMistake={onMistake}
      />

      {showHint && step.guidedReasoning && step.guidedReasoning.length > 0 && (
        <div className="p3-feedback hint">
          Reasoning trace
          <ul className="p3-hint-list">
            {step.guidedReasoning.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
