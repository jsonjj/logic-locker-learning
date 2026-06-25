import { useMemo, useState } from 'react'
import { getReviewDeck } from '../review/decks'
import { getSector } from '../../data/sectors'
import { getLesson } from '../../data/lessons'
import type { Choice, Step, StepFeedback } from '../../types'
import type { SectorId } from '../contracts'
import { effectsAllowed, useQuality } from '../engine/quality'
import '../../styles/learn.css'

export interface LearnPanelProps {
  sectorId: SectorId
  /** Player finished the briefing and wants to attempt the lock (mini-quiz). */
  onBegin: () => void
}

/** The choice-style interactive step types we can render as a quick question. */
const CHOICE_TYPES = new Set(['multipleChoice', 'prediction', 'highlightChoice', 'symbolTap'])

interface MissionQuestion {
  prompt: string
  choices: Choice[]
  correctAnswer: string
  feedback?: StepFeedback
}

/**
 * Pull ONE "mission question" from the lesson's first interactive choice step.
 * We read `lesson.steps` directly (no buildQuiz dependency) so the prequestion
 * mirrors what the player will actually face at the lock.
 */
function deriveMissionQuestion(steps: Step[] | undefined): MissionQuestion | null {
  if (!steps) return null
  for (const step of steps) {
    if (
      CHOICE_TYPES.has(step.type) &&
      'choices' in step &&
      Array.isArray(step.choices) &&
      step.choices.length > 0 &&
      typeof step.correctAnswer === 'string'
    ) {
      return {
        prompt: step.prompt,
        choices: step.choices,
        correctAnswer: step.correctAnswer,
        feedback: step.feedback,
      }
    }
  }
  return null
}

type Phase = 'pre' | 'briefing' | 'reask'

/**
 * The "learn before you quiz" beat shown when the player enters a block. Flow:
 *   1. PRE  — one mission question BEFORE teaching. A wrong answer is expected
 *             and never penalized; it just primes curiosity, then we teach.
 *   2. BRIEFING — the block's concept cards (sourced from the review deck).
 *   3. RE-ASK — the SAME question again, now with feedback, so the player feels
 *             the concept click. Then "Begin" starts the real lock.
 */
export default function LearnPanel({ sectorId, onBegin }: LearnPanelProps) {
  const deck = getReviewDeck(sectorId)
  const sector = getSector(sectorId)
  const topics = deck?.topics ?? []
  const teacher = deck?.teacherLines?.[0]?.text

  const lesson = sector ? getLesson(sector.lessonId) : undefined
  const question = useMemo(() => deriveMissionQuestion(lesson?.steps), [lesson])

  // If there's no usable question, fall back to the plain briefing-only flow.
  const [phase, setPhase] = useState<Phase>(question ? 'pre' : 'briefing')
  const [i, setI] = useState(0)
  const [preChoice, setPreChoice] = useState<string | null>(null)
  const [reChoice, setReChoice] = useState<string | null>(null)

  // Stagger-reveal each beat's contents; snapped under reduced-motion / low tier.
  useQuality()
  const animClass = effectsAllowed() ? ' learn-anim' : ''

  const topic = topics[i]
  const last = i >= topics.length - 1

  // ----- Phase: PRE (mission question before teaching) -----
  if (phase === 'pre' && question) {
    const answered = preChoice !== null
    return (
      <div className="learn-overlay">
        <div className={`learn-card${animClass}`} key="pre">
          <div className="learn-kicker">Mission · {sector?.name ?? 'Block'}</div>
          <p className="learn-teacher">Before the briefing — take your best shot. Guessing wrong here costs nothing.</p>
          <h2 className="learn-q-prompt">{question.prompt}</h2>
          <div className="learn-q-choices">
            {question.choices.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`learn-q-choice${preChoice === c.id ? ' is-picked' : ''}`}
                disabled={answered}
                onClick={() => setPreChoice(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {answered && (
            <p className="learn-q-note">
              Hold that thought — let's see why. On to the briefing.
            </p>
          )}
          <div className="learn-actions">
            <span className="learn-progress">Pre-check</span>
            <div className="learn-buttons">
              {answered && (
                <button type="button" className="btn btn-primary" onClick={() => setPhase('briefing')}>
                  Learn it →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ----- Phase: RE-ASK (same question after teaching, now with feedback) -----
  if (phase === 'reask' && question) {
    const answered = reChoice !== null
    const correct = reChoice === question.correctAnswer
    const fb = question.feedback
    const feedbackText = correct
      ? fb?.correct ?? 'Exactly — that follows from what you just learned.'
      : fb?.firstWrong ?? 'Not quite — revisit the idea and try the real lock.'
    return (
      <div className="learn-overlay">
        <div className={`learn-card${animClass}`} key="reask">
          <div className="learn-kicker">Now you know · {sector?.name ?? 'Block'}</div>
          <p className="learn-teacher">Same question — does it click now?</p>
          <h2 className="learn-q-prompt">{question.prompt}</h2>
          <div className="learn-q-choices">
            {question.choices.map((c) => {
              const isCorrect = answered && c.id === question.correctAnswer
              const isWrongPick = answered && c.id === reChoice && !correct
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`learn-q-choice${reChoice === c.id ? ' is-picked' : ''}${
                    isCorrect ? ' is-correct' : ''
                  }${isWrongPick ? ' is-wrong' : ''}`}
                  disabled={answered}
                  onClick={() => setReChoice(c.id)}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          {answered && (
            <p className={`learn-q-feedback${correct ? ' is-correct' : ' is-wrong'}`}>{feedbackText}</p>
          )}
          <div className="learn-actions">
            <span className="learn-progress">Re-check</span>
            <div className="learn-buttons">
              {answered && (
                <button type="button" className="btn btn-primary" onClick={onBegin}>
                  Begin →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ----- Phase: BRIEFING (concept cards) -----
  const advanceFromBriefing = () => {
    if (question) setPhase('reask')
    else onBegin()
  }

  return (
    <div className="learn-overlay">
      <div className={`learn-card${animClass}`} key={`briefing-${i}`}>
        <div className="learn-kicker">Briefing · {sector?.name ?? 'Block'}</div>
        {teacher && <p className="learn-teacher">“{teacher}”</p>}

        {topic ? (
          <>
            <h2 className="learn-term">{topic.term}</h2>
            <p className="learn-detail">{topic.detail}</p>
            {topic.example && <p className="learn-example">Example: {topic.example}</p>}
          </>
        ) : (
          <p className="learn-detail">Crack the lock to break into the next block.</p>
        )}

        <div className="learn-actions">
          <span className="learn-progress">
            {topics.length > 0 ? `${i + 1} / ${topics.length}` : ''}
          </span>
          <div className="learn-buttons">
            {i > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => setI((n) => n - 1)}>
                Back
              </button>
            )}
            {topics.length > 0 && !last ? (
              <button type="button" className="btn btn-primary" onClick={() => setI((n) => n + 1)}>
                Next
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={advanceFromBriefing}>
                {question ? 'Check yourself →' : 'Work the lock →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
