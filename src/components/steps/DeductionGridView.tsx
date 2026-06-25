import { useState } from 'react'
import type { DeductionGridStep, GridSymbol } from '../../types'
import { cellKey, checkGrid, wrongCells, consequenceCells, type GridState } from '../../logic/gridCheckers'

const SYMBOL_DISPLAY: Record<GridSymbol, string> = { blank: '', X: '✕', check: '✓' }
const CYCLE: Record<GridSymbol, GridSymbol> = { blank: 'X', X: 'check', check: 'blank' }

export default function DeductionGridView({
  step,
  locked,
  onResult,
}: {
  step: DeductionGridStep
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  const [marks, setMarks] = useState<GridState>({})
  const [wrong, setWrong] = useState<string[]>([])

  const hints = step.showConsequences && !locked ? consequenceCells(step.rows, step.cols, marks) : []

  function cycle(row: string, col: string) {
    if (locked) return
    const key = cellKey(row, col)
    setMarks((prev) => ({ ...prev, [key]: CYCLE[prev[key] ?? 'blank'] }))
    setWrong([])
  }

  function symbolOf(row: string, col: string): GridSymbol {
    return marks[cellKey(row, col)] ?? 'blank'
  }

  function cellClass(row: string, col: string): string {
    const key = cellKey(row, col)
    const sym = symbolOf(row, col)
    const classes = ['grid-cell', `sym-${sym}`]
    if (locked) classes.push('right')
    else if (wrong.includes(key)) classes.push('wrong')
    else if (hints.includes(key)) classes.push('hint')
    return classes.join(' ')
  }

  function check() {
    const isCorrect = checkGrid(step.rows, step.cols, step.correctAnswer, marks)
    if (!isCorrect) setWrong(wrongCells(step.rows, step.cols, step.correctAnswer, marks))
    onResult(isCorrect, marks)
  }

  return (
    <div>
      {step.clues.length > 0 && (
        <div className="clue-strip">
          <span className="clue-strip-title">Clues</span>
          {step.clues.map((clue, i) => (
            <div key={i} className="clue-strip-item">
              <span className="clue-strip-dot">{i + 1}</span>
              <span>{clue}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid-wrap">
        <table className="dgrid">
          <thead>
            <tr>
              <th aria-hidden />
              {step.cols.map((col) => (
                <th key={col} className="col-head" scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {step.rows.map((row) => (
              <tr key={row}>
                <th scope="row" style={{ textAlign: 'right' }}>
                  {row}
                </th>
                {step.cols.map((col) => (
                  <td key={col}>
                    <button
                      type="button"
                      className={cellClass(row, col)}
                      onClick={() => cycle(row, col)}
                      disabled={locked}
                      aria-label={`${row} ${col}: ${symbolOf(row, col)}`}
                    >
                      {SYMBOL_DISPLAY[symbolOf(row, col)]}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint" style={{ fontSize: '0.82rem', marginTop: 0 }}>
        Tap a cell to cycle: blank &rarr; ✕ &rarr; ✓
      </p>
      {!locked && (
        <button type="button" className="btn btn-primary btn-block" onClick={check}>
          Check Grid
        </button>
      )}
    </div>
  )
}
