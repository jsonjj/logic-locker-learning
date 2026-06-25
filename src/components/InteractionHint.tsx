import { useEffect, useState } from 'react'
import type { StepType } from '../types'

/** Short "how to play" copy shown the first time a learner meets each interaction. */
const HINTS: Partial<Record<StepType, { title: string; body: string }>> = {
  multipleChoice: {
    title: 'Multiple choice',
    body: 'Read the clues, then tap the answer you can prove is correct.',
  },
  prediction: {
    title: 'Make a prediction',
    body: 'Use what you know so far and tap the outcome you expect.',
  },
  highlightChoice: {
    title: 'Spot the right one',
    body: 'Tap the option that best matches the clues.',
  },
  symbolTap: {
    title: 'Mark it',
    body: 'Tap the symbol — ✓ for true, ✕ for impossible — that fits the clue.',
  },
  clueSort: {
    title: 'Sort the clues',
    body: 'Drag a clue into a case file, or tap a clue then tap a file. Tap a placed clue to take it back.',
  },
  deductionGrid: {
    title: 'Fill the grid',
    body: 'Tap a cell to cycle blank → ✕ → ✓. Mark what must be impossible and what must be true.',
  },
  miniGrid: {
    title: 'Fill the grid',
    body: 'Tap a cell to cycle blank → ✕ → ✓. Mark what must be impossible and what must be true.',
  },
  singleCellGrid: {
    title: 'One cell to crack',
    body: 'Tap the highlighted cell until it shows the right answer (✓ or ✕).',
  },
  logicSwitches: {
    title: 'Flip the switches',
    body: 'Toggle the switches until the door light turns green.',
  },
  ordering: {
    title: 'Put it in order',
    body: 'Drag the steps to reorder them, or use the ▲ ▼ buttons, until the sequence is right.',
  },
}

function storageKey(type: StepType) {
  return `ll_hint_seen_${type}`
}

/** Shows a one-time, dismissible tip the first time each interaction type appears. */
export default function InteractionHint({ type }: { type: StepType }) {
  const hint = HINTS[type]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!hint) return
    try {
      if (!localStorage.getItem(storageKey(type))) setVisible(true)
    } catch {
      /* localStorage unavailable — just skip the hint */
    }
  }, [type, hint])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(storageKey(type), '1')
    } catch {
      /* ignore */
    }
  }

  if (!hint || !visible) return null

  return (
    <div className="interaction-hint" role="note">
      <span className="interaction-hint-icon" aria-hidden>
        ?
      </span>
      <div className="interaction-hint-body">
        <div className="interaction-hint-title">{hint.title}</div>
        <p className="interaction-hint-text">{hint.body}</p>
      </div>
      <button
        type="button"
        className="interaction-hint-close"
        onClick={dismiss}
        aria-label="Dismiss tip"
      >
        Got it
      </button>
    </div>
  )
}
