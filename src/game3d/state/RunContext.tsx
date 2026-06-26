import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

interface RunValue {
  lives: number
  maxLives: number
  /** Armor shield points currently buffering hits (absorbed before lives). */
  shield: number
  maxShield: number
  isGameOver: boolean
  /** Lose one life outright (story/script damage; ignores the shield). Returns remaining. */
  loseLife: () => number
  /**
   * Take combat damage: the armor shield soaks it first, then lives. Returns the
   * number of lives left (shield damage doesn't cost a life).
   */
  takeHit: (dmg?: number) => number
  /** Heal up to maxLives (does not refill the shield). */
  gainLife: (n?: number) => void
  /** Start/refresh a run with a life cap (+ optional armor shield). Full-heals both. */
  startRun: (maxLives: number, maxShield?: number) => void
  /** Refill the armor shield to a new max WITHOUT touching lives (per-room recharge). */
  rechargeShield: (maxShield: number) => void
}

const BASE_LIVES = 3

const RunContext = createContext<RunValue | undefined>(undefined)

export function RunProvider({ children }: { children: ReactNode }) {
  const [maxLives, setMaxLives] = useState(BASE_LIVES)
  const [lives, setLives] = useState(BASE_LIVES)
  const [maxShield, setMaxShield] = useState(0)
  const [shield, setShield] = useState(0)

  // Refs mirror state so the damage math reads accurate values at call time
  // (setState updaters aren't guaranteed to run synchronously).
  const livesRef = useRef(BASE_LIVES)
  const maxLivesRef = useRef(BASE_LIVES)
  const shieldRef = useRef(0)
  livesRef.current = lives
  maxLivesRef.current = maxLives
  shieldRef.current = shield

  const loseLife = useCallback((): number => {
    livesRef.current = Math.max(0, livesRef.current - 1)
    setLives(livesRef.current)
    return livesRef.current
  }, [])

  const takeHit = useCallback((dmg = 1): number => {
    let d = Math.max(1, Math.floor(dmg))
    const absorbed = Math.min(shieldRef.current, d)
    if (absorbed > 0) {
      shieldRef.current -= absorbed
      setShield(shieldRef.current)
      d -= absorbed
    }
    if (d > 0) {
      livesRef.current = Math.max(0, livesRef.current - d)
      setLives(livesRef.current)
    }
    return livesRef.current
  }, [])

  const gainLife = useCallback((n = 1) => {
    livesRef.current = Math.min(maxLivesRef.current, livesRef.current + Math.max(1, Math.floor(n)))
    setLives(livesRef.current)
  }, [])

  const startRun = useCallback((max: number, maxShieldArg = 0) => {
    const m = Math.max(1, max)
    const sh = Math.max(0, Math.floor(maxShieldArg))
    maxLivesRef.current = m
    livesRef.current = m
    shieldRef.current = sh
    setMaxLives(m)
    setLives(m)
    setMaxShield(sh)
    setShield(sh)
  }, [])

  const rechargeShield = useCallback((maxShieldArg: number) => {
    const sh = Math.max(0, Math.floor(maxShieldArg))
    shieldRef.current = sh
    setMaxShield(sh)
    setShield(sh)
  }, [])

  const value = useMemo<RunValue>(
    () => ({
      lives,
      maxLives,
      shield,
      maxShield,
      isGameOver: lives <= 0,
      loseLife,
      takeHit,
      gainLife,
      startRun,
      rechargeShield,
    }),
    [lives, maxLives, shield, maxShield, loseLife, takeHit, gainLife, startRun, rechargeShield],
  )

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRun(): RunValue {
  const ctx = useContext(RunContext)
  if (!ctx) throw new Error('useRun must be used within a RunProvider')
  return ctx
}
