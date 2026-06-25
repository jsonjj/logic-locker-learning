/**
 * Module-level SCREEN SHAKE bus (arcade combat juice).
 *
 * Decoupled on purpose: weapon fire / impacts call `triggerShake(strength)` from
 * anywhere (inside or outside the R3F tree) and the follow camera in
 * ThirdPersonPlayer drains a decaying offset every frame via `getShakeOffset(dt)`.
 *
 * Uses a "trauma" model (Squirrel Eiserloh): callers ADD trauma, the value decays
 * linearly, and the applied magnitude is trauma² so light hits barely nudge while
 * big AoE detonations kick hard. Output is written into a single reused object so
 * the per-frame camera consumer never allocates.
 *
 * Everything is gated on `shakeAllowed()` (which already folds in the
 * reduced-motion check + 'low' tier), so on weak devices this no-ops cleanly:
 * triggers are ignored and the offset is a frozen zero vector.
 */
import { shakeAllowed } from '../../engine/quality'

/** Trauma drained per second — controls how quickly a shake settles. */
const DECAY = 1.9
/** Peak positional offset (metres) at full trauma. */
const MAX_POS = 0.55

let trauma = 0

// Reused output — never reallocated, safe to read every frame.
const offset = { x: 0, y: 0, z: 0 }

function zero(): typeof offset {
  offset.x = 0
  offset.y = 0
  offset.z = 0
  return offset
}

/**
 * Add a shake impulse. `strength` is roughly 0..1 (a light shot ~0.15, a melee
 * hit ~0.25, the Breach Cannon AoE ~0.6). No-ops when shake is disallowed.
 */
export function triggerShake(strength = 0.3): void {
  if (!shakeAllowed()) return
  trauma = Math.min(1, trauma + Math.max(0, strength))
}

/**
 * Advance + sample the current shake offset. Call once per frame from the camera
 * rig. Returns a shared object (do not retain/mutate). When shake is disallowed
 * the trauma is discarded and a zero offset is returned, so motion snaps off.
 */
export function getShakeOffset(dt: number): { x: number; y: number; z: number } {
  if (!shakeAllowed()) {
    if (trauma !== 0) trauma = 0
    return zero()
  }
  if (trauma <= 0) return zero()

  trauma = Math.max(0, trauma - DECAY * dt)
  const mag = trauma * trauma * MAX_POS
  offset.x = (Math.random() * 2 - 1) * mag
  offset.y = (Math.random() * 2 - 1) * mag * 0.7
  offset.z = (Math.random() * 2 - 1) * mag
  return offset
}

/** Hard-clear any in-flight shake (e.g. on scene teardown). */
export function resetShake(): void {
  trauma = 0
  zero()
}
