import type { ReactNode } from 'react'
import { Floor, Wall, Door } from '../engine'
import { RoomDressing, PulseLight, PulseMaterial } from './decor'
import { paletteFor } from './palette'
import { useQuality } from '../engine/quality'
import { toTuple, type RoomDef } from '../contracts'

export interface RoomShellProps {
  def: RoomDef
  /** Whether the exit door is open (puzzle solved). */
  exitOpen: boolean
  /** Player walked through the open exit. */
  onExit?: () => void
  /** Point wayfinding at the exit door. */
  highlightExit?: boolean
  /** Puzzle devices / set dressing placed inside the room. */
  children?: ReactNode
}

/**
 * [Agent 2 owns this file] A single, fully-enclosed sector room built from
 * engine primitives + themed decor. Four solid walls box the player in; the only
 * way forward is the exit door on the far (-z) wall, which the integrator opens
 * once the puzzle is solved. The +z wall shows the (now sealed) entrance the
 * player arrived through so the space reads as a real room.
 */
export default function RoomShell({ def, exitOpen, onExit, highlightExit, children }: RoomShellProps) {
  const [w, d] = def.size
  const p = paletteFor(def.theme)
  const wallH = 4
  const { maxLights } = useQuality()

  // Two ceiling fixtures, but only spend real dynamic lights up to the tier's
  // budget; the rest keep their (cheap) emissive panel so the room still reads lit.
  const fixtureZ = [-d / 4, d / 4]

  return (
    <group>
      <Floor size={[w, d]} theme={def.theme} color={p.floor} />

      {/* enclosure */}
      <Wall position={[0, wallH / 2, -d / 2]} size={[w, wallH, 0.5]} color={p.wall} />
      <Wall position={[0, wallH / 2, d / 2]} size={[w, wallH, 0.5]} color={p.wall} />
      <Wall position={[-w / 2, wallH / 2, 0]} size={[0.5, wallH, d]} color={p.wall} />
      <Wall position={[w / 2, wallH / 2, 0]} size={[0.5, wallH, d]} color={p.wall} />

      {/* hanging light fixtures so the room reads bright and lived-in (no solid
          roof — keeps the overhead camera's view clear). The emissive panel
          breathes; the real point light count is clamped to the quality budget. */}
      {fixtureZ.map((z, i) => (
        <group key={z} position={[0, wallH - 0.3, z]}>
          <mesh>
            <boxGeometry args={[w * 0.5, 0.2, 1.1]} />
            <PulseMaterial color="#fdf6e3" emissive="#fff3d6" base={1.3} amp={0.25} speed={2.4} phase={i * 1.3} />
          </mesh>
          {i < maxLights && (
            <PulseLight position={[0, -0.5, 0]} color="#ffe9c2" base={7} amp={0.7} speed={2.4} phase={i * 1.3} distance={22} />
          )}
        </group>
      ))}

      {/* baseboard accent trim along each wall (cheap polish, no colliders) */}
      <mesh position={[0, 0.15, -d / 2 + 0.3]} receiveShadow>
        <boxGeometry args={[w, 0.3, 0.12]} />
        <PulseMaterial color={p.accent} emissive={p.glow} base={0.15} amp={0.12} speed={1.5} />
      </mesh>
      <mesh position={[0, 0.15, d / 2 - 0.3]} receiveShadow>
        <boxGeometry args={[w, 0.3, 0.12]} />
        <PulseMaterial color={p.accent} emissive={p.glow} base={0.15} amp={0.12} speed={1.5} phase={Math.PI} />
      </mesh>

      {/* sealed entrance the player arrived through (closed -> blocks) */}
      <Door position={[0, 1.5, d / 2 - 0.3]} rotationY={0} open={false} label="Sealed" />

      {/* themed set dressing (kept clear of the central puzzle anchor) */}
      <RoomDressing def={def} />

      {/* exit / objective door on the far wall */}
      <Door
        position={toTuple(def.exitDoor.position)}
        rotationY={def.exitDoor.rotationY}
        open={exitOpen}
        label={def.exitDoor.label}
        highlight={highlightExit}
        onEnter={onExit}
      />

      {children}
    </group>
  )
}
