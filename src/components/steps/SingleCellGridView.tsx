import { useState } from 'react'
import type { SingleCellGridStep, GridSymbol } from '../../types'
import { cellKey, checkSingleCell } from '../../logic/gridCheckers'

const SYMBOL_DISPLAY: Record<GridSymbol, string> = { blank: '', X: '✕', check: '✓' }
const CYCLE: Record<GridSymbol, GridSymbol> = { blank: 'X', X: 'check', check: 'blank' }

export default function SingleCellGridView({
  step,
  locked,
  onResult,
}: {
  step: SingleCellGridStep
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  const targetKey = cellKey(step.targetRow, step.targetCol)
  const [value, setValue] = useState<GridSymbol>('blank')
  const [evaluated, setEvaluated] = useState(false)

  function isTarget(row: string, col: string) {
    return cellKey(row, col) === targetKey
  }

  function cycle(row: string, col: string) {
    if (locked || !isTarget(row, col)) return
    setValue((prev) => CYCLE[prev])
    setEvaluated(false)
  }

  function cellClass(row: string, col: string): string {
    if (!isTarget(row, col)) return 'grid-cell'
    const sym = locked ? step.correctAnswer : value
    const classes = ['grid-cell', `sym-${sym}`, 'target']
    if (locked) classes.push('right')
    else if (evaluated) classes.push(value === step.correctAnswer ? 'right' : 'wrong')
    return classes.join(' ')
  }

  function displaySymbol(row: string, col: string): string {
    if (!isTarget(row, col)) return ''
    return SYMBOL_DISPLAY[locked ? step.correctAnswer : value]
  }

  function check() {
    const isCorrect = checkSingleCell(step.correctAnswer, value)
    setEvaluated(true)
    onResult(isCorrect, value)
  }

  return (
    <div>
      {step.clues && step.clues.length > 0 && (
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
                      disabled={locked || !isTarget(row, col)}
                      aria-label={`${row} ${col}`}
                    >
                      {displaySymbol(row, col)}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint" style={{ fontSize: '0.82rem', marginTop: 0 }}>
        Tap the highlighted cell to set its symbol: blank &rarr; ✕ &rarr; ✓
      </p>
      {!locked && (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={check}
          disabled={value === 'blank'}
        >
          Check
        </button>
      )}
    </div>
  )
}
