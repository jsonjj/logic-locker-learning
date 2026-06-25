/**
 * Pooled, bounded WEAPON juice for the arcade combat layer.
 *
 * One small union of short-lived effects (muzzle flash, tracer beam, impact
 * burst, AoE shockwave, melee arc) plus a `useFxPool` hook that both the
 * single-player WeaponController and the multiplayer MpWeapon use. The pool:
 *   - is capped (oldest dropped past `cap`) so particle count stays bounded,
 *   - no-ops `spawn()` entirely when `effectsAllowed()` is false (low tier /
 *     reduced motion), so nothing is created and there is nothing to render,
 *   - prunes by wall-clock TTL each frame, returning the SAME array reference
 *     when nothing expired so it never forces a re-render.
 *
 * Each effect self-animates from its `born` timestamp by mutating refs only —
 * no allocations inside useFrame — and every instance reuses the shared unit
 * geometries from ./shared.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import type { Group, MeshBasicMaterial } from 'three'
import { effectsAllowed } from '../../engine/quality'
import { ADDITIVE, ARC_GEO, BEAM_GEO, clamp01, FLASH_GEO, QUAD_GEO, RING_GEO } from './shared'

type Vec3T = [number, number, number]

export type WeaponFxKind = 'muzzle' | 'tracer' | 'impact' | 'shockwave' | 'melee'

export interface WeaponFx {
  id: number
  born: number
  /** Lifetime in ms. */
  ttl: number
  kind: WeaponFxKind
  /** Anchor point (muzzle for 'muzzle'/'tracer' origin, hit point otherwise). */
  pos: Vec3T
  /** End point for beams; ignored by point effects. */
  to?: Vec3T
  color: string
  /** Blast radius (world units) for shockwaves. */
  radius?: number
  /** Beam thickness for tracers. */
  thickness?: number
}

type SpawnInput = Omit<WeaponFx, 'id' | 'born'>

export interface FxPool {
  items: WeaponFx[]
  /** Spawn an effect. No-ops when effects are disallowed. */
  spawn: (fx: SpawnInput) => void
  /** Drop expired effects. Call once per frame; cheap + re-render-safe. */
  prune: () => void
}

/** Bounded effect pool shared by the weapon controllers. */
export function useFxPool(cap = 14): FxPool {
  const [items, setItems] = useState<WeaponFx[]>([])
  const idRef = useRef(0)

  const spawn = useCallback(
    (fx: SpawnInput) => {
      if (!effectsAllowed()) return
      const born = performance.now()
      const id = (idRef.current += 1)
      setItems((prev) => {
        const base = prev.length >= cap ? prev.slice(prev.length - cap + 1) : prev
        return [...base, { ...fx, id, born }]
      })
    },
    [cap],
  )

  const prune = useCallback(() => {
    const now = performance.now()
    setItems((prev) => {
      let expired = false
      for (let i = 0; i < prev.length; i++) {
        if (now >= prev[i].born + prev[i].ttl) {
          expired = true
          break
        }
      }
      if (!expired) return prev
      return prev.filter((it) => now < it.born + it.ttl)
    })
  }, [])

  return { items, spawn, prune }
}

