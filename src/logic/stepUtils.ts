import type { Step } from '../types'

/** Dialogue, concept, and case-summary steps have no answer; everything else is interactive. */
export function isInteractiveStep(step: Step): boolean {
  return step.type !== 'dialogue' && step.type !== 'caseSummary' && step.type !== 'concept'
}
