/**
 * [Agent 3] LOGIC-GATE PANEL — maps logicSwitches steps onto a blast-door relay
 * board. Flip the input switches so the gate's output matches the lock target
 * (AND / OR / NOT), then engage. OR gates accept multiple valid configurations,
 * giving this device its own little branch of "correct" answers.
 */
import { useMemo, useState } from 'react'
import type { LogicSwitchesStep, SkillId, SwitchRule } from '../../types'
import { evaluateRule } from '../../logic/switchLogic'
import { failedMoveFor, type LearningMode } from '../skills'
import type { DeviceCallbacks } from './types'

interface Props extends DeviceCallbacks {
  step: LogicSwitchesStep
  mode?: LearningMode
  skill?: SkillId
}

function describeRule(rule: SwitchRule, labels: Record<string, string>): string {
  switch (rule.kind) {
    case 'var':
      return labels[rule.id] ?? rule.id
    case 'not':
      return `NOT ${describeRule(rule.operand, labels)}`
    case 'and':
      return rule.operands.map((operand) => describeRule(operand, labels)).join(' AND ')
    case 'or':
      return rule.operands.map((operand) => describeRule(operand, labels)).join(' OR ')
  }
}

export default function LogicGatePanel({ step, onSolved, onMistake, mode, skill }: Props) {
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [attempts, setAttempts] = useState(0)
  const [solved, setSolved] = useState(false)

  const labels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const sw of step.switches) map[sw.id] = sw.label
    return map
  }, [step.switches])

  const formula = useMemo(() => describeRule(step.rule, labels), [step.rule, labels])
  const output = evaluateRule(step.rule, states)
  const matches = output === step.correctAnswer

  const toggle = (id: string) => {
    if (solved) return
    setStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const engage = () => {
    if (solved) return
    if (matches) {
      setSolved(true)
      onSolved()
    } else {
      setAttempts((a) => a + 1)
      onMistake()
    }
  }

  const feedback = step.feedback
  const erred = !solved && attempts > 0
  const failedMove = step.feedback?.failedMove ?? failedMoveFor(step.skill ?? skill)
  let message: { tone: 'good' | 'bad'; text: string } | null = null
  if (solved && feedback) {
    message = { tone: 'good', text: feedback.correct }
  } else if (attempts > 0 && feedback) {
    message = { tone: 'bad', text: attempts <= 1 ? feedback.firstWrong : feedback.secondWrong }
  }

  return (
    <div className={`p3-device${mode ? ` mode-${mode}` : ''}`}>
      <p className="p3-prompt">{step.prompt}</p>
      {mode === 'handson' && (
        <p className="p3-affordance">Toggle the input switches to build the logic, then engage.</p>
      )}
      <div className="p3-gate">
        <div className="p3-gate-formula">
          Door opens when: <b>{formula}</b> = <b>{step.correctAnswer ? 'OPEN' : 'LOCKED'}</b>
        </div>
        <div className="p3-switches">
          {step.switches.map((sw) => {
            const on = Boolean(states[sw.id])
            return (
              <button
                key={sw.id}
                type="button"
                className={`p3-switch${on ? ' on' : ''}`}
                disabled={solved}
                aria-pressed={on}
                onClick={() => toggle(sw.id)}
              >
                <span className="p3-switch-track">
                  <span className="p3-switch-knob" />
                </span>
                <span className="p3-switch-label">{sw.label}</span>
              </button>
            )
          })}
        </div>
        <div className={`p3-lamp${output ? ' open' : ''}`}>
          <span className="p3-lamp-dot" />
          Output: {output ? 'OPEN' : 'LOCKED'}
        </div>
      </div>
      {erred && (
        <p className="p3-failed-move" role="alert">
          <span className="p3-failed-move-tag">Failed move</span>
          {failedMove}
        </p>
      )}
      {message && <p className={`p3-feedback ${message.tone}`}>{message.text}</p>}
      {!solved && (
        <div>
          <button type="button" className={`p3-btn ${matches ? 'success' : 'primary'}`} onClick={engage}>
            Engage relay
          </button>
        </div>
      )}
    </div>
  )
}
