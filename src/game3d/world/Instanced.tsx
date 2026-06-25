import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D, type InstancedMesh, type MeshStandardMaterial } from 'three'
import { effectsAllowed } from '../engine/quality'

/**
 * [Agent 2] A single instanced box mesh used for all repeating low-poly detail
 * (cell bars, locker drawers, monitor screens, pipes, fence pickets, light
 * strips). One draw call per visual family keeps the world cheap.
 *
 * Matrices are written once in a layout effect — no per-frame allocation and no
 * work on the render loop. Callers should memoize their `instances` array so the
 * effect only re-runs when geometry actually changes.
 */
export interface BoxInstance {
  position: [number, number, number]
  /** Defaults to [1, 1, 1]. */
  scale?: [number, number, number]
  /** Y rotation in radians, defaults to 0. */
  rotationY?: number
}

/**
 * Optional shared-material emissive animation. Because every instance in a family
 * shares ONE material, this drives them all from a single per-frame scalar write
 * (no allocations, no per-instance matrix work). Disabled automatically whenever
 * `effectsAllowed()` is false (low tier / reduced motion) — the family then rests
 * at `base`, so 'low' decorations are static.
 */
export interface EmissivePulse {
  /** Resting emissive intensity (also the value used when effects are off). */
  base: number
  /** Peak deviation from base. Defaults to 0.3. */
  amp?: number
  /** Breathing speed (rad/s). Defaults to 2. */
  speed?: number
  /** Phase offset so sibling families don't pulse in lockstep. Defaults to 0. */
  phase?: number
  /** Use an irregular flicker (emergency-light feel) instead of a smooth sine. */
  flicker?: boolean
}

export interface InstancedBoxesProps {
  instances: BoxInstance[]
  color?: string
  emissive?: string
  emissiveIntensity?: number
  metalness?: number
  roughness?: number
  castShadow?: boolean
  receiveShadow?: boolean
  /** When set, breathes/flickers the shared emissive (gated by effectsAllowed). */
  pulse?: EmissivePulse
}

const UNIT: [number, number, number] = [1, 1, 1]
// Module-scoped scratch object; reused while writing matrices (effects run
// sequentially, so sharing is safe and avoids allocations).
const scratch = new Object3D()

export function InstancedBoxes({
  instances,
  color = '#3a414d',
  emissive = '#000000',
  emissiveIntensity = 0,
  metalness = 0.1,
  roughness = 0.85,
  castShadow = true,
  receiveShadow = true,
  pulse,
}: InstancedBoxesProps) {
  const ref = useRef<InstancedMesh>(null)
  const count = instances.length

  // Animate the single shared material; one scalar write per frame for the whole
  // family. Hook is always registered; it no-ops cheaply when there's no pulse.
  useFrame((state) => {
    if (!pulse) return
    const mesh = ref.current
    if (!mesh) return
    const mat = mesh.material as MeshStandardMaterial
    if (!effectsAllowed()) {
      mat.emissiveIntensity = pulse.base
      return
    }
    const amp = pulse.amp ?? 0.3
    const t = state.clock.elapsedTime
    const phase = pulse.phase ?? 0
    if (pulse.flicker) {
      const n = Math.sin(t * 37 + phase) * 0.6 + Math.sin(t * 19.3 + phase) * 0.4
      mat.emissiveIntensity = Math.max(0, pulse.base + amp * n)
    } else {
      mat.emissiveIntensity = pulse.base + Math.sin(t * (pulse.speed ?? 2) + phase) * amp
    }
  })

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i]
      scratch.position.set(inst.position[0], inst.position[1], inst.position[2])
      scratch.rotation.set(0, inst.rotationY ?? 0, 0)
      const s = inst.scale ?? UNIT
      scratch.scale.set(s[0], s[1], s[2])
      scratch.updateMatrix()
      mesh.setMatrixAt(i, scratch.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [instances])

  if (count === 0) return null

  return (
    <instancedMesh
      // Remount if the instance count changes (count is fixed at construction).
      key={count}
      ref={ref}
      args={[undefined, undefined, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={pulse ? pulse.base : emissiveIntensity}
        metalness={metalness}
        roughness={roughness}
      />
    </instancedMesh>
  )
}
