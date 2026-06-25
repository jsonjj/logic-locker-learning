import { createContext, useContext, useRef, type MutableRefObject, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group } from 'three'
import Character from '../character/Character'

/* ============================================================================
   Cutscene primitives — a lightweight, physics-free scripting layer.

   Cutscenes reuse the game's low-poly Character so they "look like the game,"
   but run on a plain Canvas (no Rapier) where every actor and the camera is a
   pure function of scene time t (seconds since the scene started). This keeps
   the scenes deterministic, cheap, and easy to author.
   ========================================================================== */

// --- Scene clock (provided INSIDE the Canvas so r3f children can read it) ---
const StartCtx = createContext<MutableRefObject<number | null> | null>(null)

export function SceneClock({ children }: { children: ReactNode }) {
  const startRef = useRef<number | null>(null)
  return <StartCtx.Provider value={startRef}>{children}</StartCtx.Provider>
}

/** Returns a mapper from the global clock time to seconds-since-scene-start. */
export function useSceneT(): (clockT: number) => number {
  const ref = useContext(StartCtx)
  return (clockT: number) => {
    if (!ref) return clockT
    if (ref.current == null) ref.current = clockT
    return clockT - ref.current
  }
}

// --- Math helpers ----------------------------------------------------------
export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (t: number) => {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}
/** Eased progress (0..1) of t across the [t0, t1] window. */
export const seg = (t: number, t0: number, t1: number) => smooth((t - t0) / Math.max(0.0001, t1 - t0))

export type V3 = [number, number, number]
export const v3lerp = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]

// --- Director camera -------------------------------------------------------
export function DirectorCamera({
  track,
}: {
  track: (t: number) => { pos: V3; look: V3 }
}) {
  const { camera } = useThree()
  const getT = useSceneT()
  useFrame((state) => {
    const t = getT(state.clock.elapsedTime)
    const { pos, look } = track(t)
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(look[0], look[1], look[2])
  })
  return null
}

// --- Generic scripted actor ------------------------------------------------
export function Actor({
  pos,
  yaw,
  visible,
  children,
}: {
  pos: (t: number) => V3
  yaw?: (t: number) => number
  visible?: (t: number) => boolean
  children: ReactNode
}) {
  const g = useRef<Group>(null)
  const getT = useSceneT()
  useFrame((state) => {
    const node = g.current
    if (!node) return
    const t = getT(state.clock.elapsedTime)
    const p = pos(t)
    node.position.set(p[0], p[1], p[2])
    if (yaw) node.rotation.y = yaw(t)
    node.visible = visible ? visible(t) : true
  })
  return <group ref={g}>{children}</group>
}

// --- Character-based runner (hero / Akash / freed inmates) ------------------
export function Runner({
  pos,
  yaw,
  visible,
  color = '#e0892f',
  scale = 1,
  running = true,
}: {
  pos: (t: number) => V3
  yaw?: (t: number) => number
  visible?: (t: number) => boolean
  color?: string
  scale?: number
  running?: boolean
}) {
  return (
    <Actor pos={pos} yaw={yaw} visible={visible}>
      <Character moving={running} color={color} scale={scale} />
    </Actor>
  )
}

// --- Enemy guard (matches the in-game guard aesthetic, sans physics) -------
export function Guard({
  pos,
  yaw,
  visible,
  scale = 1,
  ranged = false,
}: {
  pos: (t: number) => V3
  yaw?: (t: number) => number
  visible?: (t: number) => boolean
  scale?: number
  ranged?: boolean
}) {
  const bodyColor = ranged ? '#2a1f10' : '#3a1620'
  const glow = ranged ? '#ff9a3d' : '#ff3b2f'
  return (
    <Actor pos={pos} yaw={yaw} visible={visible}>
      <group scale={scale}>
        <mesh position={[0, 1, 0]} castShadow>
          <capsuleGeometry args={[0.42, 0.9, 6, 12]} />
          <meshStandardMaterial color={bodyColor} metalness={0.2} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.85, 0]} castShadow>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshStandardMaterial color="#1c1014" />
        </mesh>
        <mesh position={[0, 1.88, 0.27]}>
          <boxGeometry args={[0.34, 0.1, 0.08]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={2.4} />
        </mesh>
        {ranged && (
          <mesh position={[0.3, 1.05, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.7, 8]} />
            <meshStandardMaterial color="#444c58" metalness={0.5} roughness={0.4} />
          </mesh>
        )}
      </group>
    </Actor>
  )
}

