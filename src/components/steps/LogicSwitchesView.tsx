import { useState } from 'react'
import type { LogicSwitchesStep } from '../../types'
import { evaluateRule, checkSwitches } from '../../logic/switchLogic'

export default function LogicSwitchesView({
  step,
  locked,
  onResult,
}: {
  step: LogicSwitchesStep
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  const initial: Record<string, boolean> = {}
  for (const s of step.switches) initial[s.id] = false
  const [state, setState] = useState<Record<string, boolean>>(initial)

  const doorOpen = evaluateRule(step.rule, state)

  function toggle(id: string) {
    if (locked) return
    setState((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function check() {
    const isCorrect = checkSwitches(step.rule, state, step.correctAnswer)
    onResult(isCorrect, state)
  }

  return (
    <div>
      <div className={`door-status`}>
        <span className={`door-light ${doorOpen ? 'open' : ''}`} aria-hidden />
        <span className="door-status-text">
          {doorOpen ? 'Door: OPEN' : 'Door: LOCKED'}
        </span>
      </div>

      <div className="switch-list">
        {step.switches.map((s) => (
          <div key={s.id} className="switch-row">
            <span>{s.label}</span>
            <button
              type="button"
              className={`toggle ${state[s.id] ? 'on' : ''}`}
              onClick={() => toggle(s.id)}
              disabled={locked}
              role="switch"
              aria-checked={state[s.id]}
              aria-label={s.label}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        ))}
      </div>

      {!locked && (
        <button type="button" className="btn btn-primary btn-block" onClick={check}>
          Check Door
        </button>
      )}
    </div>
  )
}
