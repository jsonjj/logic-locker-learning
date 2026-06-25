/**
 * Logic Locker — shared graphics QUALITY + motion store.
 *
 * This is the foundation the animation/optimization features gate on so the
 * game stays smooth on weak devices and respects reduced-motion.
 *
 * Implemented as a dependency-free EXTERNAL STORE (useSyncExternalStore) rather
 * than React context on purpose: react-three-fiber renders into its own
 * reconciler, so DOM-tree context does NOT automatically reach components inside
 * <Canvas>. A module-level store works identically inside and outside the canvas
 * and can be read cheaply from `useFrame` loops via `qualitySettings()`.
 *
 * Usage:
 *   const q = useQuality()                 // reactive, in DOM or in <Canvas>
 *   if (effectsAllowed()) spawnSparks()    // cheap per-frame gate (no hook)
 *   setQualityTier('low'); setQualityAuto(true)
 */
import { useSyncExternalStore } from 'react'
import { prefersReducedMotion } from './prefersReducedMotion'

export type QualityTier = 'low' | 'med' | 'high'

export interface QualitySettings {
  tier: QualityTier
  /** When true, the tier is auto-detected from the device; false = user override. */
  auto: boolean
  /** Renderer device-pixel-ratio clamp [min, max]. */
  dpr: [number, number]
  /** Whether shadow maps are enabled. */
  shadows: boolean
  /** Soft budget for dynamic lights/expensive effects. */
  maxLights: number
  /** Whether decorative particle/juice effects should render. */
  effects: boolean
  /** Whether camera/screen shake is allowed. */
  shake: boolean
}

const STORAGE_KEY = 'll-quality-v1'

/** Map a tier to concrete renderer settings. */
export function deriveSettings(tier: QualityTier, auto: boolean): QualitySettings {
  switch (tier) {
    case 'low':
      return { tier, auto, dpr: [0.6, 1], shadows: false, maxLights: 1, effects: false, shake: false }
    case 'med':
      return { tier, auto, dpr: [1, 1.25], shadows: true, maxLights: 2, effects: true, shake: true }
    case 'high':
    default:
      return { tier: 'high', auto, dpr: [1, 1.75], shadows: true, maxLights: 4, effects: true, shake: true }
  }
}

/** Best-effort device capability sniff -> starting tier. */
export function detectTier(): QualityTier {
  if (typeof navigator === 'undefined') return 'high'
  const ua = navigator.userAgent || ''
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  const cores = navigator.hardwareConcurrency ?? 4
  // deviceMemory is not in all TS libs; read defensively.
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  if (prefersReducedMotion()) return 'low'
  if (isMobile) {
    if (cores <= 4 || mem <= 3) return 'low'
    return 'med'
  }
  if (cores <= 2 || mem <= 2) return 'low'
  if (cores <= 4 || mem <= 4) return 'med'
  return 'high'
}

function loadInitial(): QualitySettings {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { tier?: QualityTier; auto?: boolean }
        if (parsed.auto === false && parsed.tier) return deriveSettings(parsed.tier, false)
      }
    } catch {
      // ignore corrupt storage
    }
  }
  return deriveSettings(detectTier(), true)
}

let current: QualitySettings = loadInitial()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tier: current.tier, auto: current.auto }))
  } catch {
    // ignore
  }
}

/** Non-reactive snapshot — safe to call inside useFrame loops. */
export function qualitySettings(): QualitySettings {
  return current
}

/** True when decorative effects should render right now (respects reduced-motion). */
export function effectsAllowed(): boolean {
  return current.effects && !prefersReducedMotion()
}

/** True when screen/camera shake is allowed right now. */
export function shakeAllowed(): boolean {
  return current.shake && !prefersReducedMotion()
}

/** Force a specific tier (turns off auto). */
export function setQualityTier(tier: QualityTier): void {
  current = deriveSettings(tier, false)
  persist()
  emit()
}

/** Toggle auto-detect. When enabled, re-detects immediately. */
export function setQualityAuto(auto: boolean): void {
  current = auto ? deriveSettings(detectTier(), true) : deriveSettings(current.tier, false)
  persist()
  emit()
}

/** Let the adaptive monitor nudge the tier DOWN at runtime (only while auto). */
export function reportPerfDrop(): void {
  if (!current.auto) return
  const next: QualityTier = current.tier === 'high' ? 'med' : 'low'
  if (next !== current.tier) {
    current = deriveSettings(next, true)
    emit()
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Reactive hook — works in the DOM tree AND inside <Canvas>. */
export function useQuality(): QualitySettings {
  return useSyncExternalStore(subscribe, qualitySettings, qualitySettings)
}
