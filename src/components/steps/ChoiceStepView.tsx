import { useState } from 'react'
import type { ChoiceStep } from '../../types'

const SYMBOL_GLYPH: Record<string, string> = { X: '✕', check: '✓', blank: '' }

export default function ChoiceStepView({
  step,
  locked,
  onResult,
}: {
  step: ChoiceStep
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [evaluated, setEvaluated] = useState(false)
  const isSymbolTap = step.type === 'symbolTap'

  function stateClass(id: string): string {
    if (locked && id === step.correctAnswer) return 'right'
    if (evaluated && id === selected) {
      return id === step.correctAnswer ? 'right' : 'wrong'
    }
    if (id === selected) return 'selected'
    return ''
  }

  function pick(id: string) {
    if (locked) return
    setSelected(id)
    setEvaluated(false)
  }

  function check() {
    if (!selected) return
    const isCorrect = selected === step.correctAnswer
    setEvaluated(true)
    onResult(isCorrect, selected)
  }

  return (
    <div>
      {isSymbolTap ? (
        <div className="symboltap-row">
          {step.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`symbol-tile ${stateClass(c.id)}`}
              onClick={() => pick(c.id)}
              disabled={locked}
            >
              <span className={`symbol-glyph sym-${c.id}`}>{SYMBOL_GLYPH[c.id] ?? ''}</span>
              <span className="symbol-cap">{c.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="choice-list">
          {step.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`choice ${stateClass(c.id)}`}
              onClick={() => pick(c.id)}
              disabled={locked}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {!locked && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 14 }}
          disabled={!selected}
          onClick={check}
        >
          Check
        </button>
      )}
    </div>
  )
}
