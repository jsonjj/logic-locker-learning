import type { GridSolution, GridSymbol } from '../types'

/** Flat key for a grid cell. */
export function cellKey(row: string, col: string): string {
  return `${row}__${col}`
}

/** Symbol the solution expects at a cell (anything unspecified is blank). */
export function expectedSymbol(solution: GridSolution, row: string, col: string): GridSymbol {
  return solution[row]?.[col] ?? 'blank'
}

export type GridState = Record<string, GridSymbol>

function symbolAt(state: GridState, row: string, col: string): GridSymbol {
  return state[cellKey(row, col)] ?? 'blank'
}

/** True only if every cell matches the solution (unspecified cells must be blank). */
export function checkGrid(
  rows: string[],
  cols: string[],
  solution: GridSolution,
  state: GridState,
): boolean {
  for (const row of rows) {
    for (const col of cols) {
      if (symbolAt(state, row, col) !== expectedSymbol(solution, row, col)) {
        return false
      }
    }
  }
  return true
}

/** Cell keys that do not match the solution (used to highlight mistakes). */
export function wrongCells(
  rows: string[],
  cols: string[],
  solution: GridSolution,
  state: GridState,
): string[] {
  const wrong: string[] = []
  for (const row of rows) {
    for (const col of cols) {
      if (symbolAt(state, row, col) !== expectedSymbol(solution, row, col)) {
        wrong.push(cellKey(row, col))
      }
    }
  }
  return wrong
}

export function checkSingleCell(expected: Exclude<GridSymbol, 'blank'>, value: GridSymbol): boolean {
  return expected === value
}

/**
 * In a one-to-one (latin square) grid, a confirmed check at (row, col) implies
 * every other cell in that row and column is impossible. Returns the cell keys
 * that "should be X" so the UI can pulse them as consequences.
 */
export function consequenceCells(
  rows: string[],
  cols: string[],
  state: GridState,
): string[] {
  const result = new Set<string>()
  for (const row of rows) {
    for (const col of cols) {
      if (symbolAt(state, row, col) === 'check') {
        for (const c of cols) {
          if (c !== col && symbolAt(state, row, c) === 'blank') result.add(cellKey(row, c))
        }
        for (const r of rows) {
          if (r !== row && symbolAt(state, r, col) === 'blank') result.add(cellKey(r, col))
        }
      }
    }
  }
  return [...result]
}
