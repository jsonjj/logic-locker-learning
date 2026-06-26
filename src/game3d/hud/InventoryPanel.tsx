import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  GEAR,
  CONSUMABLES,
  UPGRADE_CAP,
  UPGRADE_ICON,
  UPGRADE_LABEL,
  canUpgrade,
  effectiveWeapon,
  trackApplies,
  upgradeCost,
  type GearItem,
  type GearSlot,
  type UpgradeTrack,
} from '../systems/gear'
import { useInventory, HOTBAR_SIZE } from '../state/InventoryContext'
import '../../styles/combat.css'

export interface InventoryPanelProps {
  open: boolean
  onClose: () => void
}

const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  utility: 'Utility',
  consumable: 'Consumables',
}

const EQUIP_SLOTS: ('weapon' | 'armor' | 'utility')[] = ['weapon', 'armor', 'utility']

const WEAPON_TRACKS: UpgradeTrack[] = ['damage', 'range', 'projectiles']

/** What's being dragged: an item from the grid, or an existing quick-bar slot. */
type DragPayload = { kind: 'item'; id: string } | { kind: 'slot'; index: number }
interface DragState {
  payload: DragPayload
  x: number
  y: number
}

/** Weapon stat readout + upgrade tracks — shown on the focused detail screen. */
function WeaponUpgrades({ base }: { base: GearItem }) {
  const { cores, weaponLevels, upgradeWeapon } = useInventory()
  const levels = weaponLevels(base.id)
  const eff = effectiveWeapon(base, levels)
  const tracks = WEAPON_TRACKS.filter((t) => trackApplies(base, t))

  return (
    <div className="inv-upgrades">
      <div className="inv-stats">
        <span className="inv-stat">⚔️ {eff.damage ?? 1} dmg</span>
        <span className="inv-stat">📏 {Math.round(eff.range ?? 0)} m</span>
        {trackApplies(base, 'projectiles') && (
          <span className="inv-stat">✳️ {eff.projectiles ?? 1}× shots</span>
        )}
        {base.aoe ? <span className="inv-stat">💥 {base.aoe} m blast</span> : null}
      </div>
      <div className="inv-tracks">
        {tracks.map((track) => {
          const lv = levels[track] ?? 0
          const cap = UPGRADE_CAP[track]
          const maxed = lv >= cap
          const cost = upgradeCost(track, lv)
          const affordable = cores >= cost
          const can = canUpgrade(base, levels, track) && affordable
          return (
            <div key={track} className="inv-track">
              <span className="inv-track-name">
                {UPGRADE_ICON[track]} {UPGRADE_LABEL[track]}
              </span>
              <span className="inv-pips" aria-label={`${lv} of ${cap}`}>
                {Array.from({ length: cap }, (_, i) => (
                  <span key={i} className={`inv-pip${i < lv ? ' on' : ''}`} />
                ))}
              </span>
              <button
                type="button"
                className="inv-buy"
                onClick={() => upgradeWeapon(base.id, track)}
                disabled={!can}
                title={maxed ? 'Maxed out' : affordable ? `Costs ${cost} cores` : 'Not enough cores'}
              >
                {maxed ? 'MAX' : `+ ${cost}🔧`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function InventoryPanel({ open, onClose }: InventoryPanelProps) {
  const {
    owned,
    equipped,
    equip,
    cores,
    hotbar,
    setHotbarSlot,
    moveHotbar,
    consumableCount,
    buyConsumable,
  } = useInventory()
  const [drag, setDrag] = useState<DragState | null>(null)
  // The item whose detail/upgrade screen is open (null = the compact list view).
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!open) return null

  const close = () => {
    setSelectedId(null)
    onClose()
  }

  const handleDrop = (payload: DragPayload, targetIndex: number) => {
    if (payload.kind === 'item') {
      if (targetIndex >= 0) setHotbarSlot(targetIndex, payload.id)
    } else if (targetIndex >= 0) {
      moveHotbar(payload.index, targetIndex)
    } else {
      // Dragged a slot off the bar → clear it.
      setHotbarSlot(payload.index, null)
    }
  }

  // Quick-bar slots drag immediately (reorder / drag-off to remove).
  const startSlotDrag = (payload: DragPayload, e: ReactPointerEvent) => {
    e.preventDefault()
    setDrag({ payload, x: e.clientX, y: e.clientY })
    const onMove = (ev: PointerEvent) =>
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const slotEl = el?.closest('[data-hotslot]') as HTMLElement | null
      const targetIndex = slotEl ? Number(slotEl.getAttribute('data-hotslot')) : -1
      handleDrop(payload, targetIndex)
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // Tiles distinguish a tap (open detail) from a drag (assign to the quick bar)
  // by movement threshold, so one control does both without a click/drag clash.
  const startTile = (payload: DragPayload, onTap: () => void) => (e: ReactPointerEvent) => {
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    let dragging = false
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        dragging = true
        setDrag({ payload, x: ev.clientX, y: ev.clientY })
      } else if (dragging) {
        setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))
      }
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (dragging) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)
        const slotEl = el?.closest('[data-hotslot]') as HTMLElement | null
        const targetIndex = slotEl ? Number(slotEl.getAttribute('data-hotslot')) : -1
        handleDrop(payload, targetIndex)
        setDrag(null)
      } else {
        onTap()
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const onBar = (id: string) => hotbar.includes(id)
  const barFull = hotbar.every((s) => s != null)
  const addToBar = (id: string) => {
    if (onBar(id)) return
    const idx = hotbar.findIndex((s) => s == null)
    if (idx >= 0) setHotbarSlot(idx, id)
  }

  const dragItem =
    drag?.payload.kind === 'item'
      ? GEAR[drag.payload.id]
      : drag
        ? GEAR[hotbar[drag.payload.index] ?? '']
        : undefined

  const selected = selectedId ? GEAR[selectedId] : null

  return (
    <div className="inv-scrim" role="dialog" aria-modal="true" aria-label="Inventory" onClick={close}>
      <div className="inv-card" onClick={(e) => e.stopPropagation()} data-ui>
        <div className="inv-head">
          <h2>Loadout</h2>
          <span className="inv-cores" title="Tech Cores — spend on upgrades & consumables">
            🔧 {cores} Cores
          </span>
          <button type="button" className="inv-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {selected ? (
          /* ---------- Focused detail / upgrade screen ---------- */
          <DetailScreen
            item={selected}
            equipped={equipped[selected.slot as 'weapon' | 'armor' | 'utility'] === selected.id}
            count={consumableCount(selected.id)}
            cores={cores}
            onBack={() => setSelectedId(null)}
            onEquip={() => equip(selected.id)}
            onBuy={() => buyConsumable(selected.id)}
            onAddToBar={() => addToBar(selected.id)}
            canAddToBar={!onBar(selected.id) && !barFull}
            onBar={onBar(selected.id)}
          />
        ) : (
          /* ---------- Compact list view ---------- */
          <>
            {/* Quick bar editor (drag-and-drop), pinned at the top. */}
            <section className="inv-section">
              <h3 className="inv-section-title">
                Quick Bar
                <span className="inv-section-hint">tap in-game or 1–9 · drag items here to arrange</span>
              </h3>
              <div className="inv-hotedit">
                {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
                  const id = hotbar[i]
                  const item = id ? GEAR[id] : null
                  const count = item?.slot === 'consumable' && id ? consumableCount(id) : 0
                  const dragging = drag?.payload.kind === 'slot' && drag.payload.index === i
                  return (
                    <div
                      key={i}
                      className={`inv-hotslot${item ? '' : ' is-empty'}${dragging ? ' is-dragging' : ''}`}
                      data-hotslot={i}
                      onPointerDown={item ? (e) => startSlotDrag({ kind: 'slot', index: i }, e) : undefined}
                      title={item ? `${item.name} — drag to reorder, drag off to remove` : `Slot ${i + 1}`}
                    >
                      <span className="inv-hotslot-key">{i + 1}</span>
                      {item ? (
                        <span className="inv-hotslot-icon" style={{ color: item.color }}>
                          {item.icon}
                        </span>
                      ) : (
                        <span className="inv-hotslot-empty" aria-hidden="true" />
                      )}
                      {item?.slot === 'consumable' && <span className="inv-hotslot-count">{count}</span>}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Owned gear, grouped — compact tiles. Click a tile to open its screen. */}
            {EQUIP_SLOTS.map((slot) => {
              const items = owned.map((id) => GEAR[id]).filter((g) => g && g.slot === slot)
              if (items.length === 0) return null
              return (
                <section key={slot} className="inv-section">
                  <h3 className="inv-section-title">{SLOT_LABEL[slot]}</h3>
                  <div className="inv-tiles">
                    {items.map((g) => {
                      const isEquipped = equipped[slot] === g.id
                      const draggable = slot === 'weapon'
                      const open = () => setSelectedId(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          className={`inv-tile${isEquipped ? ' is-equipped' : ''}`}
                          onPointerDown={draggable ? startTile({ kind: 'item', id: g.id }, open) : undefined}
                          onClick={draggable ? undefined : open}
                          title={g.name}
                        >
                          {isEquipped && <span className="inv-tile-tag">ON</span>}
                          <span className="inv-tile-icon" style={{ color: g.color }}>
                            {g.icon}
                          </span>
                          <span className="inv-tile-name">{g.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {/* Consumables — tiles for the whole catalog; buy from the detail screen. */}
            <section className="inv-section">
              <h3 className="inv-section-title">
                {SLOT_LABEL.consumable}
                <span className="inv-section-hint">tap to view & buy · use from the quick bar (1–9)</span>
              </h3>
              <div className="inv-tiles">
                {CONSUMABLES.map((g) => {
                  const count = consumableCount(g.id)
                  const open = () => setSelectedId(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className="inv-tile"
                      onPointerDown={count > 0 ? startTile({ kind: 'item', id: g.id }, open) : undefined}
                      onClick={count > 0 ? undefined : open}
                      title={g.name}
                    >
                      {count > 0 && <span className="inv-tile-badge">×{count}</span>}
                      <span className="inv-tile-icon" style={{ color: g.color }}>
                        {g.icon}
                      </span>
                      <span className="inv-tile-name">{g.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <p className="inv-tip">
              Tap any item to see its stats and upgrade it. Build a <b>Quick Bar</b> (drag items up
              top), then switch fast with <b>1–9</b>. Clear rooms for <b>🔧 Tech Cores</b>.
            </p>
          </>
        )}
      </div>

      {drag && dragItem && (
        <div className="inv-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <span style={{ color: dragItem.color }}>{dragItem.icon}</span>
        </div>
      )}
    </div>
  )
}

interface DetailScreenProps {
  item: GearItem
  equipped: boolean
  count: number
  cores: number
  onBack: () => void
  onEquip: () => void
  onBuy: () => void
  onAddToBar: () => void
  canAddToBar: boolean
  onBar: boolean
}

/** A single item's focused screen: stats, upgrades, and equip/buy/assign actions. */
function DetailScreen({
  item,
  equipped,
  count,
  cores,
  onBack,
  onEquip,
  onBuy,
  onAddToBar,
  canAddToBar,
  onBar,
}: DetailScreenProps) {
  const slot = item.slot
  const isConsumable = slot === 'consumable'
  const cost = item.cost ?? 0
  const affordable = cores >= cost

  return (
    <section className="inv-section">
      <button type="button" className="inv-back" onClick={onBack}>
        ‹ Back to items
      </button>

      <div className={`inv-item${equipped ? ' is-equipped' : ''}`}>
        <div className="inv-item-head">
          <span className="inv-item-icon" style={{ color: item.color }}>
            {item.icon}
          </span>
          <div className="inv-item-body">
            <div className="inv-item-name">{item.name}</div>
            <div className="inv-item-desc">{item.desc}</div>
          </div>
        </div>

        {slot === 'weapon' && <WeaponUpgrades base={item} />}

        {slot === 'armor' && item.armorPoints ? (
          <div className="inv-stats">
            <span className="inv-stat">🛡️ {item.armorPoints} shield</span>
          </div>
        ) : null}

        {slot === 'utility' && (item.speedMult || item.bonusLives) ? (
          <div className="inv-stats">
            {item.speedMult ? <span className="inv-stat">🥾 ×{item.speedMult} speed</span> : null}
            {item.bonusLives ? <span className="inv-stat">❤️ +{item.bonusLives} life</span> : null}
          </div>
        ) : null}

        {isConsumable ? (
          <div className="inv-stats">
            <span className="inv-stat">❤️ +{item.heal} heal</span>
            <span className="inv-stat">🎒 ×{count} owned</span>
          </div>
        ) : null}

        <div className="inv-detail-actions">
          {isConsumable ? (
            <button
              type="button"
              className="inv-equip"
              onClick={onBuy}
              disabled={!affordable}
              title={affordable ? `Buy for ${cost} cores` : 'Not enough cores'}
            >
              Buy {cost}🔧
            </button>
          ) : (
            <button
              type="button"
              className={`inv-equip${equipped ? ' is-on' : ''}`}
              onClick={onEquip}
              disabled={equipped}
            >
              {equipped ? 'Equipped' : 'Equip'}
            </button>
          )}

          {(slot === 'weapon' || isConsumable) && (
            <button
              type="button"
              className="inv-addbar"
              onClick={onAddToBar}
              disabled={!canAddToBar}
              title={onBar ? 'Already on the quick bar' : canAddToBar ? 'Add to the quick bar' : 'Quick bar is full'}
            >
              {onBar ? '✓ On bar' : '+ Quick bar'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
