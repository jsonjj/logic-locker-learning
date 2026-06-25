import { useState } from 'react'
import type { ClueSortStep } from '../../types'

export default function ClueSortView({
  step,
  locked,
  onResult,
}: {
  step: ClueSortStep
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  // cardId -> category (or undefined if unplaced)
  const [placements, setPlacements] = useState<Record<string, string | undefined>>({})
  const [activeCard, setActiveCard] = useState<string | null>(null)
  const [dragCard, setDragCard] = useState<string | null>(null)
  const [dragOverCat, setDragOverCat] = useState<string | null>(null)
  const [evaluated, setEvaluated] = useState(false)

  const unplaced = step.cards.filter((c) => !placements[c.id])

  // Tap fallback (keyboard / touch): select a card, then choose a category.
  function selectCard(id: string) {
    if (locked) return
    setActiveCard((prev) => (prev === id ? null : id))
  }

  function placeInCategory(category: string) {
    const cardId = dragCard ?? activeCard
    if (locked || !cardId) return
    setPlacements((prev) => ({ ...prev, [cardId]: category }))
    setActiveCard(null)
    setDragCard(null)
    setDragOverCat(null)
    setEvaluated(false)
  }

  function removeFromCategory(cardId: string) {
    if (locked) return
    setPlacements((prev) => ({ ...prev, [cardId]: undefined }))
    setEvaluated(false)
  }

  function isWrong(cardId: string): boolean {
    return placements[cardId] !== step.correctAnswer[cardId]
  }

  const wrongPlacedCount = step.cards.filter((c) => placements[c.id] && isWrong(c.id)).length

  function resetWrong() {
    if (locked) return
    setPlacements((prev) => {
      const next = { ...prev }
      for (const c of step.cards) {
        if (next[c.id] && next[c.id] !== step.correctAnswer[c.id]) next[c.id] = undefined
      }
      return next
    })
    setEvaluated(false)
  }

  function cardClass(cardId: string): string {
    const classes = ['clue-card']
    if (activeCard === cardId) classes.push('active')
    if (dragCard === cardId) classes.push('dragging')
    if (evaluated) classes.push(isWrong(cardId) ? 'wrong' : 'right')
    return classes.join(' ')
  }

  const allPlaced = step.cards.every((c) => placements[c.id])

  function check() {
    const isCorrect = step.cards.every((c) => placements[c.id] === step.correctAnswer[c.id])
    setEvaluated(true)
    onResult(isCorrect, placements)
  }

  return (
    <div>
      {!locked && unplaced.length > 0 && (
        <div className="cluesort-cards">
          <div className="step-counter" style={{ marginBottom: 4 }}>
            Drag a clue into a case file — or tap a clue, then tap a file:
          </div>
          {unplaced.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cardClass(c.id)}
              draggable={!locked}
              onDragStart={() => setDragCard(c.id)}
              onDragEnd={() => {
                setDragCard(null)
                setDragOverCat(null)
              }}
              onClick={() => selectCard(c.id)}
            >
              {c.text}
            </button>
          ))}
        </div>
      )}

      <div className="categories">
        {step.categories.map((cat) => {
          const cardsHere = step.cards.filter((c) => placements[c.id] === cat)
          const isTarget = (!!activeCard || !!dragCard) && !locked
          const classes = ['category']
          if (isTarget) classes.push('targetable')
          if (dragOverCat === cat) classes.push('dragover')
          return (
            <div
              key={cat}
              className={classes.join(' ')}
              onClick={() => placeInCategory(cat)}
              onDragOver={(e) => {
                if (locked) return
                e.preventDefault()
                setDragOverCat(cat)
              }}
              onDragLeave={() => setDragOverCat((prev) => (prev === cat ? null : prev))}
              onDrop={(e) => {
                e.preventDefault()
                placeInCategory(cat)
              }}
              role={isTarget ? 'button' : undefined}
              tabIndex={isTarget ? 0 : undefined}
              aria-label={isTarget ? `Place clue in ${cat}` : undefined}
              onKeyDown={(e) => {
                if (isTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  placeInCategory(cat)
                }
              }}
            >
              <div className="category-title">{cat}</div>
              {cardsHere.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`category-chip ${
                    evaluated ? (isWrong(c.id) ? 'wrong' : 'right') : ''
                  }`}
                  draggable={!locked}
                  onDragStart={(e) => {
                    e.stopPropagation()
                    setDragCard(c.id)
                  }}
                  onDragEnd={() => {
                    setDragCard(null)
                    setDragOverCat(null)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromCategory(c.id)
                  }}
                  aria-label={`${c.text} — tap to remove from ${cat}`}
                  title="Tap to remove"
                  style={
                    evaluated
                      ? {
                          borderColor: isWrong(c.id) ? 'var(--neon-red)' : 'var(--neon-green)',
                        }
                      : undefined
                  }
                >
                  {c.text}
                </button>
              ))}
            </div>
          )
        })}
      </div>

      {!locked && (
        <div className="stack" style={{ marginTop: 14 }}>
          {evaluated && wrongPlacedCount > 0 && (
            <button type="button" className="btn btn-block" onClick={resetWrong}>
              Reset wrong clues ({wrongPlacedCount})
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={check}
            disabled={!allPlaced}
          >
            Check Case Files
          </button>
        </div>
      )}
    </div>
  )
}