/** Render the whole pool. Pure presentation; safe to mount when empty. */
export function WeaponFxLayer({ pool }: { pool: WeaponFx[] }) {
  if (pool.length === 0) return null
  return (
    <>
      {pool.map((fx) => {
        switch (fx.kind) {
          case 'muzzle':
            return <MuzzleFlash key={fx.id} pos={fx.pos} color={fx.color} born={fx.born} ttl={fx.ttl} />
          case 'tracer':
            return (
              <Tracer
                key={fx.id}
                from={fx.pos}
                to={fx.to ?? fx.pos}
                color={fx.color}
                born={fx.born}
                ttl={fx.ttl}
                thickness={fx.thickness ?? 0.12}
              />
            )
          case 'impact':
            return <ImpactBurst key={fx.id} pos={fx.pos} color={fx.color} born={fx.born} ttl={fx.ttl} />
          case 'shockwave':
            return (
              <Shockwave
                key={fx.id}
                pos={fx.pos}
                color={fx.color}
                born={fx.born}
                ttl={fx.ttl}
                radius={fx.radius ?? 4}
              />
            )
          case 'melee':
            return <MeleeArc key={fx.id} pos={fx.pos} color={fx.color} born={fx.born} ttl={fx.ttl} />
          default:
            return null
        }
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Individual effects — each animates by mutating refs from its `born` stamp.
// ---------------------------------------------------------------------------

interface PointFx {
  pos: Vec3T
  color: string
  born: number
  ttl: number
}

/** Brief additive billboarded pop at the muzzle on fire. */
function MuzzleFlash({ pos, color, born, ttl }: PointFx) {
  const grp = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const e = clamp01((performance.now() - born) / ttl)
    if (grp.current) grp.current.scale.setScalar(0.35 + e * 0.85)
    if (mat.current) mat.current.opacity = (1 - e) * 0.95
  })

  return (
    <Billboard position={pos}>
      <group ref={grp}>
        <mesh geometry={QUAD_GEO}>
          <meshBasicMaterial
            ref={mat}
            color={color}
            transparent
            opacity={0.95}
            blending={ADDITIVE}
            depthWrite={false}
          />
        </mesh>
      </group>
    </Billboard>
  )
}

/** A stretched, fading emissive beam — the projectile trail. */
function Tracer({
  from,
  to,
  color,
  born,
  ttl,
  thickness,
}: {
  from: Vec3T
  to: Vec3T
  color: string
  born: number
  ttl: number
  thickness: number
}) {
  const grp = useRef<Group>(null)
  const headMat = useRef<MeshBasicMaterial>(null)
  const beamMat = useRef<MeshBasicMaterial>(null)

  // Planar orientation (combat is near-horizontal); computed once per spawn.
  const { angle, len } = useMemo(() => {
    const dx = to[0] - from[0]
    const dz = to[2] - from[2]
    return { angle: Math.atan2(dx, dz), len: Math.max(0.01, Math.hypot(dx, dz)) }
  }, [from, to])

  useFrame(() => {
    const e = clamp01((performance.now() - born) / ttl)
    if (grp.current) {
      const w = 1 - e * 0.55
      grp.current.scale.x = w
      grp.current.scale.y = w
    }
    if (beamMat.current) beamMat.current.opacity = (1 - e) * 0.9
    if (headMat.current) headMat.current.opacity = 1 - e
  })

  return (
    <group position={[from[0], from[1], from[2]]} rotation={[0, angle, 0]}>
      <group ref={grp}>
        <mesh position={[0, 0, len / 2]} geometry={BEAM_GEO} scale={[thickness, thickness, len]}>
          <meshBasicMaterial
            ref={beamMat}
            color={color}
            transparent
            opacity={0.9}
            blending={ADDITIVE}
            depthWrite={false}
          />
        </mesh>
      </group>
      {/* Bright leading head at the impact end. */}
      <mesh position={[0, 0, len]} geometry={FLASH_GEO} scale={thickness * 1.6}>
        <meshBasicMaterial
          ref={headMat}
          color={color}
          transparent
          opacity={1}
          blending={ADDITIVE}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/** Expanding sphere + ground ring when a shot connects with an enemy. */
function ImpactBurst({ pos, color, born, ttl }: PointFx) {
  const core = useRef<Group>(null)
  const ring = useRef<Group>(null)
  const coreMat = useRef<MeshBasicMaterial>(null)
  const ringMat = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const e = clamp01((performance.now() - born) / ttl)
    const pop = 0.18 + e * 0.55
    if (core.current) core.current.scale.setScalar(pop)
    if (coreMat.current) coreMat.current.opacity = (1 - e) * 0.9
    if (ring.current) ring.current.scale.setScalar(0.3 + e * 1.4)
    if (ringMat.current) ringMat.current.opacity = (1 - e) * 0.8
  })

  return (
    <group position={pos}>
      <group ref={core}>
        <mesh geometry={FLASH_GEO}>
          <meshBasicMaterial
            ref={coreMat}
            color={color}
            transparent
            opacity={0.9}
            blending={ADDITIVE}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={RING_GEO}>
          <meshBasicMaterial
            ref={ringMat}
            color={color}
            transparent
            opacity={0.8}
            blending={ADDITIVE}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Big expanding ground shockwave + dome flash for the AoE finale cannon. */
function Shockwave({ pos, color, born, ttl, radius }: PointFx & { radius: number }) {
  const ring = useRef<Group>(null)
  const dome = useRef<Group>(null)
  const ringMat = useRef<MeshBasicMaterial>(null)
  const domeMat = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const e = clamp01((performance.now() - born) / ttl)
    // Ease-out expansion so the ring snaps out then settles at the blast radius.
    const grow = 1 - (1 - e) * (1 - e)
    if (ring.current) ring.current.scale.setScalar(0.25 + grow * radius)
    if (ringMat.current) ringMat.current.opacity = (1 - e) * 0.85
    if (dome.current) dome.current.scale.setScalar((0.4 + grow * 0.7) * radius * 0.5)
    if (domeMat.current) domeMat.current.opacity = (1 - e) * 0.4
  })

  return (
    <group position={[pos[0], 0.12, pos[2]]}>
      <group ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={RING_GEO}>
          <meshBasicMaterial
            ref={ringMat}
            color={color}
            transparent
            opacity={0.85}
            blending={ADDITIVE}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={dome} position={[0, 0.4, 0]}>
        <mesh geometry={FLASH_GEO}>
          <meshBasicMaterial
            ref={domeMat}
            color={color}
            transparent
            opacity={0.4}
            blending={ADDITIVE}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Quick emissive swing arc for melee strikes. */
function MeleeArc({ pos, color, born, ttl }: PointFx) {
  const grp = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)

  useFrame(() => {
    const e = clamp01((performance.now() - born) / ttl)
    if (grp.current) grp.current.scale.setScalar(0.6 + e * 0.8)
    if (mat.current) mat.current.opacity = (1 - e) * 0.85
  })

  return (
    <group ref={grp} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={ARC_GEO}>
        <meshBasicMaterial
          ref={mat}
          color={color}
          transparent
          opacity={0.85}
          blending={ADDITIVE}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
