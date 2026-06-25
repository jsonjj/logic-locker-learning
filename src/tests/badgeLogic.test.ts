import { describe, it, expect } from 'vitest'
import { calculateBadge, determineEarnedBadge } from '../logic/badgeLogic'

describe('calculateBadge', () => {
  it('returns gold for 0-1 mistakes', () => {
    expect(calculateBadge(0)).toBe('gold')
    expect(calculateBadge(1)).toBe('gold')
  })

  it('returns silver for 2-4 mistakes', () => {
    expect(calculateBadge(2)).toBe('silver')
    expect(calculateBadge(3)).toBe('silver')
    expect(calculateBadge(4)).toBe('silver')
  })

  it('returns bronze for 5+ mistakes', () => {
    expect(calculateBadge(5)).toBe('bronze')
    expect(calculateBadge(9)).toBe('bronze')
  })
})

describe('determineEarnedBadge', () => {
  it('uses the mistake-based badge when no round failure happened', () => {
    expect(determineEarnedBadge(0, false)).toBe('gold')
    expect(determineEarnedBadge(3, false)).toBe('silver')
    expect(determineEarnedBadge(6, false)).toBe('bronze')
  })

  it('returns the retry badge after a round failure', () => {
    expect(determineEarnedBadge(8, true)).toBe('retry')
    expect(determineEarnedBadge(0, true)).toBe('retry')
  })
})
