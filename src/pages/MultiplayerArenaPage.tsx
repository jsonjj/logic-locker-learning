import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isRealtimeConfigured } from '../firebase/firebaseConfig'
import { GameStateProvider } from '../game3d/state/GameStateContext'
import { GameCanvas, ThirdPersonPlayer } from '../game3d/engine'
import {
  subscribeMatch,
  subscribeEnemies,
  attachPresence,
  leaveMatch,
  updatePlayerTransform,
  nextRound,
  goIntermission,
  creditWin,
  finishSeries,
  reportDeath,
  reportRespawn,
  submitQuiz,
  setIntroDone,
  armRound,
} from '../multiplayer/net'
import {
  playerSpawn,
  respawnDelay,
  ROUND_DURATION_MS,
  QUIZ_INTERMISSION_MS,
  COUNTDOWN_MS,
  MAX_HP,
  quizTier,
  quizBuff,
} from '../multiplayer/arena'
import { getQuizQuestion, randomQuizId } from '../multiplayer/quizPool'
import { type NetEnemy, type NetMeta, type NetPlayer } from '../multiplayer/types'
import { resolveColors } from '../multiplayer/colors'
import { useInventory } from '../game3d/state/InventoryContext'
import { GEAR } from '../game3d/systems/gear'
import { useSectorProgress } from '../sectors/useSectorProgress'
import ArenaEnvironment from '../multiplayer/ArenaEnvironment'
import RemotePlayers from '../multiplayer/RemotePlayers'
import SharedEnemies, { type EnemiesHandle, type LiveEnemy } from '../multiplayer/SharedEnemies'
import MpWeapon, { type MpWeaponProfile } from '../multiplayer/MpWeapon'
import PlayerVitals from '../multiplayer/PlayerVitals'
import MultiplayerHud from '../multiplayer/MultiplayerHud'
import Cutscene from '../game3d/cutscene/Cutscene'
import '../styles/multiplayer.css'

export default function MultiplayerArenaPage() {
  const { code } = useParams()
  const { user, loading } = useAuth()

  if (loading) return <div className="world-loading">Entering the arena…</div>
  if (!user) return <Navigate to="/" replace />
  if (!isRealtimeConfigured) return <Navigate to="/play" replace />
  if (!code) return <Navigate to="/mp" replace />

  return <Arena code={code} uid={user.uid} />
}

