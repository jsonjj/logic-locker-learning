import { describe, it, expect } from 'vitest'
import {
  checkGrid,
  checkSingleCell,
  cellKey,
  consequenceCells,
  type GridState,
} from '../logic/gridCheckers'
import type { GridSolution } from '../types'

const rows = ['Ava', 'Ben', 'Cruz']
const cols = ['Red', 'Blue', 'Green']

const solution: GridSolution = {
  Ava: { Red: 'X', Blue: 'X', Green: 'check' },
  Ben: { Red: 'X', Blue: 'check', Green: 'X' },
  Cruz: { Red: 'check', Blue: 'X', Green: 'X' },
}

function buildState(sol: GridSolution): GridState {
  const state: GridState = {}
  for (const row of rows) {
    for (const col of cols) {
      const sym = sol[row]?.[col]
      if (sym) state[cellKey(row, col)] = sym
    }
  }
  return state
}

describe('checkGrid', () => {
  it('accepts a fully correct solved grid', () => {
    expect(checkGrid(rows, cols, solution, buildState(solution))).toBe(true)
  })

  it('rejects a grid with a wrong cell', () => {
    const wrong = buildState(solution)
    wrong[cellKey('Ava', 'Green')] = 'X' // should be check
    expect(checkGrid(rows, cols, solution, wrong)).toBe(false)
  })

  it('rejects an incomplete grid (missing marks)', () => {
    expect(checkGrid(rows, cols, solution, {})).toBe(false)
  })

  it('treats unspecified solution cells as required blank', () => {
    const partialSolution: GridSolution = { Ava: { Green: 'check' } }
    const okState: GridState = { [cellKey('Ava', 'Green')]: 'check' }
    expect(checkGrid(rows, cols, partialSolution, okState)).toBe(true)

    const extraMark: GridState = { ...okState, [cellKey('Ben', 'Red')]: 'X' }
    expect(checkGrid(rows, cols, partialSolution, extraMark)).toBe(false)
  })
})

describe('checkSingleCell', () => {
  it('matches the expected symbol', () => {
    expect(checkSingleCell('X', 'X')).toBe(true)
    expect(checkSingleCell('check', 'check')).toBe(true)
  })
  it('rejects the wrong symbol', () => {
    expect(checkSingleCell('X', 'check')).toBe(false)
    expect(checkSingleCell('check', 'blank')).toBe(false)
  })
})

describe('consequenceCells', () => {
  it('flags blank cells in the row and column of a confirmed check', () => {
    const state: GridState = { [cellKey('Ben', 'Blue')]: 'check' }
    const result = consequenceCells(rows, cols, state)
    expect(result).toContain(cellKey('Ben', 'Red'))
    expect(result).toContain(cellKey('Ava', 'Blue'))
    expect(result).toContain(cellKey('Cruz', 'Blue'))
    expect(result).not.toContain(cellKey('Ben', 'Blue'))
  })
})
