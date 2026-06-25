import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  DirectorCamera,
  EscapeYard,
  Guard,
  PrisonSet,
  Runner,
  SceneClock,
  Warden,
  seg,
  v3lerp,
  lerp,
  type V3,
} from './parts'
import '../../styles/cutscene.css'

/* ============================================================================
   Cinematic cutscenes that reuse the game's look (low-poly characters, guards,
   prison set) on a lightweight physics-free canvas. Each scene scripts actors
   and the camera as functions of scene time; a DOM overlay adds letterbox bars,
   timed captions, and a Skip button.
   ========================================================================== */

export type SceneName = 'sp-intro' | 'sp-outro' | 'mp-intro' | 'mp-outro'

export interface CutsceneData {
  winnerName?: string
  youWon?: boolean
}

interface Beat {
  at: number // ms from start
  text: string
}

interface SceneConfig {
  durationMs: number
  beats: Beat[]
  night: boolean
  render: (data: CutsceneData) => ReactNode
}

const HERO = '#e0892f'
const AKASH = '#54d6a0'
const FIGHTER_COLORS = ['#4f8cff', '#ff6f8a', '#ffd166', '#7fe07f', '#c08bff', '#46e0c0']

// --- Scene: single-player intro -------------------------------------------
// The Warden drags Akash away; guards seize the hero, who breaks free and runs.
function SpIntro() {
  const wardenPos = (t: number): V3 => v3lerp([9, 0, -3.2], [-7, 0, -3.2], seg(t, 0, 3.4))
  const akashPos = (t: number): V3 => v3lerp([10.6, 0, -3.0], [-5.4, 0, -3.0], seg(t, 0, 3.4))
  const captivePath = (t: number): V3 => v3lerp([-9, 0, 0.3], [-0.5, 0, 0.3], seg(t, 2.2, 5))
  const guardA = (t: number): V3 => {
    const c = captivePath(t)
    return [c[0] - 1.1, 0, -0.2]
  }
  const guardB = (t: number): V3 => {
    const c = captivePath(t)
    return [c[0] + 1.1, 0, 0.9]
  }
  const escapePath = (t: number): V3 => v3lerp([-0.5, 0, 0.3], [0.4, 0, 7], seg(t, 5, 9))
  const chaseGuard = (off: number) => (t: number): V3 => v3lerp([-0.5 + off, 0, -0.6], [0.4 + off, 0, 4.5], seg(t, 5.6, 9))

  return (
    <SceneClock>
      <CutsceneLights night={false} />
      <PrisonSet alarm />
      <DirectorCamera
        track={(t) => ({
          pos: v3lerp([0, 3.6, 9.6], [0, 3.0, 8.2], seg(t, 0, 9)),
          look: v3lerp([-1, 1.4, -3], [0.4, 1.1, 1.5], seg(t, 0, 9)),
        })}
      />
      {/* Warden hauls Akash off into the dark. */}
      <Warden pos={wardenPos} yaw={() => -Math.PI / 2} visible={(t) => t < 3.6} />
      <Runner pos={akashPos} yaw={() => -Math.PI / 2} color={AKASH} running={false} visible={(t) => t < 3.6} />
      {/* Hero seized and dragged in. */}
      <Runner pos={captivePath} yaw={() => Math.PI / 2} color={HERO} running={false} visible={(t) => t >= 2.2 && t < 5.2} />
      <Guard pos={guardA} yaw={() => Math.PI / 2} visible={(t) => t >= 2.2 && t < 5.4} />
      <Guard pos={guardB} ranged yaw={() => -Math.PI / 2} visible={(t) => t >= 2.2 && t < 5.4} />
      {/* Hero breaks free and bolts toward camera. */}
      <Runner pos={escapePath} yaw={() => 0} color={HERO} running visible={(t) => t >= 5} />
      <Guard pos={chaseGuard(-1.4)} yaw={() => 0} visible={(t) => t >= 5.6} />
      <Guard pos={chaseGuard(1.4)} ranged yaw={() => 0} visible={(t) => t >= 5.6} />
    </SceneClock>
  )
}

