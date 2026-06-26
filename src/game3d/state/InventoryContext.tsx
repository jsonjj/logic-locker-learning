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

/** Minecraft-style quick bar: up to 9 ordered slots (weapons or consumables). */
export const HOTBAR_SIZE = 9

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
  /** Ordered quick-bar of item ids (weapon or consumable), length HOTBAR_SIZE. */
  hotbar?: (string | null)[]
  /** Stackable consumable counts, keyed by item id. */
  consumables?: Record<string, number>
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

function cleanConsumables(raw: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw) return out
  for (const [id, n] of Object.entries(raw)) {
    const item = GEAR[id]
    if (item && item.slot === 'consumable') {
      const count = Math.max(0, Math.floor(n))
      if (count > 0) out[id] = count
    }
  }
  return out
}

/** Build the default quick-bar: owned weapons laid out in order, padded to 9. */
function defaultHotbar(owned: string[]): (string | null)[] {
  const weapons = owned.filter((id) => GEAR[id]?.slot === 'weapon').slice(0, HOTBAR_SIZE)
  const bar: (string | null)[] = weapons.slice()
  while (bar.length < HOTBAR_SIZE) bar.push(null)
  return bar
}

/** Validate / normalize a persisted quick-bar against what the player owns. */
function cleanHotbar(
  raw: (string | null)[] | undefined,
  owned: string[],
  consumables: Record<string, number>,
): (string | null)[] {
  if (!Array.isArray(raw)) return defaultHotbar(owned)
  const ownedSet = new Set(owned)
  const bar: (string | null)[] = []
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const id = raw[i]
    if (!id || !GEAR[id]) {
      bar.push(null)
      continue
    }
    const item = GEAR[id]
    // A slot is valid if it's an owned weapon or a known consumable.
    if (item.slot === 'weapon' && ownedSet.has(id)) bar.push(id)
    else if (item.slot === 'consumable' && id in consumables) bar.push(id)
    else bar.push(null)
  }
  // If a migrated bar ended up entirely empty but the player owns weapons, seed it.
  if (bar.every((s) => s === null)) return defaultHotbar(owned)
  return bar
}

