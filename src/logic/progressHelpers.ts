import type { Lesson } from '../types'

/** Index of a step within a lesson, or -1. */
export function stepIndex(lesson: Lesson, stepId: string): number {
  return lesson.steps.findIndex((s) => s.id === stepId)
}

/**
 * Resume index for a saved step. Falls back to 0 if the saved step is unknown,
 * so a learner always returns to a valid position (their saved step).
 */
export function resumeIndex(lesson: Lesson, savedStepId: string | undefined): number {
  if (!savedStepId) return 0
  const idx = stepIndex(lesson, savedStepId)
  return idx === -1 ? 0 : idx
}

/** The id of the step after the given one, or null if it is the last step. */
export function nextStepId(lesson: Lesson, currentStepId: string): string | null {
  const idx = stepIndex(lesson, currentStepId)
  if (idx === -1 || idx >= lesson.steps.length - 1) return null
  return lesson.steps[idx + 1].id
}

export function isLastStep(lesson: Lesson, stepId: string): boolean {
  return stepIndex(lesson, stepId) === lesson.steps.length - 1
}

/** Merge a newly completed step into the completed list without duplicates. */
export function addCompletedStep(completed: string[], stepId: string): string[] {
  return completed.includes(stepId) ? completed : [...completed, stepId]
}
