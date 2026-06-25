import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  GEAR,
  STARTER_WEAPON,
  ZERO_UPGRADES,
  canUpgrade,
  effectiveWeapon,
  upgradeCost,
  type GearItem,
  type UpgradeLevels,
  type UpgradeTrack,
} from '../systems/gear'
import { DEFAULT_MODE, isLearningMode, type LearningMode } from '../skills'

interface EquippedState {
  weapon: string
  armor: string | null
  utility: string | null
}

interface Persisted {
  owned: string[]
  equipped: EquippedState
  /** How many times the player has finished the game (kept across replays). */
  prestige?: number
  /** The player's chosen learning style (presentation only; same content). */
  mode?: LearningMode
  /** Spendable upgrade currency earned by clearing rooms. */
  cores?: number
  /** Per-weapon purchased upgrade levels (damage / range / projectiles). */
  upgrades?: Record<string, UpgradeLevels>
}

function cleanLevels(raw: Partial<UpgradeLevels> | undefined): UpgradeLevels {
  return {
    damage: Math.max(0, Math.floor(raw?.damage ?? 0)),
    range: Math.max(0, Math.floor(raw?.range ?? 0)),
    projectiles: Math.max(0, Math.floor(raw?.projectiles ?? 0)),
  }
}

function cleanUpgrades(raw: Record<string, Partial<UpgradeLevels>> | undefined): Record<string, UpgradeLevels> {
  const out: Record<string, UpgradeLevels> = {}
  if (!raw) return out
  for (const [id, lv] of Object.entries(raw)) {
    if (GEAR[id]) out[id] = cleanLevels(lv)
  }
  return out
}

interface InventoryValue {
  owned: string[]
  equipped: EquippedState
  /** Returns true if the item was newly added. */
  addItem: (id: string) => boolean
  equip: (id: string) => void
  isOwned: (id: string) => boolean
  weapon: GearItem
  bonusLives: number
  speedMult: number
  /** Completed-run count; raises difficulty and keeps gear on replay. */
  prestige: number
  /** Bump the prestige counter (called once when the game is finished). */
  prestigeUp: () => void
  /** The global learning style (visual / narrative / handson). Same content. */
  mode: LearningMode
  /** Change the learning style (persisted; changeable any time in settings). */
  setMode: (m: LearningMode) => void
  /** Spendable upgrade currency (Tech Cores). */
  cores: number
  /** Grant upgrade currency (room clears, prestige). */
  addCores: (n: number) => void
  /** Purchased upgrade levels for a given weapon id. */
  weaponLevels: (id: string) => UpgradeLevels
  /** Buy the next level of a track for a weapon. Returns true on success. */
  upgradeWeapon: (id: string, track: UpgradeTrack) => boolean
  /** The equipped weapon's BASE stats (before upgrades), for UI comparisons. */
  baseWeapon: GearItem
}

const DEFAULT: Persisted = {
  owned: [STARTER_WEAPON],
  equipped: { weapon: STARTER_WEAPON, armor: null, utility: null },
  prestige: 0,
  mode: DEFAULT_MODE,
  cores: 0,
  upgrades: {},
}

const InventoryContext = createContext<InventoryValue | undefined>(undefined)

function storageKey(uid: string | undefined) {
  return `ll-inv-${uid ?? 'anon'}`
}

