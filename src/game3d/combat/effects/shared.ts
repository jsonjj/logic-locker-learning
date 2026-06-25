/**
 * Shared, app-lifetime geometry singletons for combat effects.
 *
 * Reusing these unit primitives across every muzzle flash / tracer / impact /
 * shockwave instance keeps GPU buffers minimal and means spawning an effect is
 * just a cheap mesh + material — no per-spawn geometry construction, and zero
 * geometry allocation inside useFrame. Instances size themselves via `scale`.
 *
 * These live for the whole session (never disposed) on purpose: they are tiny
 * and constantly reused by pooled, short-lived effects.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
} from 'three'

/** Unit camera-facing quad (for billboarded muzzle/glow sprites). */
export const QUAD_GEO = new PlaneGeometry(1, 1)

/** Unit box, scaled into a stretched beam/tracer along local +z. */
export const BEAM_GEO = new BoxGeometry(1, 1, 1)

/** Unit sphere, scaled into impact/death flash pops. */
export const FLASH_GEO = new SphereGeometry(1, 16, 16)

/** Unit flat ring, scaled into expanding shockwave rings. */
export const RING_GEO = new RingGeometry(0.72, 1, 48)

/** Half-ring arc for melee swing flourishes. */
export const ARC_GEO = new RingGeometry(0.45, 1, 20, 1, 0, Math.PI)

/** Re-exported so effect materials can opt into additive (glow) blending. */
export const ADDITIVE = AdditiveBlending

/** Clamp a normalized life value to [0,1]. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
