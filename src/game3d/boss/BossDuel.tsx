import { useMemo, useState } from 'react'
import { lessons, getLesson } from '../../data/lessons'
import { trackCount, varyStep } from '../../logic/variants'
import ChoiceStepView from '../../components/steps/ChoiceStepView'
import StepVisual from '../../components/StepVisual'
import { getEndingLines } from '../story/objectives'
import { SKILL_CHAIN, SKILLS, sectorForSkill } from '../skills'
import type { ChoiceStep } from '../../types'
import '../../styles/boss.css'

const CHOICE_TYPES = ['multipleChoice', 'prediction', 'highlightChoice', 'symbolTap']

/** How many earlier-skill questions the retention warm-up asks. */
const RETENTION_COUNT = 3

/**
 * One cumulative question per lesson — the "test on everything". Prefers a
 * question that carries its own context (a visual: grid/clues/options) so the
 * prompt is never asked without the facts needed to answer it.
 *
 * Each duel rolls fresh: it rotates WHICH eligible question each block asks and
 * resolves it to a varied authored track with the answer order shuffled (the
 * same local "freshness" pass the rooms use), so the Warden never asks the exact
 * same exam twice. `prestige` nudges the rotation so post-prestige runs differ.
 */
/** Resolve one fresh, context-carrying question from a lesson (varied + shuffled). */
function rollQuestion(lessonId: string, prestige: number): ChoiceStep | null {
  const lesson = getLesson(lessonId)
  if (!lesson) return null
  const choices = lesson.steps.filter((s) => CHOICE_TYPES.includes(s.type)) as ChoiceStep[]
  if (choices.length === 0) return null
  // Prefer context-carrying (visual) questions, but rotate among them.
  const withVisual = choices.filter((s) => s.visual)
  const pool = withVisual.length > 0 ? withVisual : choices
  const base = pool[Math.floor(Math.random() * pool.length)]
  const tracks = trackCount(lesson)
  const track = tracks > 1 ? (Math.floor(Math.random() * tracks) + prestige) % tracks : 0
  return varyStep(base, track) as ChoiceStep
}

function buildExam(prestige: number): ChoiceStep[] {
  const out: ChoiceStep[] = []
  for (const l of lessons) {
    const q = rollQuestion(l.id, prestige)
    if (q) out.push(q)
  }
  return out
}

/**
 * The Warden RETENTION GATE: a short warm-up of EARLIER-skill questions the
 * player must clear before the cumulative exam counts. It interleaves a few of
 * the foundational reasoning skills (drawn from the skill chain), so the Warden
 * only "counts" once you've proven the basics still stick. Failure is
 * non-punitive — you simply warm up again.
 */
function buildRetention(prestige: number): ChoiceStep[] {
  // Shuffle the chain, then pull the first few skills that yield a question.
  const skills = [...SKILL_CHAIN]
  for (let i = skills.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[skills[i], skills[j]] = [skills[j], skills[i]]
  }
  const out: ChoiceStep[] = []
  for (const skill of skills) {
    if (out.length >= RETENTION_COUNT) break
    const lessonId = sectorForSkill(skill)
    if (!lessonId) continue
    // sector.id === sector.lessonId, so the sector id doubles as the lesson id.
    const q = rollQuestion(lessonId, prestige)
    if (q) out.push({ ...q, skill: q.skill ?? skill })
  }
  return out
}

export interface BossDuelProps {
  /** Player subdued the Warden (passed the cumulative test). */
  onWin: () => void
  /** Player bailed out of the duel. */
  onClose: () => void
  /** Prestige level — keeps re-fought warden exams fresh across replays. */
  prestige?: number
}

/**
 * The final boss: a cumulative test drawn from every block. Each correct answer
 * lands a hit on the Warden; each miss costs a heart. Subdue the Warden (clear
 * the threshold) to win. Learning-safe: running out of hearts just lets you
 * regroup and retry — you're never permanently failed.
 */
