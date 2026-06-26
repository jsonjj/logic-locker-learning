import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GameCanvas, ThirdPersonPlayer, Waypoint } from '../game3d/engine'
import RoomShell from '../game3d/world/RoomShell'
import { getRoomDef } from '../game3d/world/rooms'
import { getPuzzleScene } from '../game3d/puzzles/registry'
import Hud from '../game3d/hud/Hud'
import GameMenu from '../game3d/hud/GameMenu'
import Minimap from '../game3d/world/Minimap'
import LearnPanel from '../game3d/learn/LearnPanel'
import ReviewSession from '../game3d/review/ReviewSession'
import { GameStateProvider, useGameState } from '../game3d/state/GameStateContext'
import { CombatProvider, useCombat } from '../game3d/combat/CombatContext'
import Enemy, { type EnemyKind } from '../game3d/combat/Enemy'
import WeaponController from '../game3d/combat/WeaponController'
import { useRun } from '../game3d/state/RunContext'
import { useInventory } from '../game3d/state/InventoryContext'
import CombatHud from '../game3d/hud/CombatHud'
import Hotbar from '../game3d/hud/Hotbar'
import { useHotbar } from '../game3d/hud/useHotbar'
import InventoryPanel from '../game3d/hud/InventoryPanel'
import GameOver from '../game3d/hud/GameOver'
import { rewardWheel, pickWeightedIndex, rollConsumableDrop, rollEnemyDrop, GEAR, type GearItem } from '../game3d/systems/gear'
import Pickup from '../game3d/combat/Pickup'
import RewardWheel from '../game3d/hud/RewardWheel'
import { getObjective } from '../game3d/story/objectives'
import { R3D, vec3, type LevelResult, type PuzzleResult, type PuzzleReviewItem, type Vec3 } from '../game3d/contracts'
import { getSector, nextSector } from '../data/sectors'
import { getLesson } from '../data/lessons'
import { varyLesson, pickTrack } from '../logic/variants'
import type { Lesson } from '../types'
import { SKILLS, sectorSkillId, prereqSkill, prereqSectorId } from '../game3d/skills'
import { computeResult, formatTime } from '../scoring/score'
import { useRunTimer } from '../scoring/useRunTimer'
import { saveLevelResult, getLevelResults } from '../firebase/results'
import { submitScore } from '../firebase/leaderboard'
import ResultsScreen from '../components/ResultsScreen'

const NEAR_RANGE = 3.2

interface EnemySpawn {
  id: number
  spawn: Vec3
  speed: number
  hp: number
  kind: EnemyKind
  damage: number
}

function buildEnemies(order: number, size: [number, number], prestige = 0): EnemySpawn[] {
  const [w, d] = size
  // Tougher, gear-gated: earning weapons/armor matters. The enemy COUNT ramps
  // hard the deeper you go (the late blocks are swarms), and each PRESTIGE makes
  // the guards meaningfully nastier — more of them, more HP, a touch faster — so
  // even with a fully-kept arsenal the replay still fights back and stays worth
  // trying. The base HP is high enough that weapon upgrades clearly matter.
  const count = Math.min(3 + Math.floor(order * 0.85) + prestige, 8 + Math.min(prestige, 4))
  const speed = 2.6 + order * 0.22 + prestige * 0.18
  const hp = 4 + Math.round(order * 1.5) + prestige * 2
  const rangedBase = order < 2 ? Math.min(1, prestige) : order < 4 ? 2 : 3
  const rangedCount = Math.min(count, rangedBase + (prestige >= 2 ? 1 : 0))
  const slots: Vec3[] = [
    vec3(-w * 0.28, 1, -d * 0.1),
    vec3(w * 0.28, 1, -d * 0.16),
    vec3(0, 1, -d * 0.34),
    vec3(-w * 0.22, 1, -d * 0.3),
    vec3(w * 0.22, 1, -d * 0.34),
    vec3(0, 1, -d * 0.12),
    vec3(-w * 0.34, 1, -d * 0.24),
    vec3(w * 0.34, 1, -d * 0.24),
    // Extra slots so high-prestige runs can field a bigger swarm.
    vec3(-w * 0.16, 1, -d * 0.42),
    vec3(w * 0.16, 1, -d * 0.42),
    vec3(-w * 0.4, 1, -d * 0.38),
    vec3(w * 0.4, 1, -d * 0.38),
  ]
  return slots.slice(0, count).map((spawn, i) => ({
    id: i + 1,
    spawn,
    speed,
    hp,
    // Make the last `rangedCount` guards shooters.
    kind: i >= count - rangedCount ? 'ranged' : 'melee',
    // A heavy hitter shows up from sector 4 on; prestige promotes it harder.
    damage: (order >= 3 && i === 0 ? 2 : 1) + (prestige >= 3 && i === 0 ? 1 : 0),
  }))
}