// --- Scene: single-player victory ------------------------------------------
// Hero and Akash sprint out through the gate; guards give chase but fall behind.
function SpOutro() {
  const runnersZ = (t: number) => lerp(6, -12, seg(t, 1, 7))
  const hero = (t: number): V3 => [-0.9, 0, runnersZ(t)]
  const akash = (t: number): V3 => [0.9, 0, runnersZ(t) + 0.4]
  const chaser = (off: number, delay: number) => (t: number): V3 => [off, 0, lerp(10, -1.5, seg(t, delay, 7.5))]

  return (
    <SceneClock>
      <CutsceneLights night />
      <EscapeYard gateOpen />
      <DirectorCamera
        track={(t) => ({
          pos: [0, 3.6, runnersZ(t) + 7.5],
          look: [0, 1.1, runnersZ(t) - 2.5],
        })}
      />
      <Runner pos={hero} yaw={() => Math.PI} color={HERO} running />
      <Runner pos={akash} yaw={() => Math.PI} color={AKASH} running />
      <Guard pos={chaser(-1.8, 0.4)} yaw={() => Math.PI} visible={(t) => t < 7.6} />
      <Guard pos={chaser(0, 0.9)} ranged yaw={() => Math.PI} visible={(t) => t < 7.6} />
      <Guard pos={chaser(1.8, 1.3)} yaw={() => Math.PI} visible={(t) => t < 7.6} />
    </SceneClock>
  )
}

// --- Scene: multiplayer intro ----------------------------------------------
// Fighters are dragged into the Warden's arena and squared off to fight.
function MpIntro() {
  const ring = 3.1
  const fighters = FIGHTER_COLORS.map((color, i) => {
    const ang = (i / FIGHTER_COLORS.length) * Math.PI * 2
    const target: V3 = [Math.sin(ang) * ring, 0, Math.cos(ang) * ring]
    const start: V3 = [Math.sin(ang) * 16, 0, Math.cos(ang) * 16]
    const pos = (t: number): V3 => v3lerp(start, target, seg(t, 0.2 + i * 0.12, 3.2))
    // Face the center of the pit.
    const yaw = () => Math.atan2(-target[0], -target[2])
    return { color, pos, yaw }
  })

  return (
    <SceneClock>
      <CutsceneLights night={false} />
      <PrisonSet alarm />
      <DirectorCamera
        track={(t) => ({
          pos: v3lerp([0, 11, 12], [0, 6.5, 9.5], seg(t, 0, 7)),
          look: [0, 0.8, 0],
        })}
      />
      {fighters.map((f, i) => (
        <Runner key={i} pos={f.pos} yaw={f.yaw} color={f.color} running />
      ))}
      {/* The Warden presides from the back. */}
      <Warden pos={() => [0, 0, -7.5]} yaw={() => 0} />
    </SceneClock>
  )
}

// --- Scene: multiplayer outro ----------------------------------------------
// The winner sprints out the gate; the rest are swarmed and overrun.
function MpOutro() {
  const winner = (t: number): V3 => [0, 0, lerp(2, -12, seg(t, 0.5, 6))]
  const losers: V3[] = [
    [-2.4, 0, 1.5],
    [2.4, 0, 1.6],
    [-1.1, 0, 3.0],
    [1.3, 0, 2.6],
  ]
  // Guards converge on the clustered losers from the perimeter.
  const swarm = (from: V3, to: V3, delay: number) => (t: number): V3 => v3lerp(from, to, seg(t, delay, 5))

  return (
    <SceneClock>
      <CutsceneLights night />
      <EscapeYard gateOpen />
      <DirectorCamera
        track={(t) => ({
          pos: v3lerp([6, 4.5, 9], [2, 3.4, 8], seg(t, 0, 8)),
          look: v3lerp([0, 1, 1.5], [0, 0.8, -1], seg(t, 0, 8)),
        })}
      />
      <Runner pos={winner} yaw={() => Math.PI} color={FIGHTER_COLORS[0]} running />
      {losers.map((p, i) => (
        // Losers sink into the ground as the horde overruns them.
        <Runner
          key={i}
          pos={(t) => [p[0], Math.min(0, -seg(t, 4.2 + i * 0.2, 6.5) * 2.2), p[2]]}
          yaw={() => i * 1.3}
          color={FIGHTER_COLORS[(i + 1) % FIGHTER_COLORS.length]}
          running={false}
          visible={(t) => seg(t, 4.2 + i * 0.2, 6.8) < 0.98}
        />
      ))}
      {[
        swarm([-12, 0, 2], [-3, 0, 2], 1.2),
        swarm([12, 0, 2], [3, 0, 2], 1.4),
        swarm([0, 0, 12], [0, 0, 3.6], 1.0),
        swarm([-10, 0, 10], [-1.4, 0, 3], 1.6),
        swarm([10, 0, 10], [1.6, 0, 3], 1.8),
      ].map((p, i) => (
        <Guard key={i} pos={p} ranged={i % 2 === 0} yaw={() => 0} />
      ))}
    </SceneClock>
  )
}

