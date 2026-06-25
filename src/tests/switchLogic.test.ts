import { describe, it, expect } from 'vitest'
import { evaluateRule, checkSwitches } from '../logic/switchLogic'
import type { SwitchRule } from '../types'

const andRule: SwitchRule = {
  kind: 'and',
  operands: [
    { kind: 'var', id: 'a' },
    { kind: 'var', id: 'b' },
  ],
}

const orRule: SwitchRule = {
  kind: 'or',
  operands: [
    { kind: 'var', id: 'a' },
    { kind: 'var', id: 'b' },
  ],
}

const notRule: SwitchRule = { kind: 'not', operand: { kind: 'var', id: 'alarm' } }

const mixedRule: SwitchRule = {
  kind: 'or',
  operands: [
    { kind: 'and', operands: [{ kind: 'var', id: 'keycard' }, { kind: 'var', id: 'code' }] },
    { kind: 'var', id: 'override' },
  ],
}

describe('AND', () => {
  it('is true only when both are true', () => {
    expect(evaluateRule(andRule, { a: true, b: true })).toBe(true)
    expect(evaluateRule(andRule, { a: true, b: false })).toBe(false)
    expect(evaluateRule(andRule, { a: false, b: false })).toBe(false)
  })
})

describe('OR', () => {
  it('is true when at least one is true', () => {
    expect(evaluateRule(orRule, { a: true, b: false })).toBe(true)
    expect(evaluateRule(orRule, { a: false, b: true })).toBe(true)
    expect(evaluateRule(orRule, { a: false, b: false })).toBe(false)
  })
})

describe('NOT', () => {
  it('flips the variable', () => {
    expect(evaluateRule(notRule, { alarm: false })).toBe(true)
    expect(evaluateRule(notRule, { alarm: true })).toBe(false)
  })
})

describe('mixed (AND inside OR)', () => {
  it('opens via the AND pair', () => {
    expect(evaluateRule(mixedRule, { keycard: true, code: true, override: false })).toBe(true)
  })
  it('opens via the override alone', () => {
    expect(evaluateRule(mixedRule, { keycard: false, code: false, override: true })).toBe(true)
  })
  it('stays closed with only one of the pair and no override', () => {
    expect(evaluateRule(mixedRule, { keycard: true, code: false, override: false })).toBe(false)
  })
})

describe('checkSwitches', () => {
  it('compares the door state to the target', () => {
    expect(checkSwitches(andRule, { a: true, b: true }, true)).toBe(true)
    expect(checkSwitches(andRule, { a: true, b: false }, true)).toBe(false)
  })
})