function Arena({ code, uid }: { code: string; uid: string }) {
  const navigate = useNavigate()
  const inv = useInventory()
  // How many single-player lessons (sectors) you've cleared. This is a
  // GUARANTEED mastery boost — independent of the random reward wheel — so even
  // an unlucky single-player run still makes you stronger in the arena.
  const { views } = useSectorProgress()
  const mastery = useMemo(() => views.filter((v) => v.state === 'cleared').length, [views])

  // Buff earned from the previous intermission's quiz, applied for this round.
  const [roundBuff, setRoundBuff] = useState({ damage: 0, hp: 0 })

  // Carry single-player gear into the arena: equipped ranged weapon (or a
  // baseline pistol so you're never gun-less), plus bonus HP from armor — then
  // stack the lessons-earned mastery boost on top.
  const mpWeapon = useMemo<MpWeaponProfile>(() => {
    const w = inv.weapon
    // The big arena needs at least a usable sidearm, so the feeble starter
    // popgun floors to a Scrap Pistol here; stronger single-player guns win out.
    const floor = GEAR['plasma-pistol']
    const base =
      w.weaponKind === 'ranged' && (w.range ?? 0) >= (floor.range ?? 0) ? w : floor
    const dmgBoost = mastery * 0.5
    const cdScale = Math.max(0.6, 1 - mastery * 0.04)
    return {
      name: base.name,
      damage: (base.damage ?? 1) + dmgBoost + roundBuff.damage,
      range: (base.range ?? 13) + mastery * 0.6,
      cooldownMs: Math.round((base.cooldownMs ?? 360) * cdScale),
      aoe: base.aoe,
      color: base.color,
    }
  }, [inv.weapon, mastery, roundBuff.damage])
  const maxHp = MAX_HP + inv.bonusLives + Math.floor(mastery / 2) + roundBuff.hp

  const playersRef = useRef<Record<string, NetPlayer>>({})
  const enemiesViewRef = useRef<Map<string, LiveEnemy> | null>(null)
  const [roster, setRoster] = useState<NetPlayer[]>([])
  const [meta, setMeta] = useState<NetMeta | null>(null)
  const [enemies, setEnemies] = useState<Record<string, NetEnemy>>({})
  const rosterSig = useRef('')
  const metaSig = useRef('')
  const enemiesHandle = useRef<EnemiesHandle | null>(null)
  const presenceDone = useRef(false)
  const sawMeta = useRef(false)

  // Local lives state.
  const [hp, setHp] = useState(maxHp)
  const [dead, setDead] = useState(false)
  const [respawnAt, setRespawnAt] = useState<number | null>(null)
  const deathsRef = useRef(0)

  // Host round-resolution dedupe.
  const endedRoundRef = useRef(-1)
  const advancedRoundRef = useRef(-1)

  // Cinematic gates: a one-shot "dragged into the arena" intro, and an outro
  // when the series ends (winner escapes, the rest get swarmed).
  const [mpIntroDone, setMpIntroDone] = useState(false)
  const [endedCutDone, setEndedCutDone] = useState(false)

  const isHost = meta?.hostUid === uid
  const status = meta?.status
  const playing = status === 'playing'
  const round = meta?.round ?? 1

  // Round action begins at meta.goAt (after the countdown). Until then players
  // are frozen and everyone watches the same 3-2-1.
  const goAt = meta?.goAt

  // A ticking clock so the synced 3-2-1 countdown re-renders and "go" flips on
  // time. It stops shortly after the round goes live so we don't re-render every
  // frame for the whole match (it restarts when the next round arms a new goAt).
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    if (status !== 'playing') return
    const t = setInterval(() => {
      const now = Date.now()
      setNowTick(now)
      if (goAt && now >= goAt + 300) clearInterval(t)
    }, 150)
    return () => clearInterval(t)
  }, [status, goAt])
  const live = playing && !!goAt && nowTick >= goAt
  const inCountdown = playing && (!goAt || nowTick < goAt)
  const countdownNum = goAt ? Math.max(0, Math.ceil((goAt - nowTick) / 1000)) : null

  useEffect(() => {
    const unsub = subscribeMatch(code, (s) => {
      playersRef.current = s.players
      const m = s.meta
      const msig = m
        ? `${m.status}:${m.endsAt ?? 0}:${m.round ?? 0}:${m.intermissionEndsAt ?? 0}:${m.lastRoundWinner ?? ''}:${m.champion ?? ''}`
        : 'none'
      if (msig !== metaSig.current) {
        metaSig.current = msig
        setMeta(m)
      }
      if (m) sawMeta.current = true
      const list = Object.values(s.players).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))
      const sig = list
        .map((p) => `${p.uid}:${p.kills ?? 0}:${p.wins ?? 0}:${p.online ? 1 : 0}:${p.color ?? ''}:${p.name}`)
        .join('|')
      if (sig !== rosterSig.current) {
        rosterSig.current = sig
        setRoster(list)
      }
    })
    return () => unsub()
  }, [code])

  useEffect(() => {
    if (isHost) return
    const unsub = subscribeEnemies(code, setEnemies)
    return () => unsub()
  }, [code, isHost])

  useEffect(() => {
    if (presenceDone.current || !meta) return
    presenceDone.current = true
    attachPresence(code, uid, meta.hostUid === uid)
  }, [code, uid, meta])

  useEffect(() => {
    if (sawMeta.current && meta === null) navigate('/mp', { replace: true })
  }, [meta, navigate])

  // Apply the buff earned from the last intermission quiz when a round begins.
  useEffect(() => {
    if (status !== 'playing') return
    const tier = playersRef.current[uid]?.quiz?.tier ?? 0
    setRoundBuff(quizBuff(tier))
  }, [status, round, uid])

  // Reset local lives at the start of each round.
  useEffect(() => {
    deathsRef.current = 0
    setHp(maxHp)
    setDead(false)
    setRespawnAt(null)
  }, [round, status, maxHp])

  // --- Host: manage the round clock + first-to-N series -------------------
  useEffect(() => {
    if (!isHost) return
    if (status !== 'playing' && status !== 'intermission') return
    const targetWins = meta?.targetWins ?? 3
    const t = setInterval(() => {
      const m = meta
      if (!m) return
      const now = Date.now()
      if (m.status === 'playing' && m.endsAt && now >= m.endsAt && endedRoundRef.current !== round) {
        endedRoundRef.current = round
        // Round winner = most kills this round (tie → earliest to join).
        const ps = Object.values(playersRef.current)
        let winner: NetPlayer | null = null
        for (const p of ps) {
          if (
            !winner ||
            (p.kills ?? 0) > (winner.kills ?? 0) ||
            ((p.kills ?? 0) === (winner.kills ?? 0) && (p.joinedAt ?? 0) < (winner.joinedAt ?? 0))
          ) {
            winner = p
          }
        }
        if (winner) {
          creditWin(code, winner.uid)
          const winnerWins = (winner.wins ?? 0) + 1
          if (winnerWins >= targetWins) void finishSeries(code, winner.uid)
          else void goIntermission(code, winner.uid, now + QUIZ_INTERMISSION_MS, randomQuizId())
        }
      }
      if (m.status === 'intermission' && advancedRoundRef.current !== round) {
        // Start the next round once everyone online has answered the quiz, or
        // when the intermission times out (so one slow player can't stall it).
        const online = Object.values(playersRef.current).filter((p) => p.online)
        const allAnswered = online.length > 0 && online.every((p) => p.quiz?.answered)
        const timedOut = Boolean(m.intermissionEndsAt && now >= m.intermissionEndsAt)
        if (allAnswered || timedOut) {
          advancedRoundRef.current = round
          void nextRound(code, round + 1, ROUND_DURATION_MS, COUNTDOWN_MS)
        }
      }
    }, 400)
    return () => clearInterval(t)
  }, [isHost, status, round, code, meta])

  // --- Host: arm round 1's countdown once everyone has cleared the intro ----
  // Later rounds are armed by nextRound (no intro between them), so this only
  // fires for the unarmed opening round. A timeout fallback prevents one player
  // who never finishes loading from stalling the whole match.
  useEffect(() => {
    if (!isHost) return
    if (status !== 'playing' || meta?.goAt) return
    const startedAt = meta?.startedAt ?? Date.now()
    const t = setInterval(() => {
      const online = Object.values(playersRef.current).filter((p) => p.online)
      const everyoneReady = online.length > 0 && online.every((p) => p.introDone)
      const waitedTooLong = Date.now() - startedAt > 15000
      if (everyoneReady || waitedTooLong) {
        const go = Date.now() + COUNTDOWN_MS
        void armRound(code, go, go + ROUND_DURATION_MS)
      }
    }, 400)
    return () => clearInterval(t)
  }, [isHost, status, meta?.goAt, meta?.startedAt, code])

  // Once I've watched/skipped the intro, tell the room so the host can count us
  // all in together.
  const finishIntro = useCallback(() => {
    setMpIntroDone(true)
    setIntroDone(code, uid)
  }, [code, uid])

  // --- Local death / respawn (delay grows each death) ---------------------
  const onDeath = useCallback(() => {
    setDead((already) => {
      if (already) return already
      const prior = deathsRef.current
      deathsRef.current = prior + 1
      setRespawnAt(Date.now() + respawnDelay(prior))
      reportDeath(code, uid)
      return true
    })
  }, [code, uid])

  useEffect(() => {
    if (!dead || !respawnAt) return
    const ms = Math.max(0, respawnAt - Date.now())
    const t = setTimeout(() => {
      setDead(false)
      setRespawnAt(null)
      setHp(maxHp)
      reportRespawn(code, uid)
    }, ms)
    return () => clearTimeout(t)
  }, [dead, respawnAt, code, uid, maxHp])

  const colors = useMemo(
    () => resolveColors(Object.fromEntries(roster.map((p) => [p.uid, p]))),
    [roster],
  )
  const ids = useMemo(() => roster.map((p) => p.uid), [roster])
  const myIndex = Math.max(0, roster.findIndex((p) => p.uid === uid))
  const spawn = useMemo(() => playerSpawn(myIndex), [myIndex])
  const alive = live && !dead

  const onLeave = useCallback(async () => {
    await leaveMatch(code, uid, isHost)
    navigate('/play', { replace: true })
  }, [code, uid, isHost, navigate])

  if (status === 'ended') {
    const ranked = [...roster].sort(
      (a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.kills ?? 0) - (a.kills ?? 0),
    )
    const champ = roster.find((p) => p.uid === meta?.champion)
    if (!endedCutDone) {
      return (
        <Cutscene
          scene="mp-outro"
          data={{ winnerName: champ?.name, youWon: champ?.uid === uid }}
          onDone={() => setEndedCutDone(true)}
        />
      )
    }
    return (
      <div className="mp-results">
        <div className="mp-results-card">
          <span className="mode-eyebrow">Series over</span>
          <h1 className="mp-title">{champ ? `${champ.name} wins!` : 'Final standings'}</h1>
          <ol className="mp-results-list">
            {ranked.map((p, i) => (
              <li key={p.uid} className={`mp-results-row${p.uid === uid ? ' is-me' : ''}`}>
                <span className="mp-board-rank">{i === 0 ? '🏆' : i + 1}</span>
                <span className="mp-board-dot" style={{ background: colors[p.uid] }} />
                <span className="mp-board-name">{p.name}</span>
                <span className="mp-board-kills">{p.wins ?? 0} wins</span>
              </li>
            ))}
          </ol>
          <div className="mp-room-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/mp')}>
              Play again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/play')}>
              Main menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mp-arena">
      {/* The arena canvas only mounts after the intro cutscene unmounts, so the
          two never run as simultaneous WebGL contexts (mobile browsers refuse a
          second one, which left phones with a blank intro). */}
      {mpIntroDone && (
      <GameStateProvider>
        <GameCanvas>
          <ArenaEnvironment />
          <LocalPlayer code={code} uid={uid} spawn={spawn} frozen={!alive} />
          <RemotePlayers playersRef={playersRef} ids={ids} selfUid={uid} colors={colors} />
          <SharedEnemies
            ref={enemiesHandle}
            code={code}
            isHost={isHost}
            playing={live}
            playersRef={playersRef}
            selfUid={uid}
            enemiesSnapshot={enemies}
            viewRef={enemiesViewRef}
            roundKey={round}
          />
          <MpWeapon
            code={code}
            uid={uid}
            isHost={isHost}
            playing={alive}
            handle={enemiesHandle}
            weapon={mpWeapon}
          />
          <PlayerVitals
            enemiesViewRef={enemiesViewRef}
            playing={live}
            alive={alive}
            maxHp={maxHp}
            resetKey={round}
            onHp={setHp}
            onDeath={onDeath}
          />
        </GameCanvas>

        <MultiplayerHud
          roster={roster}
          colors={colors}
          selfUid={uid}
          endsAt={meta?.endsAt}
          round={meta?.round}
          targetWins={meta?.targetWins}
          hp={hp}
          maxHp={maxHp}
          dead={dead}
          respawnAt={respawnAt}
          playersRef={playersRef}
          enemiesViewRef={enemiesViewRef}
          ids={ids}
          weaponName={mpWeapon.name}
          power={mpWeapon.damage}
          mastery={mastery}
        />
      </GameStateProvider>
      )}

      {status === 'intermission' && (
        <Intermission
          meta={meta}
          roster={roster}
          colors={colors}
          selfUid={uid}
          code={code}
          playersRef={playersRef}
        />
      )}

      {/* Synced 3-2-1 "get ready" gate. Shows while the round is unarmed
          (waiting for everyone to load in) and during the countdown itself. */}
      {mpIntroDone && inCountdown && (
        <div className="mp-go-overlay">
          {countdownNum && countdownNum > 0 ? (
            <>
              <div className="mp-go-num">{countdownNum}</div>
              <div className="mp-go-sub">Get ready…</div>
            </>
          ) : goAt ? (
            <div className="mp-go-num mp-go-go">GO!</div>
          ) : (
            <div className="mp-go-sub mp-go-wait">Waiting for everyone to load in…</div>
          )}
        </div>
      )}

      {status !== 'playing' && status !== 'intermission' && (
        <div className="mp-countdown">Waiting for the match to start…</div>
      )}

      <button type="button" className="mp-leave" onClick={onLeave}>
        Leave
      </button>

      {!mpIntroDone && (
        <Cutscene scene="mp-intro" onDone={finishIntro} />
      )}
    </div>
  )
}

