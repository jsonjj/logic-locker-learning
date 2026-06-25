import type { StepVisual as StepVisualType, GridSymbol } from '../types'

const GLYPH: Record<GridSymbol, string> = { blank: '', X: '✕', check: '✓' }

function ReadOnlyGrid({
  rows,
  cols,
  marks,
  highlight,
  caption,
}: Extract<StepVisualType, { kind: 'grid' }>) {
  const highlightSet = new Set((highlight ?? []).map(([r, c]) => `${r}__${c}`))
  return (
    <div className="visual">
      <div className="grid-wrap">
        <table className="dgrid">
          <thead>
            <tr>
              <th aria-hidden />
              {cols.map((col) => (
                <th key={col} scope="col">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row" style={{ textAlign: 'right' }}>
                  {row}
                </th>
                {cols.map((col) => {
                  const sym = (marks?.[row]?.[col] ?? 'blank') as GridSymbol
                  const hl = highlightSet.has(`${row}__${col}`)
                  return (
                    <td key={col}>
                      <div
                        className={`grid-cell readonly sym-${sym} ${hl ? 'target' : ''}`}
                        aria-label={`${row} ${col}: ${sym}`}
                      >
                        {GLYPH[sym]}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <p className="visual-caption">{caption}</p>}
    </div>
  )
}

function Legend({ caption }: Extract<StepVisualType, { kind: 'legend' }>) {
  const items: { sym: GridSymbol; label: string }[] = [
    { sym: 'X', label: 'Impossible' },
    { sym: 'check', label: 'Confirmed' },
    { sym: 'blank', label: 'Unknown' },
  ]
  return (
    <div className="visual">
      <div className="symboltap-row">
        {items.map((it) => (
          <div key={it.label} className="symbol-tile">
            <span className={`symbol-glyph sym-${it.sym}`}>{GLYPH[it.sym]}</span>
            <span className="symbol-cap">{it.label}</span>
          </div>
        ))}
      </div>
      {caption && <p className="visual-caption">{caption}</p>}
    </div>
  )
}

function Clues({ title, items }: Extract<StepVisualType, { kind: 'clues' }>) {
  return (
    <div className="visual">
      {title && <div className="visual-title">{title}</div>}
      <div className="visual-clues">
        {items.map((text, i) => (
          <div key={i} className="visual-clue">
            <span className="visual-clue-num">{i + 1}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Options({ title, items }: Extract<StepVisualType, { kind: 'options' }>) {
  return (
    <div className="visual">
      {title && <div className="visual-title">{title}</div>}
      <div className="options-row">
        {items.map((opt) => {
          const mark = opt.mark ?? 'unknown'
          const glyph = mark === 'X' ? '✕' : mark === 'check' ? '✓' : '?'
          return (
            <div key={opt.label} className={`option-box mark-${mark}`}>
              <span className="option-mark">{glyph}</span>
              {opt.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Switches({ title, op, items, result }: Extract<StepVisualType, { kind: 'switches' }>) {
  return (
    <div className="visual">
      {title && <div className="visual-title">{title}</div>}
      <div className="visual-switch">
        {items.map((sw, i) => (
          <span key={sw.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {i > 0 && op && <span className="vswitch-op">{op}</span>}
            <span className={`vswitch ${sw.on ? 'on' : ''}`}>
              <span className="vswitch-led" />
              {sw.label}: {sw.on ? 'ON' : 'OFF'}
            </span>
          </span>
        ))}
        {result && (
          <>
            <span className="vswitch-op">=</span>
            <span className={`vswitch-result ${result.open ? 'open' : 'closed'}`}>
              {result.label}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default function StepVisual({ visual }: { visual: StepVisualType }) {
  switch (visual.kind) {
    case 'grid':
      return <ReadOnlyGrid {...visual} />
    case 'legend':
      return <Legend {...visual} />
    case 'clues':
      return <Clues {...visual} />
    case 'options':
      return <Options {...visual} />
    case 'switches':
      return <Switches {...visual} />
    default:
      return null
  }
}
