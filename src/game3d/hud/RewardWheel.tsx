import { useEffect, useRef, useState } from 'react'
import type { GearItem } from '../systems/gear'
import { effectsAllowed, useQuality } from '../engine/quality'
import '../../styles/reward-wheel.css'
import '../../styles/animations.css'

interface RewardWheelProps {
  segments: GearItem[]
  winnerIndex: number
  /** Fires once when the spin lands (grant the item here). */
  onResult: (item: GearItem) => void
  /** Dismiss the wheel. */
  onClose: () => void
}

const SPINS = 6
const SIZE = 260
const RADIUS = 86
// Snappier than a slow casino spin: a tight, well-eased ~2.6s drop into place.
const DURATION_MS = 2600
// A punchy ease that whips out of the gate and decelerates hard onto the winner.
const SPIN_EASE = 'cubic-bezier(0.16, 0.84, 0.12, 1)'

/**
 * A spinning prize wheel shown on a single-player room clear. Lands on a
 * pre-chosen (performance-weighted) segment, then reveals the upgrade you earned.
 */
export default function RewardWheel({ segments, winnerIndex, onResult, onClose }: RewardWheelProps) {
  const n = Math.max(1, segments.length)
  const seg = 360 / n
  const [rotation, setRotation] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const fired = useRef(false)
  useQuality()
  const animate = effectsAllowed()

  // Kick off the spin on mount.
  useEffect(() => {
    const center = winnerIndex * seg + seg / 2
    // Snap straight to the winner when motion is disabled (reduced-motion / low tier).
    if (!animate) {
      setRotation(360 - center)
      finish()
      return
    }
    const final = 360 * SPINS + (360 - center)
    const raf = requestAnimationFrame(() => setRotation(final))
    const timer = setTimeout(() => finish(), DURATION_MS + 120)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish() {
    if (fired.current) return
    fired.current = true
    setRevealed(true)
    onResult(segments[winnerIndex])
  }

  const gradient = `conic-gradient(${segments
    .map((s, i) => `${tint(s.color, i)} ${i * seg}deg ${(i + 1) * seg}deg`)
    .join(', ')})`

  const winner = segments[winnerIndex]

  return (
    <div className="reward-wheel-overlay">
      <div className="reward-wheel-card">
        <h2 className="reward-wheel-title">{revealed ? 'Upgrade earned!' : 'Spinning for your upgrade…'}</h2>

        <div className="reward-wheel-stage" style={{ width: SIZE, height: SIZE }}>
          {revealed && animate && <div className="reward-wheel-flash" aria-hidden />}
          <div className="reward-wheel-pointer" aria-hidden />
          <div
            className="reward-wheel"
            style={{
              width: SIZE,
              height: SIZE,
              background: gradient,
              transform: `rotate(${rotation}deg)`,
              transition: animate ? `transform ${DURATION_MS}ms ${SPIN_EASE}` : 'none',
            }}
            onTransitionEnd={finish}
          >
            {segments.map((s, i) => {
              const center = i * seg + seg / 2
              return (
                <span
                  key={s.id}
                  className="reward-wheel-icon"
                  style={{
                    transform: `translate(-50%, -50%) rotate(${center}deg) translateY(-${RADIUS}px) rotate(${-center}deg)`,
                  }}
                >
                  {s.icon}
                </span>
              )
            })}
          </div>
        </div>

        {revealed && winner && (
          <div className="reward-wheel-result">
            <div className="reward-wheel-result-icon">{winner.icon}</div>
            <div className="reward-wheel-result-name">{winner.name}</div>
            <div className="reward-wheel-result-desc">{winner.desc}</div>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Claim &amp; continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Slightly alternate brightness per segment so wedges read apart. */
function tint(color: string, i: number): string {
  return i % 2 === 0 ? color : shade(color, -18)
}

function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(parseInt(m[1], 16) + amt)
  const g = clamp(parseInt(m[2], 16) + amt)
  const b = clamp(parseInt(m[3], 16) + amt)
  return `rgb(${r}, ${g}, ${b})`
}