// --- The Warden: a taller, armored, menacing guard with a cape -------------
export function Warden({
  pos,
  yaw,
  visible,
}: {
  pos: (t: number) => V3
  yaw?: (t: number) => number
  visible?: (t: number) => boolean
}) {
  return (
    <Actor pos={pos} yaw={yaw} visible={visible}>
      <group scale={1.25}>
        {/* Heavy armored torso. */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.46, 1.0, 6, 12]} />
          <meshStandardMaterial color="#15171d" metalness={0.55} roughness={0.45} />
        </mesh>
        {/* Shoulder pauldrons. */}
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 1.5, 0]} castShadow>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#23262e" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        {/* Cape. */}
        <mesh position={[0, 1.0, -0.32]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[0.9, 1.5, 0.06]} />
          <meshStandardMaterial color="#3a0d10" roughness={0.9} />
        </mesh>
        {/* Head + cold visor. */}
        <mesh position={[0, 1.95, 0]} castShadow>
          <sphereGeometry args={[0.34, 16, 16]} />
          <meshStandardMaterial color="#0e0f13" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.98, 0.3]}>
          <boxGeometry args={[0.4, 0.09, 0.08]} />
          <meshStandardMaterial color="#ff2d2d" emissive="#ff2d2d" emissiveIntensity={3} />
        </mesh>
        {/* Baton. */}
        <mesh position={[0.52, 0.95, 0.2]} rotation={[Math.PI / 2.4, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
          <meshStandardMaterial color="#5a6270" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </Actor>
  )
}

// --- Environments ----------------------------------------------------------
/** Interior cell block: floor, barred back wall, side walls, ceiling strips. */
export function PrisonSet({ alarm = false }: { alarm?: boolean }) {
  const wall = '#23272f'
  const bar = alarm ? '#ff5a48' : '#7f8a9c'
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#14161b" roughness={0.95} />
      </mesh>
      {/* Back wall. */}
      <mesh position={[0, 3, -10]} receiveShadow>
        <boxGeometry args={[40, 6, 0.6]} />
        <meshStandardMaterial color={wall} metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Cell bars along the back wall. */}
      {Array.from({ length: 19 }, (_, i) => -18 + i * 2).map((x) => (
        <mesh key={x} position={[x, 2.3, -9.5]}>
          <cylinderGeometry args={[0.06, 0.06, 4.4, 8]} />
          <meshStandardMaterial
            color={bar}
            emissive={alarm ? '#ff2d2d' : '#000000'}
            emissiveIntensity={alarm ? 0.6 : 0}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      ))}
      {/* Side walls. */}
      {[-20, 20].map((x) => (
        <mesh key={x} position={[x, 3, 0]}>
          <boxGeometry args={[0.6, 6, 40]} />
          <meshStandardMaterial color={wall} metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
      {/* Ceiling light strips. */}
      {[-8, 0, 8].map((z) => (
        <mesh key={z} position={[0, 5.8, z]}>
          <boxGeometry args={[8, 0.1, 0.5]} />
          <meshStandardMaterial
            color={alarm ? '#ff8a7a' : '#fff3d8'}
            emissive={alarm ? '#ff5a48' : '#fff3d8'}
            emissiveIntensity={alarm ? 2.2 : 1.4}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Exterior prison yard at night: ground, perimeter wall, an open gate. */
export function EscapeYard({ gateOpen = true }: { gateOpen?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0e1117" roughness={1} />
      </mesh>
      {/* Perimeter wall far behind with a gate gap. */}
      {[-12, 12].map((x) => (
        <mesh key={x} position={[x, 3.5, -14]} castShadow>
          <boxGeometry args={[18, 7, 1]} />
          <meshStandardMaterial color="#1b1f27" metalness={0.3} roughness={0.8} />
        </mesh>
      ))}
      {/* The gate doors (swung open). */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 4.2, 3, -13.6]} rotation={[0, s * (gateOpen ? 1.1 : 0), 0]}>
          <boxGeometry args={[6, 6, 0.4]} />
          <meshStandardMaterial color="#2a2f3a" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {/* Watchtower searchlights. */}
      {[-10, 10].map((x) => (
        <mesh key={x} position={[x, 8, -14]}>
          <sphereGeometry args={[0.5, 12, 12]} />
          <meshStandardMaterial color="#fff2c0" emissive="#ffd86a" emissiveIntensity={2.5} />
        </mesh>
      ))}
    </group>
  )
}
