/**
 * Module-level FOV "punch" bus (camera juice sibling to ./shake).
 *
 * Weapons call `kickFov(strength)` whenever a shot ACTUALLY fires (respecting
 * cooldown), from any input path — keyboard, pointer, or the HUD fire button —
 * so the camera reacts consistently. The follow camera drains the accumulated
 * kick once per frame via `drainFovKick()` and animates a brief additive zoom
 * that recovers to the base FOV.
 *
 * Gated on `effectsAllowed()` (folds in reduced-motion + 'low' tier): when
 * effects are off, kicks are dropped and there is nothing to drain, so the FOV
 * stays pinned at its base value.
 */
import { effectsAllowed } from '../../engine/quality'

let pending = 0

/** Queue an FOV kick (~0.5 light, 1 normal, 1.4 AoE). No-ops when disallowed. */
export function kickFov(strength = 1): void {
  if (!effectsAllowed()) return
  pending += Math.max(0, strength)
}

/** Consume + clear the queued kick. Call once per frame from the camera rig. */
export function drainFovKick(): number {
  const v = pending
  pending = 0
  return v
}

/** Discard any queued kick (scene teardown). */
export function resetFovKick(): void {
  pending = 0
}