/** Place an id into the first empty quick-bar slot if it isn't already there. */
function withItemPlaced(bar: (string | null)[], id: string): (string | null)[] {
  if (bar.includes(id)) return bar
  const idx = bar.indexOf(null)
  if (idx < 0) return bar
  const next = bar.slice()
  next[idx] = id
  return next
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
  /** Armor shield points from equipped armor (absorbs hits before health). */
  armorPoints: number
  /** Ordered quick-bar (length HOTBAR_SIZE); entries are item ids or null. */
  hotbar: (string | null)[]
  /** Place/clear a quick-bar slot (e.g. drag-and-drop assignment). */
  setHotbarSlot: (index: number, id: string | null) => void
  /** Reorder the quick-bar by moving one slot to another position. */
  moveHotbar: (from: number, to: number) => void
  /** Stackable consumable counts, keyed by item id. */
  consumables: Record<string, number>
  /** How many of a consumable the player is carrying. */
  consumableCount: (id: string) => number
  /** Buy one consumable with Tech Cores; auto-adds to the bar. Returns success. */
  buyConsumable: (id: string) => boolean
  /** Grant consumables for free (room-clear drops); auto-adds to the bar. */
  addConsumable: (id: string, n?: number) => void
  /** Spend one consumable. Returns the item (with its heal value) or null. */
  useConsumable: (id: string) => GearItem | null
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
  hotbar: defaultHotbar([STARTER_WEAPON]),
  consumables: {},
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
    const consumables = cleanConsumables(parsed.consumables)
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
      consumables,
      hotbar: cleanHotbar(parsed.hotbar, owned, consumables),
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
  const [hotbar, setHotbar] = useState<(string | null)[]>(DEFAULT.hotbar ?? [])
  const [consumables, setConsumables] = useState<Record<string, number>>({})
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
    setConsumables(data.consumables ?? {})
    setHotbar(data.hotbar ?? defaultHotbar(data.owned))
    loadedFor.current = uid
  }, [uid])

  // Persist on change (only after the initial load for this uid).
  useEffect(() => {
    if (loadedFor.current !== uid) return
    try {
      localStorage.setItem(
        storageKey(uid),
        JSON.stringify({ owned, equipped, prestige, mode, cores, upgrades, hotbar, consumables }),
      )
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [owned, equipped, prestige, mode, cores, upgrades, hotbar, consumables, uid])

  const addItem = useCallback((id: string): boolean => {
    if (!GEAR[id]) return false
    let added = false
    setOwned((prev) => {
      if (prev.includes(id)) return prev
      added = true
      return [...prev, id]
    })
    // New weapons auto-drop into the first open quick-bar slot.
    if (GEAR[id].slot === 'weapon') setHotbar((bar) => withItemPlaced(bar, id))
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

  const consumableCount = useCallback((id: string) => consumables[id] ?? 0, [consumables])

  const buyConsumable = useCallback(
    (id: string): boolean => {
      const item = GEAR[id]
      if (!item || item.slot !== 'consumable') return false
      const cost = item.cost ?? 0
      if (cores < cost) return false
      setCores((c) => c - cost)
      setConsumables((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
      setHotbar((bar) => withItemPlaced(bar, id))
      return true
    },
    [cores],
  )

  const addConsumable = useCallback((id: string, n = 1) => {
    const item = GEAR[id]
    if (!item || item.slot !== 'consumable') return
    const add = Math.max(1, Math.floor(n))
    setConsumables((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + add }))
    setHotbar((bar) => withItemPlaced(bar, id))
  }, [])

  const useConsumable = useCallback(
    (id: string): GearItem | null => {
      const item = GEAR[id]
      if (!item || item.slot !== 'consumable') return null
      if ((consumables[id] ?? 0) <= 0) return null
      setConsumables((prev) => {
        const left = (prev[id] ?? 0) - 1
        const next = { ...prev }
        if (left <= 0) delete next[id]
        else next[id] = left
        return next
      })
      return item
    },
    [consumables],
  )

  const setHotbarSlot = useCallback((index: number, id: string | null) => {
    if (index < 0 || index >= HOTBAR_SIZE) return
    if (id !== null && !GEAR[id]) return
    setHotbar((bar) => {
      const next = bar.slice()
      // Keep each item in a single slot: clear any existing copy first.
      if (id !== null) {
        for (let i = 0; i < next.length; i++) if (next[i] === id) next[i] = null
      }
      next[index] = id
      return next
    })
  }, [])

  const moveHotbar = useCallback((from: number, to: number) => {
    if (from === to) return
    if (from < 0 || from >= HOTBAR_SIZE || to < 0 || to >= HOTBAR_SIZE) return
    setHotbar((bar) => {
      const next = bar.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const value = useMemo<InventoryValue>(() => {
    const base = GEAR[equipped.weapon] ?? GEAR[STARTER_WEAPON]
    const weapon = effectiveWeapon(base, upgrades[equipped.weapon] ?? ZERO_UPGRADES)
    const armor = equipped.armor ? GEAR[equipped.armor] : undefined
    const utility = equipped.utility ? GEAR[equipped.utility] : undefined
    const bonusLives = (armor?.bonusLives ?? 0) + (utility?.bonusLives ?? 0)
    const speedMult = utility?.speedMult ?? 1
    const armorPoints = armor?.armorPoints ?? 0
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
      armorPoints,
      hotbar,
      setHotbarSlot,
      moveHotbar,
      consumables,
      consumableCount,
      buyConsumable,
      addConsumable,
      useConsumable,
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
    hotbar,
    setHotbarSlot,
    moveHotbar,
    consumables,
    consumableCount,
    buyConsumable,
    addConsumable,
    useConsumable,
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
