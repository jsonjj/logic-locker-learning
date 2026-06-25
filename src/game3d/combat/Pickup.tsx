import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import { useGameState } from '../state/GameStateContext'
import { gear } from '../systems/gear'
import { effectsAllowed } from '../engine/quality'
import { clamp01 } from './effects/shared'
import type { Vec3 } from '../contracts'

export interface PickupProps {
  /** Gear id to grant. */
  itemId: string
  position: Vec3
  onPickup: (itemId: string) => void
}

const RANGE = 1.9
const GRAB_MS = 220

/** A floating, glowing collectible. Walk into it to grab the gear. */
export default function Pickup({ itemId, position, onPickup }: PickupProps) {
  const group = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const coreMat = useRef<MeshStandardMaterial>(null)
  const ringMat = useRef<MeshStandardMaterial>(null)
  const taken = useRef(false)
  const grabAt = useRef(0)
  const [gone, setGone] = useState(false)
  const gs = useGameState()
  const item = gear(itemId)
  const color = item?.color ?? '#ffd27a'

  useFrame((stateR, delta) => {
    if (gone) return
    const fx = effectsAllowed()

    // --- Grab pop: quick scale-up + fade, then remove ----------------------
    if (taken.current) {
      const e = clamp01((performance.now() - grabAt.current) / GRAB_MS)
      if (group.current) group.current.scale.setScalar(1 + e * 0.8)
      if (coreMat.current) coreMat.current.opacity = 1 - e
      if (ringMat.current) ringMat.current.opacity = (1 - e) * 0.7
      if (e >= 1) setGone(true)
      return
    }

    // --- Idle float + spin (decorative; snaps to rest on low / reduced) -----
    if (fx) {
      const t = stateR.clock.elapsedTime
      if (group.current) group.current.position.y = position.y + 0.6 + Math.sin(t * 2) * 0.15
      if (core.current) core.current.rotation.y += delta * 1.6
    } else if (group.current) {
      group.current.position.y = position.y + 0.6
    }

    const p = gs.playerPos.current
    if (Math.hypot(p.x - position.x, p.z - position.z) < RANGE) {
      // Gameplay grant is immediate; the visual pop just plays out after.
      taken.current = true
      onPickup(itemId)
      grabAt.current = performance.now()
      if (!fx) setGone(true)
    }
  })

  if (gone) return null

  return (
    <group ref={group} position={[position.x, position.y + 0.6, position.z]}>
      <mesh ref={core} castShadow>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          ref={coreMat}
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          metalness={0.3}
          roughness={0.3}
          transparent
        />
      </mesh>
      {/* beacon light + base ring on the floor */}
      <pointLight intensity={4} distance={6} decay={2} color={color} />
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.4, 0.55, 24]} />
        <meshStandardMaterial
          ref={ringMat}
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  )
}
