import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import {
  Color,
  type AmbientLight,
  type DirectionalLight,
  type Fog,
  type HemisphereLight,
} from 'three'
import type { GameCanvasProps } from '../contracts'
import { prefersReducedMotion } from './prefersReducedMotion'
import { useQuality, reportPerfDrop, type QualityTier } from './quality'

/**
 * Root R3F canvas for the 3D prison-escape game (Agent 1).
 *
 * Provides: a renderer whose cost SCALES with the shared quality store
 * (`useQuality()`), a Rapier physics world wrapped in <Suspense>, and a
 * danger-driven atmosphere that smoothly tints the scene from a calm cool grade
 * toward an alarm-red grade as `danger` rises.
 *
 * Adaptive quality:
 *   - `dpr`, `shadows`, shadow-map size and light count all derive from the
 *     active tier (low / med / high).
 *   - drei's <AdaptiveDpr> drops resolution within the dpr bounds during
 *     momentary stalls, and <PerformanceMonitor> watches sustained FPS — a
 *     real decline calls `reportPerfDrop()` so AUTO mode steps the tier down
 *     (high -> med -> low). User-pinned tiers are left untouched by the store.
 *
 * The game animates continuously (player + enemies) so we KEEP the default
 * 'always' frameloop; `frameloop="demand"` would freeze gameplay.
 *
 * Keeps the `GameCanvasProps` contract; adds an optional `debug` toggle (default
 * off) that turns on Rapier's collider wireframes.
 */
type Props = GameCanvasProps & {
  /** Show Rapier collider wireframes for debugging. Default false. */
  debug?: boolean
}

// Palette endpoints for the atmosphere grade (calm -> alarm).
// Kept deliberately bright/legible: this is a lit INTERIOR, not a night exterior.
const FOG_CALM = '#39414f'
const FOG_ALARM = '#3a1418'
const KEY_CALM = '#fff2dc'
const KEY_ALARM = '#ff6a52'
const AMB_CALM = '#cdd8ec'
const AMB_ALARM = '#ff8f7e'

/** Shadow map resolution per tier (low never casts shadows). */
function shadowMapSize(tier: QualityTier): number {
  return tier === 'high' ? 2048 : 1024
}

/**
 * In-canvas atmosphere rig. Lives inside <Canvas> so it can hold refs to the
 * lights/fog and lerp them every frame without triggering React re-renders.
 * All Color work reuses cached instances — no per-frame allocations.
 *
 * `shadows` / `tier` are passed in (not read from the store here) so the JSX
 * stays the single source of truth and React re-mounts the light rig cleanly
 * when the tier changes.
 */
function Atmosphere({
  danger,
  shadows,
  tier,
}: {
  danger: number
  shadows: boolean
  tier: QualityTier
}) {
  const { scene } = useThree()
  const dir = useRef<DirectionalLight>(null)
  const amb = useRef<AmbientLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const fog = useRef<Fog>(null)
  const bg = useRef<Color>(null)

  // Live danger target (updated on render; smoothed in useFrame).
  const target = useRef(danger)
  target.current = danger
  const shown = useRef(danger)

  // Cached color endpoints + scratch colors (no allocations in the loop).
  const cFogA = useRef(new Color(FOG_CALM))
  const cFogB = useRef(new Color(FOG_ALARM))
  const cKeyA = useRef(new Color(KEY_CALM))
  const cKeyB = useRef(new Color(KEY_ALARM))
  const cAmbA = useRef(new Color(AMB_CALM))
  const cAmbB = useRef(new Color(AMB_ALARM))
  const scratchFog = useRef(new Color())
  const scratchKey = useRef(new Color())
  const scratchAmb = useRef(new Color())

  // On 'low' we drop the hemisphere fill light entirely — it's the cheapest to
  // lose visually and saves a light slot on weak GPUs.
  const useHemi = tier !== 'low'

  useFrame((_, delta) => {
    const reduce = prefersReducedMotion()
    // Frame-rate independent smoothing toward the target danger level.
    const a = reduce ? 1 : 1 - Math.exp(-2.5 * delta)
    shown.current += (target.current - shown.current) * a
    const d = shown.current < 0 ? 0 : shown.current > 1 ? 1 : shown.current

    const fogCol = scratchFog.current.copy(cFogA.current).lerp(cFogB.current, d)
    const keyCol = scratchKey.current.copy(cKeyA.current).lerp(cKeyB.current, d)
    const ambCol = scratchAmb.current.copy(cAmbA.current).lerp(cAmbB.current, d)

    if (bg.current) bg.current.copy(fogCol)
    if (fog.current) {
      fog.current.color.copy(fogCol)
      // Roomy fog so interiors read clearly; closes a little as tension rises.
      fog.current.near = 26 - d * 6
      fog.current.far = 130 - d * 35
    }
    if (dir.current) {
      dir.current.color.copy(keyCol)
      dir.current.intensity = 1.35 - d * 0.35
    }
    if (amb.current) {
      amb.current.color.copy(ambCol)
      // Lift ambient a touch when the hemisphere fill is off so the scene
      // doesn't go flat/dark on 'low'.
      amb.current.intensity = (useHemi ? 0.95 : 1.15) + d * 0.15
    }
    if (hemi.current) hemi.current.intensity = 0.7 - d * 0.2

    // Keep scene.fog reference fresh (drei/three reads scene.fog at render).
    if (fog.current && scene.fog !== fog.current) scene.fog = fog.current
  })

  const mapSize = shadowMapSize(tier)

  return (
    <>
      <color ref={bg} attach="background" args={[FOG_CALM]} />
      <fog ref={fog} attach="fog" args={[FOG_CALM, 26, 130]} />
      <ambientLight ref={amb} intensity={0.95} />
      {useHemi && <hemisphereLight ref={hemi} args={['#cdd8ec', '#2a2f3a', 0.7]} />}
      <directionalLight
        ref={dir}
        position={[14, 22, 10]}
        intensity={1.2}
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0005}
      />
    </>
  )
}

/** Fires onReady once after the physics world has mounted. */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    onReady?.()
  }, [onReady])
  return null
}

export default function GameCanvas({ children, danger = 0, onReady, debug = false }: Props) {
  const quality = useQuality()

  return (
    <Canvas
      shadows={quality.shadows}
      dpr={quality.dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 8, 12], fov: 55, near: 0.1, far: 200 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Drops resolution within the dpr bounds on momentary GPU stalls. */}
      <AdaptiveDpr pixelated={false} />
      {/* Watches SUSTAINED fps. A confirmed decline (after a few flip-flops)
          nudges the shared tier down via reportPerfDrop() while in auto mode;
          a hard fallback (refresh rate can't be met at all) does the same. */}
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => reportPerfDrop()}
        onFallback={() => reportPerfDrop()}
      />
      <Atmosphere danger={danger} shadows={quality.shadows} tier={quality.tier} />
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} debug={debug}>
          {children}
          <ReadySignal onReady={onReady} />
        </Physics>
      </Suspense>
    </Canvas>
  )
}