function Intermission({
  meta,
  roster,
  colors,
  selfUid,
  code,
  playersRef,
}: {
  meta: NetMeta | null
  roster: NetPlayer[]
  colors: Record<string, string>
  selfUid: string
  code: string
  playersRef: MutableRefObject<Record<string, NetPlayer>>
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])
  const left = meta?.intermissionEndsAt ? Math.max(0, Math.ceil((meta.intermissionEndsAt - now) / 1000)) : 0
  const winner = roster.find((p) => p.uid === meta?.lastRoundWinner)
  const ranked = [...roster].sort(
    (a, b) => (b.wins ?? 0) - (a.wins ?? 0) || (b.kills ?? 0) - (a.kills ?? 0),
  )
  const online = roster.filter((p) => p.online)
  const answered = online.filter((p) => playersRef.current[p.uid]?.quiz?.answered).length
  return (
    <div className="mp-intermission">
      <div className="mp-results-card">
        <span className="mode-eyebrow">Round {meta?.round} complete</span>
        <h1 className="mp-title">{winner ? `${winner.name} takes the round` : 'Round over'}</h1>

        <IntermissionQuiz code={code} uid={selfUid} quizId={meta?.quizId} />

        <ol className="mp-results-list mp-results-compact">
          {ranked.map((p) => (
            <li key={p.uid} className={`mp-results-row${p.uid === selfUid ? ' is-me' : ''}`}>
              <span className="mp-board-dot" style={{ background: colors[p.uid] }} />
              <span className="mp-board-name">{p.name}</span>
              <span className="mp-board-kills">
                {p.wins ?? 0} wins · {p.kills ?? 0} kills
              </span>
            </li>
          ))}
        </ol>
        <p className="mp-series-note">
          {answered}/{online.length} answered · next round in {left}s…
        </p>
      </div>
    </div>
  )
}