function CutsceneLights({ night }: { night: boolean }) {
  return (
    <>
      <color attach="background" args={[night ? '#070a10' : '#1a1410']} />
      <fog attach="fog" args={[night ? '#070a10' : '#1a1410', 14, 48]} />
      <ambientLight intensity={night ? 0.45 : 0.8} />
      <hemisphereLight args={[night ? '#3a4a66' : '#cdd8ec', '#0a0c10', night ? 0.4 : 0.7]} />
      <directionalLight
        position={[8, 16, 10]}
        intensity={night ? 0.9 : 1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      {night && <pointLight position={[0, 8, -12]} intensity={1.4} color="#ffd86a" distance={45} />}
    </>
  )
}

const SCENES: Record<SceneName, SceneConfig> = {
  'sp-intro': {
    durationMs: 9200,
    night: false,
    render: () => <SpIntro />,
    beats: [
      { at: 0, text: 'The Warden dragged Akash into the dark.' },
      { at: 2600, text: 'Then the guards came for you.' },
      { at: 5000, text: 'You tore free of their grip —' },
      { at: 7200, text: 'RUN.' },
    ],
  },
  'sp-outro': {
    durationMs: 8600,
    night: true,
    render: () => <SpOutro />,
    beats: [
      { at: 0, text: 'You found Akash.' },
      { at: 2200, text: 'Now get him out.' },
      { at: 4600, text: 'The guards are right behind you —' },
      { at: 6800, text: 'Almost there!' },
    ],
  },
  'mp-intro': {
    durationMs: 7000,
    night: false,
    render: () => <MpIntro />,
    beats: [
      { at: 0, text: "Captured — dragged into the Warden's arena." },
      { at: 2600, text: 'Everyone goes in. One walks out.' },
      { at: 4800, text: 'Fight.' },
    ],
  },
  'mp-outro': {
    durationMs: 8000,
    night: true,
    render: () => <MpOutro />,
    beats: [
      { at: 0, text: 'One break for the gate.' },
      { at: 2600, text: "The rest weren't so lucky." },
      { at: 5000, text: 'The horde closed in.' },
    ],
  },
}

export default function Cutscene({
  scene,
  onDone,
  data = {},
}: {
  scene: SceneName
  onDone: () => void
  data?: CutsceneData
}) {
  const cfg = SCENES[scene]
  const [beatIdx, setBeatIdx] = useState(0)
  const doneRef = useRef(false)

  // Personalize a couple of multiplayer captions when we know the winner.
  const beats = useMemo<Beat[]>(() => {
    if (scene === 'mp-outro') {
      const lead = data.youWon
        ? 'You broke for the gate.'
        : data.winnerName
          ? `${data.winnerName} broke for the gate.`
          : 'One break for the gate.'
      return [{ at: 0, text: lead }, ...cfg.beats.slice(1)]
    }
    return cfg.beats
  }, [scene, cfg.beats, data.youWon, data.winnerName])

  const finish = () => {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  useEffect(() => {
    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      let idx = 0
      for (let i = 0; i < beats.length; i++) if (elapsed >= beats[i].at) idx = i
      setBeatIdx(idx)
    }, 120)
    const end = setTimeout(finish, cfg.durationMs)
    return () => {
      clearInterval(tick)
      clearTimeout(end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  return (
    <div className="cutscene" role="dialog" aria-label="Story scene">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 4, 10], fov: 50, near: 0.1, far: 200 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>{cfg.render(data)}</Suspense>
      </Canvas>

      <div className="cutscene-bar cutscene-bar-top" aria-hidden />
      <div className="cutscene-bar cutscene-bar-bottom" aria-hidden />

      <p key={beatIdx} className="cutscene-caption">
        {beats[beatIdx]?.text}
      </p>

      <button type="button" className="cutscene-skip" onClick={finish}>
        Skip ⏭
      </button>
    </div>
  )
}