/**
 * Reinforcements the alarm summons when you guess on the lock. They drop in
 * around the room so a sloppy, guessed breach turns the escape into a fight —
 * a real cost for not actually reasoning it out.
 */
function buildReinforcements(n: number, size: [number, number], startId: number, prestige = 0): EnemySpawn[] {
  const [w, d] = size
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2
    return {
      id: startId + i,
      spawn: vec3(Math.cos(angle) * w * 0.3, 1, -d * 0.2 + Math.sin(angle) * d * 0.2),
      speed: 2.8 + prestige * 0.15,
      hp: 5 + prestige * 2,
      kind: (i % 3 === 0 ? 'ranged' : 'melee') as EnemyKind,
      damage: 1,
    }
  })
}

// --- Prerequisite re-routing (local only, no Firebase) ----------------------
// Track consecutive "bad" runs per sector so we can OFFER (never force) a trip
// back to the prerequisite room after the player struggles twice in a row.
const REROUTE_THRESHOLD = 2
/** A solved run is "bad" when at least this fraction of questions were erred AND not recovered. */
const BAD_MISTAKE_RATE = 0.4

function rerouteKey(uid: string | undefined, sectorId: string) {
  return `ll-reroute-${uid ?? 'anon'}-${sectorId}`
}

function getBadRuns(uid: string | undefined, sectorId: string): number {
  try {
    return Math.max(0, Number(localStorage.getItem(rerouteKey(uid, sectorId))) || 0)
  } catch {
    return 0
  }
}

