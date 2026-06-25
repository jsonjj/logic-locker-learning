import { describe, it, expect } from 'vitest'
import { getNextLessonId, computeUnlocks, isLessonUnlocked } from '../logic/lessonUnlocks'

describe('getNextLessonId', () => {
  it('returns the following lesson in order', () => {
    expect(getNextLessonId('lesson-1')).toBe('lesson-2')
    expect(getNextLessonId('lesson-6')).toBe('lesson-7')
  })

  it('returns null for the final lesson', () => {
    expect(getNextLessonId('lesson-7')).toBeNull()
  })
})

describe('computeUnlocks', () => {
  it('unlocks ONLY the next lesson after completion', () => {
    const result = computeUnlocks(['lesson-1'], 'lesson-1')
    expect(result).toEqual(['lesson-1', 'lesson-2'])
    expect(result).not.toContain('lesson-3')
  })

  it('is idempotent if the next lesson is already unlocked', () => {
    const result = computeUnlocks(['lesson-1', 'lesson-2'], 'lesson-1')
    expect(result).toEqual(['lesson-1', 'lesson-2'])
  })

  it('does not add anything past the final lesson', () => {
    expect(computeUnlocks(['lesson-7'], 'lesson-7')).toEqual(['lesson-7'])
  })
})

describe('isLessonUnlocked', () => {
  it('reflects the unlocked list', () => {
    expect(isLessonUnlocked('lesson-2', ['lesson-1', 'lesson-2'])).toBe(true)
    expect(isLessonUnlocked('lesson-3', ['lesson-1', 'lesson-2'])).toBe(false)
  })
})