export default function BossDuel({ onWin, onClose, prestige = 0 }: BossDuelProps) {
  // Two stages: the retention warm-up gate, then the cumulative exam.
  const [stage, setStage] = useState<'retention' | 'exam'>('retention')

  // Bumped on each retry so a fresh exam (new questions/variants) is rolled.
  const [seed, setSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exam = useMemo(() => buildExam(prestige), [prestige, seed])
  const total = exam.length
  const threshold = Math.max(1, Math.ceil(total * 0.7))

  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [locked, setLocked] = useState(false)
  const [feedback, setFeedback] = useState<null | { ok: boolean; text: string }>(null)
  const [outcome, setOutcome] = useState<null | 'win' | 'lose'>(null)

  const q = exam[i]
  const wardenPct = total > 0 ? Math.max(0, (total - correct) / total) : 0

  function handleResult(ok: boolean) {
    if (locked || !q) return
    setLocked(true)
    setCorrect((c) => c + (ok ? 1 : 0))
    setHearts((h) => (ok ? h : h - 1))
    setFeedback({
      ok,
      text: ok
        ? q.feedback?.correct ?? 'Direct hit — the Warden staggers.'
        : q.feedback?.firstWrong ?? 'The Warden shrugs it off. Stay sharp.',
    })
  }

  function advance() {
    setFeedback(null)
    setLocked(false)
    if (hearts <= 0) {
      setOutcome('lose')
      return
    }
    const next = i + 1
    if (next >= total) {
      setOutcome(correct >= threshold ? 'win' : 'lose')
      return
    }
    setI(next)
  }

  function retry() {
    setSeed((s) => s + 1)
    setI(0)
    setCorrect(0)
    setHearts(3)
    setLocked(false)
    setFeedback(null)
    setOutcome(null)
  }

  // ---- Retention warm-up gate state ----------------------------------------
  const [retSeed, setRetSeed] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const retention = useMemo(() => buildRetention(prestige), [prestige, retSeed])
  const retTotal = retention.length
  // Pass with one slip allowed — proving recall, not perfection.
  const retThreshold = Math.max(1, retTotal - 1)
  const [rI, setRI] = useState(0)
  const [rCorrect, setRCorrect] = useState(0)
  const [rLocked, setRLocked] = useState(false)
  const [rFeedback, setRFeedback] = useState<null | { ok: boolean; text: string }>(null)
  const [retOutcome, setRetOutcome] = useState<null | 'pass' | 'fail'>(null)
  const rQ = retention[rI]

  function handleRetResult(ok: boolean) {
    if (rLocked || !rQ) return
    setRLocked(true)
    setRCorrect((c) => c + (ok ? 1 : 0))
    setRFeedback({
      ok,
      text: ok
        ? rQ.feedback?.correct ?? 'Still sharp — that skill held.'
        : rQ.feedback?.firstWrong ?? 'Rusty on that one. Shake it off.',
    })
  }

  function advanceRet() {
    const wasOk = rFeedback?.ok ? 1 : 0
    setRFeedback(null)
    setRLocked(false)
    const next = rI + 1
    if (next >= retTotal) {
      setRetOutcome(rCorrect + wasOk >= retThreshold ? 'pass' : 'fail')
      return
    }
    setRI(next)
  }

  function retryRetention() {
    setRetSeed((s) => s + 1)
    setRI(0)
    setRCorrect(0)
    setRLocked(false)
    setRFeedback(null)
    setRetOutcome(null)
  }

  function startExam() {
    setStage('exam')
  }

  // ---- Retention gate render (must clear before the exam counts) ------------
  if (stage === 'retention') {
    if (retOutcome) {
      const passed = retOutcome === 'pass'
      return (
        <div className="boss-overlay">
          <div className={`boss-card boss-outcome ${passed ? 'is-win' : 'is-lose'}`}>
            <div className="boss-kicker">Retention check</div>
            <h2 className="boss-title">{passed ? 'Recall confirmed' : 'Not quite warmed up'}</h2>
            <p className="boss-score">
              {rCorrect} / {retTotal} earlier skills held · needed {retThreshold}
            </p>
            <p className="boss-detail">
              {passed
                ? 'Your foundations still hold. The Warden will count this fight — step up.'
                : "The basics slipped. No penalty — warm up the earlier skills and try the gate again."}
            </p>
            <div className="boss-actions">
              {passed ? (
                <button type="button" className="btn btn-primary" onClick={startExam}>
                  Begin the exam →
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost" onClick={onClose}>
                    Retreat
                  </button>
                  <button type="button" className="btn btn-primary" onClick={retryRetention}>
                    Warm up again
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (!rQ) {
      // No earlier-skill questions available — let the player through the gate.
      return (
        <div className="boss-overlay">
          <div className="boss-card">
            <div className="boss-kicker">Retention check</div>
            <p className="boss-detail">No warm-up needed. Straight to the Warden.</p>
            <div className="boss-actions">
              <button type="button" className="btn btn-primary" onClick={startExam}>
                Begin the exam →
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="boss-overlay">
        <div className="boss-card">
          <div className="boss-kicker">Retention gate · prove the basics still stick</div>
          <div className="boss-qmeta">
            Warm-up {rI + 1} / {retTotal}
            {rQ.skill ? ` · ${SKILLS[rQ.skill].label}` : ''}
          </div>
          <h2 className="boss-prompt">{rQ.prompt}</h2>

          {rQ.visual && (
            <div className="boss-visual">
              <StepVisual visual={rQ.visual} />
            </div>
          )}

          <ChoiceStepView step={rQ} locked={rLocked} onResult={(ok) => handleRetResult(ok)} />

          {rFeedback && (
            <div className={`boss-feedback ${rFeedback.ok ? 'is-ok' : 'is-bad'}`}>
              <p>{rFeedback.text}</p>
              <button type="button" className="btn btn-primary" onClick={advanceRet}>
                {rI + 1 >= retTotal ? 'Finish warm-up' : 'Next'} →
              </button>
            </div>
          )}

          <button type="button" className="boss-bail" onClick={onClose}>
            Retreat
          </button>
        </div>
      </div>
    )
  }

  if (outcome) {
    const won = outcome === 'win'
    return (
      <div className="boss-overlay">
        <div className={`boss-card boss-outcome ${won ? 'is-win' : 'is-lose'}`}>
          <div className="boss-kicker">{won ? 'The Warden falls' : 'The Warden holds'}</div>
          <h2 className="boss-title">{won ? 'Breakout complete' : 'Recaptured — but not done'}</h2>
          <p className="boss-score">
            {correct} / {total} correct · needed {threshold}
          </p>
          {won ? (
            <div className="boss-ending">
              {getEndingLines().map((line, idx) => (
                <p key={idx} className="boss-ending-line">
                  <b>{line.name}:</b> {line.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="boss-detail">
              You didn’t land enough clean hits. Regroup, recall what each block taught you, and take
              another run at the Warden.
            </p>
          )}
          <div className="boss-actions">
            {won ? (
              <button type="button" className="btn btn-primary" onClick={onWin}>
                Claim freedom →
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Leave arena
                </button>
                <button type="button" className="btn btn-primary" onClick={retry}>
                  Face the Warden again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!q) {
    return (
      <div className="boss-overlay">
        <div className="boss-card">
          <p className="boss-detail">No exam questions found.</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="boss-overlay">
      <div className="boss-card">
        <div className="boss-hud">
          <div className="boss-warden">
            <span className="boss-warden-name">The Warden</span>
            <div className="boss-hpbar">
              <span className="boss-hpfill" style={{ width: `${wardenPct * 100}%` }} />
            </div>
          </div>
          <div className="boss-hearts" aria-label={`${hearts} attempts left`}>
            {[0, 1, 2].map((h) => (
              <span key={h} className={`boss-heart${h < hearts ? '' : ' is-spent'}`}>
                ♥
              </span>
            ))}
          </div>
        </div>

        <div className="boss-qmeta">
          Cumulative test · {i + 1} / {total}
        </div>
        <h2 className="boss-prompt">{q.prompt}</h2>

        {q.visual && (
          <div className="boss-visual">
            <StepVisual visual={q.visual} />
          </div>
        )}

        <ChoiceStepView step={q} locked={locked} onResult={(ok) => handleResult(ok)} />

        {feedback && (
          <div className={`boss-feedback ${feedback.ok ? 'is-ok' : 'is-bad'}`}>
            <p>{feedback.text}</p>
            <button type="button" className="btn btn-primary" onClick={advance}>
              {i + 1 >= total ? 'Finish' : 'Next'} →
            </button>
          </div>
        )}

        <button type="button" className="boss-bail" onClick={onClose}>
          Retreat
        </button>
      </div>
    </div>
  )
}