/**
 * One random problem-set question between rounds. Wrong taps cost you (they
 * count as mistakes and drop your reward tier); a clean (no-mistakes) correct
 * answer earns the biggest next-round buff. Submits once and then waits for
 * everyone else.
 */
function IntermissionQuiz({ code, uid, quizId }: { code: string; uid: string; quizId?: number }) {
  const question = useMemo(() => (quizId == null ? null : getQuizQuestion(quizId)), [quizId])
  const startRef = useRef(Date.now())
  const mistakesRef = useRef(0)
  const [wrong, setWrong] = useState<Set<string>>(new Set())
  const [done, setDone] = useState<{ tier: number } | null>(null)

  // Fresh question each intermission.
  useEffect(() => {
    startRef.current = Date.now()
    mistakesRef.current = 0
    setWrong(new Set())
    setDone(null)
  }, [quizId])

  if (!question) return null

  const choose = (id: string) => {
    if (done) return
    if (id === question.correctId) {
      const timeMs = Date.now() - startRef.current
      const tier = quizTier(true, timeMs, mistakesRef.current)
      submitQuiz(code, uid, { correct: true, timeMs, mistakes: mistakesRef.current, tier })
      setDone({ tier })
    } else {
      mistakesRef.current += 1
      setWrong((prev) => new Set(prev).add(id))
    }
  }

  const buff = done ? quizBuff(done.tier) : null

  return (
    <div className="mp-quiz">
      <div className="mp-quiz-prompt">{question.prompt}</div>
      <div className="mp-quiz-choices">
        {question.choices.map((c) => {
          const isWrong = wrong.has(c.id)
          const isPicked = Boolean(done) && c.id === question.correctId
          return (
            <button
              key={c.id}
              type="button"
              className={`mp-quiz-choice${isWrong ? ' is-wrong' : ''}${isPicked ? ' is-correct' : ''}`}
              disabled={Boolean(done) || isWrong}
              onClick={() => choose(c.id)}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      {done && (
        <p className="mp-quiz-result">
          {buff && buff.damage > 0
            ? `Nice — next round buff: +${buff.damage} power${buff.hp > 0 ? ` · +${buff.hp} HP` : ''}.`
            : 'Answered. Waiting for everyone…'}
        </p>
      )}
    </div>
  )
}

function LocalPlayer({
  code,
  uid,
  spawn,
  frozen,
}: {
  code: string
  uid: string
  spawn: { x: number; y: number; z: number }
  frozen: boolean
}) {
  const last = useRef({ t: 0, x: 0, z: 0 })
  const onMove = useCallback(
    (pos: { x: number; y: number; z: number }, heading: number) => {
      const now = performance.now()
      if (now - last.current.t < 100) return
      const moved = Math.hypot(pos.x - last.current.x, pos.z - last.current.z)
      last.current = { t: now, x: pos.x, z: pos.z }
      updatePlayerTransform(code, uid, {
        x: Math.round(pos.x * 100) / 100,
        z: Math.round(pos.z * 100) / 100,
        ry: heading,
        moving: moved > 0.05,
      })
    },
    [code, uid],
  )
  return <ThirdPersonPlayer spawn={spawn} frozen={frozen} onMove={onMove} />
}
