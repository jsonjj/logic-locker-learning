import type { SwitchRule } from '../types'

/** Evaluate a switch expression (AND / OR / NOT / variable) for a given state. */
export function evaluateRule(rule: SwitchRule, state: Record<string, boolean>): boolean {
  switch (rule.kind) {
    case 'var':
      return Boolean(state[rule.id])
    case 'not':
      return !evaluateRule(rule.operand, state)
    case 'and':
      return rule.operands.every((operand) => evaluateRule(operand, state))
    case 'or':
      return rule.operands.some((operand) => evaluateRule(operand, state))
  }
}

/** The step is solved when the door's open/closed state matches the target. */
export function checkSwitches(
  rule: SwitchRule,
  state: Record<string, boolean>,
  target: boolean,
): boolean {
  return evaluateRule(rule, state) === target
}