function load(uid: string | undefined): Persisted {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw) as Persisted
    const owned = Array.from(new Set([STARTER_WEAPON, ...(parsed.owned ?? [])])).filter((id) => GEAR[id])
    const eq = parsed.equipped ?? DEFAULT.equipped
    return {
      owned,
      equipped: {
        weapon: GEAR[eq.weapon] ? eq.weapon : STARTER_WEAPON,
        armor: eq.armor && GEAR[eq.armor] ? eq.armor : null,
        utility: eq.utility && GEAR[eq.utility] ? eq.utility : null,
      },
      prestige: Math.max(0, Math.floor(parsed.prestige ?? 0)),
      mode: isLearningMode(parsed.mode) ? parsed.mode : DEFAULT_MODE,
      cores: Math.max(0, Math.floor(parsed.cores ?? 0)),
      upgrades: cleanUpgrades(parsed.upgrades),
    }
  } catch {
    return DEFAULT
  }
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [owned, setOwned] = useState<string[]>(DEFAULT.owned)
  const [equipped, setEquipped] = useState<EquippedState>(DEFAULT.equipped)
  const [prestige, setPrestige] = useState<number>(0)
  const [mode, setModeState] = useState<LearningMode>(DEFAULT_MODE)
  const [cores, setCores] = useState<number>(0)
  const [upgrades, setUpgrades] = useState<Record<string, UpgradeLevels>>({})
  const loadedFor = useRef<string | undefined>(undefined)

  // (Re)load when the signed-in user changes.
  useEffect(() => {
    const data = load(uid)
    setOwned(data.owned)
    setEquipped(data.equipped)
    setPrestige(data.prestige ?? 0)
    setModeState(data.mode ?? DEFAULT_MODE)
    setCores(data.cores ?? 0)
    setUpgrades(data.upgrades ?? {})
    loadedFor.current = uid
  }, [uid])

  // Persist on change (only after the initial load for this uid).
  useEffect(() => {
    if (loadedFor.current !== uid) return
    try {
      localStorage.setItem(
        storageKey(uid),
        JSON.stringify({ owned, equipped, prestige, mode, cores, upgrades }),
      )
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [owned, equipped, prestige, mode, cores, upgrades, uid])

  const addItem = useCallback((id: string): boolean => {
    if (!GEAR[id]) return false
    let added = false
    setOwned((prev) => {
      if (prev.includes(id)) return prev
      added = true
      return [...prev, id]
    })
    return added
  }, [])

  const equip = useCallback((id: string) => {
    const item = GEAR[id]
    if (!item) return
    setEquipped((prev) => ({ ...prev, [item.slot]: id }))
  }, [])

  const isOwned = useCallback((id: string) => owned.includes(id), [owned])

  const prestigeUp = useCallback(() => setPrestige((p) => p + 1), [])

  const setMode = useCallback((m: LearningMode) => {
    if (isLearningMode(m)) setModeState(m)
  }, [])

  const addCores = useCallback((n: number) => {
    if (!Number.isFinite(n) || n <= 0) return
    setCores((c) => c + Math.floor(n))
  }, [])

  const weaponLevels = useCallback(
    (id: string): UpgradeLevels => upgrades[id] ?? ZERO_UPGRADES,
    [upgrades],
  )

  const upgradeWeapon = useCallback(
    (id: string, track: UpgradeTrack): boolean => {
      const base = GEAR[id]
      if (!base) return false
      const levels = upgrades[id] ?? ZERO_UPGRADES
      if (!canUpgrade(base, levels, track)) return false
      const cost = upgradeCost(track, levels[track])
      if (cores < cost) return false
      setCores((c) => c - cost)
      setUpgrades((prev) => {
        const cur = prev[id] ?? ZERO_UPGRADES
        return { ...prev, [id]: { ...cur, [track]: (cur[track] ?? 0) + 1 } }
      })
      return true
    },
    [upgrades, cores],
  )

  const value = useMemo<InventoryValue>(() => {
    const base = GEAR[equipped.weapon] ?? GEAR[STARTER_WEAPON]
    const weapon = effectiveWeapon(base, upgrades[equipped.weapon] ?? ZERO_UPGRADES)
    const armor = equipped.armor ? GEAR[equipped.armor] : undefined
    const utility = equipped.utility ? GEAR[equipped.utility] : undefined
    const bonusLives = (armor?.bonusLives ?? 0) + (utility?.bonusLives ?? 0)
    const speedMult = utility?.speedMult ?? 1
    return {
      owned,
      equipped,
      addItem,
      equip,
      isOwned,
      weapon,
      baseWeapon: base,
      bonusLives,
      speedMult,
      prestige,
      prestigeUp,
      mode,
      setMode,
      cores,
      addCores,
      weaponLevels,
      upgradeWeapon,
    }
  }, [
    owned,
    equipped,
    addItem,
    equip,
    isOwned,
    prestige,
    prestigeUp,
    mode,
    setMode,
    cores,
    upgrades,
    addCores,
    weaponLevels,
    upgradeWeapon,
  ])

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInventory(): InventoryValue {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used within an InventoryProvider')
  return ctx
}