function setBadRuns(uid: string | undefined, sectorId: string, n: number) {
  try {
    localStorage.setItem(rerouteKey(uid, sectorId), String(Math.max(0, n)))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

// A running count of consecutive flawless clears (across all rooms). Hitting a
// milestone pays out bonus Tech Cores, so mastery — not just grinding — speeds
// up weapon upgrades. Any unrecovered mistake resets it.
const FLAWLESS_MILESTONE = 3
const FLAWLESS_BONUS = 4
function streakKey(uid: string | undefined) {
  return `ll-flawless-streak-${uid ?? 'anon'}`
}
function getStreak(uid: string | undefined): number {
  try {
    return Math.max(0, Number(localStorage.getItem(streakKey(uid))) || 0)
  } catch {
    return 0
  }
}
function setStreak(uid: string | undefined, n: number) {
  try {
    localStorage.setItem(streakKey(uid), String(Math.max(0, n)))
  } catch {
    /* ignore */
  }
}

function RoomInner({ sectorId }: { sectorId: string }) {
  const navigate = useNavigate()
  const gs = useGameState()
  const combat = useCombat()
  const run = useRun()
  const inv = useInventory()
  const { user, profile } = useAuth()
  const uid = user?.uid

  const sector = getSector(sectorId)
  const lesson = sector ? getLesson(sector.lessonId) : undefined
  const def = getRoomDef(sectorId)
  const PuzzleScene = useMemo(() => getPuzzleScene(sectorId), [sectorId])

  // Each visit lightly varies this room's questions (authored case track +
  // shuffled answer order) so the puzzle isn't memorizable. Purely local.
  const [playLesson, setPlayLesson] = useState<Lesson | undefined>(lesson)
  const prevTrack = useRef<number | undefined>(undefined)

  const timer = useRunTimer()

  const [enemies, setEnemies] = useState<EnemySpawn[]>(() =>
    buildEnemies(sector?.order ?? 0, def?.size ?? [24, 20], inv.prestige),
  )
  const [invOpen, setInvOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Elapsed time is a friendly count-up STAT only — it never costs a life.
  const [elapsedSec, setElapsedSec] = useState(0)
  // Non-blocking "revisit the basics?" offer after repeated struggles.
  const [rerouteOffer, setRerouteOffer] = useState(false)

  const [solved, setSolved] = useState(false)
  const [puzzleOpen, setPuzzleOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [review, setReview] = useState<PuzzleReviewItem[] | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [near, setNear] = useState<'puzzle' | 'exit' | null>(null)
  const [result, setResult] = useState<LevelResult | null>(null)
  const [wheel, setWheel] = useState<{ segments: GearItem[]; winnerIndex: number; flawless: boolean; cores: number; drop?: string } | null>(null)
  // Physical loot a slain enemy left on the floor — walk over it to grab it.
  const [drops, setDrops] = useState<{ key: number; itemId: string; position: Vec3 }[]>([])
  const dropKey = useRef(0)
  const [isBest, setIsBest] = useState(false)
  const [priorBest, setPriorBest] = useState<LevelResult | null>(null)
  // 'learn' = briefing beat, 'play' = walk + crack the lock, 'results' = scored.
  const [phase, setPhase] = useState<'learn' | 'play' | 'results'>('learn')

  // Re-roll this room's question variant (different track than last time).
  const rerollQuestions = useCallback(() => {
    if (!lesson) return
    const track = pickTrack(lesson, prevTrack.current)
    prevTrack.current = track
    setPlayLesson(varyLesson(lesson, track))
  }, [lesson])

  useEffect(() => {
    rerollQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId])

  // Guard + initialize. The run timer starts when the player begins the lock
  // (after the briefing), not while they're still reading.
  useEffect(() => {
    if (!sector || !lesson || !def) {
      navigate(R3D.world, { replace: true })
      return
    }
    timer.reset()
    let active = true
    if (uid) {
      getLevelResults(uid)
        .then((r) => {
          if (active) setPriorBest(r[sectorId] ?? null)
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId])

  // Objective + waypoint follow the current phase.
  useEffect(() => {
    if (!sector || !def) return
    gs.setObjective(
      getObjective({
        scene: 'room',
        phase: solved ? 'exit' : 'solve',
        sector,
        target: solved ? def.exitDoor.position : def.puzzleAnchor,
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, sectorId])

  // Proximity to the puzzle device / exit door.
  useEffect(() => {
    if (!def) return
    let raf = 0
    const tick = () => {
      const p = gs.playerPos.current
      const dPuzzle = Math.hypot(def.puzzleAnchor.x - p.x, def.puzzleAnchor.z - p.z)
      const dExit = Math.hypot(def.exitDoor.position.x - p.x, def.exitDoor.position.z - p.z)
      let found: 'puzzle' | 'exit' | null = null
      if (!solved && dPuzzle < NEAR_RANGE) found = 'puzzle'
      else if (solved && dExit < NEAR_RANGE) found = 'exit'
      setNear((prev) => (prev === found ? prev : found))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [def, solved, gs.playerPos])

  // Keyboard interact.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase()
      if ((k === 'e' || k === ' ' || k === 'enter') && !menuOpen && !puzzleOpen && !reviewOpen) {
        if (near === 'puzzle') {
          e.preventDefault()
          gs.setPaused(true)
          setPuzzleOpen(true)
        } else if (near === 'exit') {
          e.preventDefault()
          setPhase('results')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, menuOpen, puzzleOpen, reviewOpen])

  const blocked = phase !== 'play' || puzzleOpen || menuOpen || invOpen || reviewOpen || run.isGameOver

  // Quick inventory toggle with the I key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'i' && !menuOpen && !puzzleOpen && !reviewOpen && !run.isGameOver) {
        e.preventDefault()
        setInvOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen, puzzleOpen, reviewOpen, run.isGameOver])

  // Route guard contact damage into the shared life pool (armor shield soaks it
  // first; i-frames handled in CombatContext).
  useEffect(() => {
    combat.setPlayerDamageHandler((amount) => {
      run.takeHit(Math.max(1, amount ?? 1))
    })
    return () => combat.setPlayerDamageHandler(null)
  }, [combat, run])

  // Armor shield recharges on entering each room (lives carry over from the hub).
  useEffect(() => {
    run.rechargeShield(inv.armorPoints)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId, inv.armorPoints])

  // Quick bar: 1-9 to swap weapons / use consumables; consumables heal a life.
  const { activate: activateHotbar, cooldownUntil: hotbarCd } = useHotbar({
    enabled: !blocked,
    onUseConsumable: (item) => run.gainLife(item.heal ?? 1),
  })

  // Friendly count-up timer while actively playing. There is NO time pressure:
  // the clock never costs a life — it's just a stat the player can ignore.
  useEffect(() => {
    if (blocked || solved) return
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [blocked, solved])

  // Auto-dismiss toasts.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  // On entry, surface the (non-blocking) "revisit the basics?" offer if the
  // player has already had REROUTE_THRESHOLD bad runs here and a prereq exists.
  useEffect(() => {
    if (prereqSectorId(sectorId) && getBadRuns(uid, sectorId) >= REROUTE_THRESHOLD) {
      setRerouteOffer(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId, uid])

  // A game-over in this room counts as a "bad" run for re-routing.
  useEffect(() => {
    if (!run.isGameOver) return
    setBadRuns(uid, sectorId, getBadRuns(uid, sectorId) + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.isGameOver])

  function handleEnemyDeath(id: number, pos?: { x: number; y: number; z: number }) {
    setEnemies((es) => es.filter((e) => e.id !== id))
    if (!pos) return
    const dropId = rollEnemyDrop()
    if (dropId) {
      setDrops((d) => [...d, { key: dropKey.current++, itemId: dropId, position: { x: pos.x, y: 0, z: pos.z } }])
    }
  }

  function grabDrop(key: number, itemId: string) {
    const item = GEAR[itemId]
    if (item?.slot === 'consumable') inv.addConsumable(itemId, 1)
    setDrops((d) => d.filter((x) => x.key !== key))
    setToast(`Picked up ${item?.icon ?? ''} ${item?.name ?? 'item'}`)
  }

  function handleRestart() {
    run.startRun(3 + inv.bonusLives, inv.armorPoints)
    navigate(R3D.world)
  }

  // Each wrong answer on the lock nudges the alarm a little (visible as the
  // screen warming up). It's a soft signal, not a punishment — experimenting is
  // encouraged, and a corrected mistake costs nothing on exit.
  function handlePuzzleMistake() {
    gs.setDanger(Math.min(1, gs.danger + 0.12))
  }

  function handlePuzzleComplete(res: PuzzleResult) {
    setPuzzleOpen(false)
    if (!res.solved || !sector) {
      gs.setPaused(false)
      return
    }
    timer.stop()
    setSolved(true)
    // Productive failure: only UNRECOVERED mistakes (res.mistakes) summon any
    // reinforcements — correcting yourself mid-lock costs nothing on the way out.
    // Capped low so it's a nudge, never a wall.
    const comebacks = res.comebacks ?? 0
    const reinforce = Math.min(res.mistakes, 3)
    if (reinforce > 0) {
      setEnemies((es) => [...es, ...buildReinforcements(reinforce, def?.size ?? [24, 20], 200 + es.length, inv.prestige)])
    }
    // Stash the per-question debrief. If the player missed too many, surface the
    // review right away; otherwise it's available via a button on the results.
    const items = res.review ?? []
    setReview(items.length ? items : null)
    const wrong = items.filter((i) => !i.correct).length
    const tooMany = wrong >= Math.max(2, Math.ceil(items.length * 0.3))
    if (items.length > 0 && tooMany) {
      setReviewOpen(true)
      gs.setPaused(true)
    } else {
      gs.setPaused(false)
    }
    // Re-routing: judge a SOLVED run "bad" by the UNRECOVERED-mistake rate, so a
    // player who self-corrects is never pushed back. A clean clear resets the
    // streak; a bad clear bumps it and may surface the prereq offer.
    const total = items.length
    const badRun = total > 0 && res.mistakes >= Math.ceil(total * BAD_MISTAKE_RATE)
    if (badRun) {
      const n = getBadRuns(uid, sectorId) + 1
      setBadRuns(uid, sectorId, n)
      if (n >= REROUTE_THRESHOLD && prereqSectorId(sectorId)) setRerouteOffer(true)
    } else {
      setBadRuns(uid, sectorId, 0)
      setRerouteOffer(false)
    }
    const computed = computeResult({
      sectorId,
      timeMs: timer.timeMs,
      mistakes: res.mistakes,
      caught: false,
      parTimeSec: sector.parTimeSec,
      comebacks,
    })
    const best = !priorBest || computed.score > priorBest.score
    setResult(computed)
    setIsBest(best)
    if (best) setPriorBest(computed)
    // Reward: spin a performance-weighted wheel of upgrades. A FLAWLESS run (no
    // UNRECOVERED mistakes) — including one you fought back to via comebacks —
    // bends the odds toward stronger gear AND grants +1 life (applied when the
    // wheel is claimed), so reasoning your way clean beats guessing.
    const flawless = res.mistakes === 0
    // Tech Cores: a small guaranteed payout for clearing, on TOP of the random
    // gear wheel — clean and fought-back (comeback) runs earn a bit more. Kept
    // deliberately stingy so fully upgrading a weapon is a long-term grind, not
    // something you finish in a couple of rooms.
    // Flawless streak: chain clean clears for a periodic Tech Core windfall.
    let streakText = ''
    let streakBonus = 0
    if (flawless) {
      const s = getStreak(uid) + 1
      setStreak(uid, s)
      if (s % FLAWLESS_MILESTONE === 0) {
        streakBonus = FLAWLESS_BONUS
        streakText = `🔥 ${s} flawless streak bonus!`
      }
    } else {
      setStreak(uid, 0)
    }
    const coreReward = 1 + (flawless ? 1 : 0) + Math.min(comebacks, 2) + streakBonus
    // Healing drop: playing well restocks your kit, so clean reasoning — not just
    // hoarding cores — keeps you alive. Granted now; surfaced in the reward toast.
    const drop = rollConsumableDrop(res.rawMistakes ?? res.mistakes, flawless, comebacks)
    const dropItem = GEAR[drop.id]
    let dropText = ''
    if (dropItem) {
      inv.addConsumable(drop.id, drop.n)
      dropText = `+${drop.n} ${dropItem.icon} ${dropItem.name}`
    }
    const extra = [dropText, streakText].filter(Boolean).join(' · ')
    const entries = rewardWheel(sectorId, flawless, res.mistakes, inv.owned, comebacks)
    if (entries.length > 0) {
      setWheel({ segments: entries.map((e) => e.item), winnerIndex: pickWeightedIndex(entries), flawless, cores: coreReward, drop: extra })
    } else {
      inv.addCores(coreReward)
      setToast(`+${coreReward} 🔧 Tech Cores${extra ? ` · ${extra}` : ''}`)
    }
    if (uid) {
      void saveLevelResult(uid, computed)
      if (profile) {
        void submitScore({
          uid,
          displayName: profile.displayName,
          avatarId: profile.avatarId,
          sectorId,
          score: computed.score,
          stars: computed.stars,
          timeMs: computed.timeMs,
        })
      }
    }
  }

  function beginQuiz() {
    timer.reset()
    timer.start()
    setElapsedSec(0)
    setPhase('play')
  }

  function resetRoom() {
    setSolved(false)
    setResult(null)
    setWheel(null)
    setReview(null)
    setReviewOpen(false)
    setPhase('play')
    setPuzzleOpen(false)
    setElapsedSec(0)
    setEnemies(buildEnemies(sector?.order ?? 0, def?.size ?? [24, 20], inv.prestige))
    setDrops([])
    gs.setPaused(false)
    gs.setDanger(0)
    timer.reset()
    timer.start()
    // Retry gets a different question variant.
    rerollQuestions()
  }

  if (!sector || !lesson || !def) return null

  const nxt = nextSector(sectorId)
  const rerouteRoom = prereqSectorId(sectorId)
  const curSkillLabel = SKILLS[sectorSkillId(sectorId)].label
  const preSkill = prereqSkill(sectorSkillId(sectorId))
  const preSkillLabel = preSkill ? SKILLS[preSkill].label : 'the basics'

  return (
    <div className="world-root">
      <GameCanvas danger={gs.danger}>
        <RoomShell def={def} exitOpen={solved} highlightExit={solved} onExit={() => setPhase('results')}>
          {/* Puzzle device marker at the anchor (real device comes from Agent 3 / 2). */}
        </RoomShell>
        <ThirdPersonPlayer spawn={def.spawn} frozen={blocked} />
        <Waypoint target={gs.objective?.target ?? null} />
        {enemies.map((e) => (
          <Enemy
            key={e.id}
            id={e.id}
            spawn={e.spawn}
            speed={e.speed}
            hp={e.hp}
            kind={e.kind}
            damage={e.damage}
            paused={blocked}
            onDeath={handleEnemyDeath}
          />
        ))}
        {drops.map((d) => (
          <Pickup key={d.key} itemId={d.itemId} position={d.position} onPickup={() => grabDrop(d.key, d.itemId)} />
        ))}
        <WeaponController disabled={blocked} />
      </GameCanvas>

      <Hud
        objective={gs.objective}
        interactHint={
          near === 'puzzle'
            ? 'Press E to work the lock'
            : near === 'exit'
              ? 'Press E to slip through'
              : null
        }
        progress={sector.name}
        onOpenMenu={() => {
          gs.setPaused(true)
          setMenuOpen(true)
        }}
      />

      <Minimap variant="room" def={def} />

      <CombatHud
        lives={run.lives}
        maxLives={run.maxLives}
        shield={run.shield}
        maxShield={run.maxShield}
        weapon={inv.weapon}
        timeLeftSec={null}
        onOpenInventory={() => setInvOpen(true)}
        toast={toast}
      />
      {!blocked && (
        <Hotbar
          onActivate={activateHotbar}
          cooldownUntil={hotbarCd}
          urgent={run.lives <= 1 && run.shield <= 0}
        />
      )}

      {phase === 'play' && !solved && (
        <div className="room-elapsed" aria-label="Elapsed time (no time limit)">
          <span className="room-elapsed-ico" aria-hidden>⏱</span>
          <span className="room-elapsed-value">{formatTime(elapsedSec * 1000)}</span>
          <span className="room-elapsed-tag">no limit</span>
        </div>
      )}
      <InventoryPanel open={invOpen} onClose={() => setInvOpen(false)} />
      <GameOver open={run.isGameOver} onRestart={handleRestart} />

      {phase === 'learn' && <LearnPanel sectorId={sectorId} onBegin={beginQuiz} />}

      {near && phase === 'play' && !puzzleOpen && (
        <button
          type="button"
          className="game-action-btn"
          onClick={() => {
            if (near === 'puzzle') {
              gs.setPaused(true)
              setPuzzleOpen(true)
            } else {
              setPhase('results')
            }
          }}
        >
          {near === 'puzzle' ? 'Work the lock' : 'Escape'}
        </button>
      )}

      {puzzleOpen && (
        <PuzzleScene
          sectorId={sectorId}
          lesson={playLesson ?? lesson}
          anchor={def.puzzleAnchor}
          prestige={inv.prestige}
          mode={inv.mode}
          skill={sectorSkillId(sector.id)}
          onComplete={handlePuzzleComplete}
          onMistake={handlePuzzleMistake}
        />
      )}

      {phase === 'results' && result && (
        <div className="puzzle-overlay">
          <ResultsScreen
            result={result}
            isBest={isBest}
            sectorName={sector.name}
            nextSectorName={nxt?.name}
            onRetry={resetRoom}
            onMap={() => navigate(R3D.world)}
            onLeaderboard={() => navigate(R3D.leaderboard)}
            onReview={review && review.length ? () => setReviewOpen(true) : undefined}
          />
        </div>
      )}

      {phase === 'results' && wheel && (
        <RewardWheel
          segments={wheel.segments}
          winnerIndex={wheel.winnerIndex}
          onResult={(item) => {
            const added = inv.addItem(item.id)
            if (wheel.flawless) run.gainLife()
            inv.addCores(wheel.cores)
            setToast(
              `${added ? 'Unlocked' : 'Bonus'} ${item.icon} ${item.name} · +${wheel.cores} 🔧 Cores${
                wheel.flawless ? ' · +1 life (flawless)' : ''
              }${wheel.drop ? ` · ${wheel.drop}` : ''}`,
            )
          }}
          onClose={() => setWheel(null)}
        />
      )}

      {reviewOpen && review && review.length > 0 && (
        <ReviewSession
          items={review}
          sectorName={sector.name}
          onClose={() => {
            setReviewOpen(false)
            if (phase !== 'results') gs.setPaused(false)
          }}
        />
      )}

      {rerouteOffer && rerouteRoom && !run.isGameOver && (
        <div className="reroute-offer" role="dialog" aria-label="Revisit a prerequisite skill">
          <div className="reroute-offer-body">
            <p className="reroute-offer-title">Struggling with {curSkillLabel}?</p>
            <p className="reroute-offer-text">
              Revisit <strong>{preSkillLabel}</strong> first — it's the skill this room builds on.
            </p>
          </div>
          <div className="reroute-offer-actions">
            <button
              type="button"
              className="reroute-btn is-primary"
              onClick={() => {
                setRerouteOffer(false)
                navigate(R3D.room(rerouteRoom))
              }}
            >
              Review the basics
            </button>
            <button type="button" className="reroute-btn" onClick={() => setRerouteOffer(false)}>
              Keep trying
            </button>
          </div>
        </div>
      )}

      <GameMenu
        open={menuOpen}
        onClose={() => {
          gs.setPaused(false)
          setMenuOpen(false)
        }}
        onRestart={resetRoom}
      />
    </div>
  )
}

export default function SectorRoomPage() {
  const { sectorId = '' } = useParams()
  return (
    <GameStateProvider>
      <CombatProvider>
        <RoomInner sectorId={sectorId} key={sectorId} />
      </CombatProvider>
    </GameStateProvider>
  )
}
