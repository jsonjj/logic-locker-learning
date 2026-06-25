import { describe, it, expect } from 'vitest'
import { resumeIndex, nextStepId, isLastStep, addCompletedStep, stepIndex } from '../logic/progressHelpers'
import { computeStreak, todayString } from '../logic/streak'
import { getLesson } from '../data/lessons'

const lesson = getLesson('lesson-1')!

describe('progress helpers preserve current lesson and step', () => {
  it('resumes at the saved step', () => {
    const saved = lesson.steps[3].id
    expect(resumeIndex(lesson, saved)).toBe(3)
    expect(stepIndex(lesson, saved)).toBe(3)
  })

  it('falls back to the first step when the saved step is unknown', () => {
    expect(resumeIndex(lesson, 'does-not-exist')).toBe(0)
    expect(resumeIndex(lesson, undefined)).toBe(0)
  })

  it('finds the next step id and detects the last step', () => {
    expect(nextStepId(lesson, lesson.steps[0].id)).toBe(lesson.steps[1].id)
    const last = lesson.steps[lesson.steps.length - 1].id
    expect(nextStepId(lesson, last)).toBeNull()
    expect(isLastStep(lesson, last)).toBe(true)
    expect(isLastStep(lesson, lesson.steps[0].id)).toBe(false)
  })

  it('adds completed steps without duplicates', () => {
    expect(addCompletedStep(['a'], 'b')).toEqual(['a', 'b'])
    expect(addCompletedStep(['a', 'b'], 'b')).toEqual(['a', 'b'])
  })
})

describe('computeStreak', () => {
  const today = '2026-06-23'
  it('starts at 1 with no prior completion', () => {
    expect(computeStreak(0, '', today)).toBe(1)
  })
  it('stays the same when completing again on the same day', () => {
    expect(computeStreak(3, today, today)).toBe(3)
  })
  it('increments when completing on the next day', () => {
    expect(computeStreak(3, '2026-06-22', today)).toBe(4)
  })
  it('resets to 1 after a gap', () => {
    expect(computeStreak(9, '2026-06-20', today)).toBe(1)
  })
  it('todayString formats as YYYY-MM-DD', () => {
    expect(todayString(new Date(2026, 5, 9))).toBe('2026-06-09')
  })
})
