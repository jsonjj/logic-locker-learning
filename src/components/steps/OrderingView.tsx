import { useState } from 'react'
import type { OrderingStep, OrderingItem } from '../../types'

/** Produce a starting order that is not already the correct answer. */
function initialOrder(step: OrderingStep): OrderingItem[] {
  const given = step.items
  const givenIds = given.map((i) => i.id).join(',')
  const correctIds = step.correctAnswer.join(',')
  if (givenIds !== correctIds) return given
  return [...given].reverse()
}

export default function OrderingView({
  step,
  locked,
  onResult,
}: {
  step: OrderingStep
  locked: boolean
  onResult: (isCorrect: boolean, submittedValue: unknown) => void
}) {
  const [order, setOrder] = useState<OrderingItem[]>(() => initialOrder(step))
  const [evaluated, setEvaluated] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  function move(from: number, to: number) {
    if (locked || to < 0 || to >= order.length) return
    setOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setEvaluated(false)
  }

  const wrongCount = order.filter((item, i) => item.id !== step.correctAnswer[i]).length

  // Keep the steps already in the right spot, and shuffle only the wrong ones
  // back to their starting order so the student can redo just those.
  function resetWrong() {
    if (locked) return
    setOrder((prev) => {
      const start = initialOrder(step)
      const wrongSlots = prev
        .map((item, i) => (item.id === step.correctAnswer[i] ? -1 : i))
        .filter((i) => i >= 0)
      const wrongItems = wrongSlots.map((i) => prev[i])
      wrongItems.sort(
        (a, b) => start.findIndex((s) => s.id === a.id) - start.findIndex((s) => s.id === b.id),
      )
      const next = [...prev]
      wrongSlots.forEach((slot, k) => {
        next[slot] = wrongItems[k]
      })
      return next
    })
    setEvaluated(false)
  }

  function itemClass(index: number): string {
    const classes = ['order-item']
    if (locked) classes.push('right')
    else if (evaluated) classes.push(order[index].id === step.correctAnswer[index] ? 'right' : 'wrong')
    if (dragIndex === index) classes.push('dragging')
    return classes.join(' ')
  }

  function check() {
    const current = order.map((i) => i.id)
    const isCorrect = current.length === step.correctAnswer.length &&
      current.every((id, i) => id === step.correctAnswer[i])
    setEvaluated(true)
    onResult(isCorrect, current)
  }

  return (
    <div>
      <div className="order-list">
        {order.map((item, index) => (
          <div
            key={item.id}
            className={itemClass(index)}
            draggable={!locked}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, index)
              setDragIndex(null)
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <span className="order-num">{index + 1}</span>
            <span className="order-text">{item.text}</span>
            {!locked && (
              <span className="order-controls">
                <button
                  type="button"
                  className="order-btn"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="order-btn"
                  onClick={() => move(index, index + 1)}
                  disabled={index === order.length - 1}
                  aria-label="Move down"
                >
                  ▼
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      {!locked && (
        <div className="stack" style={{ marginTop: 14 }}>
          {evaluated && wrongCount > 0 && (
            <button type="button" className="btn btn-block" onClick={resetWrong}>
              Reset wrong steps ({wrongCount})
            </button>
          )}
          <button type="button" className="btn btn-primary btn-block" onClick={check}>
            Check Order
          </button>
        </div>
      )}
    </div>
  )
}
