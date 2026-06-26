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

  if (!open) return null

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

  const startDrag = (payload: DragPayload, e: ReactPointerEvent) => {
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

  const dragItem =
    drag?.payload.kind === 'item'
      ? GEAR[drag.payload.id]
      : drag
        ? GEAR[hotbar[drag.payload.index] ?? '']
        : undefined

  return (
    <div className="inv-scrim" role="dialog" aria-modal="true" aria-label="Inventory" onClick={onClose}>
      <div className="inv-card" onClick={(e) => e.stopPropagation()} data-ui>
        <div className="inv-head">
          <h2>Loadout</h2>
          <span className="inv-cores" title="Tech Cores — spend on upgrades & consumables">
            🔧 {cores} Cores
          </span>
          <button type="button" className="inv-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Quick bar editor (drag-and-drop). */}
        <section className="inv-section">
          <h3 className="inv-section-title">
            Quick Bar
            <span className="inv-section-hint">tap in-game or press 1–9 · drag items here to arrange</span>
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
                  onPointerDown={item ? (e) => startDrag({ kind: 'slot', index: i }, e) : undefined}
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

        {/* Equippable gear: weapons / armor / utility. */}
        {EQUIP_SLOTS.map((slot) => {
          const items = owned.map((id) => GEAR[id]).filter((g) => g && g.slot === slot)
          return (
            <section key={slot} className="inv-section">
              <h3 className="inv-section-title">{SLOT_LABEL[slot]}</h3>
              {items.length === 0 ? (
                <p className="inv-empty">Nothing yet — clear rooms and explore to find gear.</p>
              ) : (
                <div className="inv-grid">
                  {items.map((g) => {
                    const isEquipped = equipped[slot] === g.id
                    const draggable = slot === 'weapon'
                    return (
                      <div key={g.id} className={`inv-item${isEquipped ? ' is-equipped' : ''}`}>
                        <div className="inv-item-head">
                          <span
                            className={`inv-item-icon${draggable ? ' is-draggable' : ''}`}
                            style={{ color: g.color }}
                            onPointerDown={draggable ? (e) => startDrag({ kind: 'item', id: g.id }, e) : undefined}
                            title={draggable ? 'Drag to a quick-bar slot' : undefined}
                          >
                            {g.icon}
                          </span>
                          <div className="inv-item-body">
                            <div className="inv-item-name">{g.name}</div>
                            <div className="inv-item-desc">{g.desc}</div>
                            {slot === 'armor' && g.armorPoints ? (
                              <div className="inv-stats">
                                <span className="inv-stat">🛡️ {g.armorPoints} shield</span>
                              </div>
                            ) : null}
                            {slot === 'utility' && (g.speedMult || g.bonusLives) ? (
                              <div className="inv-stats">
                                {g.speedMult ? (
                                  <span className="inv-stat">🥾 ×{g.speedMult} speed</span>
                                ) : null}
                                {g.bonusLives ? (
                                  <span className="inv-stat">❤️ +{g.bonusLives} life</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className={`inv-equip${isEquipped ? ' is-on' : ''}`}
                            onClick={() => equip(g.id)}
                            disabled={isEquipped}
                          >
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                        </div>
                        {slot === 'weapon' && <WeaponUpgrades base={g} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}

        {/* Consumables shop: buy with cores, stack, drag onto the quick bar. */}
        <section className="inv-section">
          <h3 className="inv-section-title">
            {SLOT_LABEL.consumable}
            <span className="inv-section-hint">buy with cores · use from the quick bar (1–9)</span>
          </h3>
          <div className="inv-grid">
            {CONSUMABLES.map((g) => {
              const count = consumableCount(g.id)
              const cost = g.cost ?? 0
              const affordable = cores >= cost
              return (
                <div key={g.id} className="inv-item">
                  <div className="inv-item-head">
                    <span
                      className={`inv-item-icon${count > 0 ? ' is-draggable' : ''}`}
                      style={{ color: g.color }}
                      onPointerDown={count > 0 ? (e) => startDrag({ kind: 'item', id: g.id }, e) : undefined}
                      title={count > 0 ? 'Drag to a quick-bar slot' : undefined}
                    >
                      {g.icon}
                      {count > 0 && <span className="inv-item-badge">×{count}</span>}
                    </span>
                    <div className="inv-item-body">
                      <div className="inv-item-name">{g.name}</div>
                      <div className="inv-item-desc">{g.desc}</div>
                      <div className="inv-stats">
                        <span className="inv-stat">❤️ +{g.heal} heal</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inv-equip"
                      onClick={() => buyConsumable(g.id)}
                      disabled={!affordable}
                      title={affordable ? `Buy for ${cost} cores` : 'Not enough cores'}
                    >
                      Buy {cost}🔧
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <p className="inv-tip">
          Tip: build a <b>Quick Bar</b> of up to 9 weapons & healing items, then switch fast with{' '}
          <b>1–9</b> (or tap the bar). Clear rooms to earn <b>🔧 Tech Cores</b> for weapon upgrades,
          armor, and consumables. Press <b>F</b> to fire.
        </p>
      </div>

      {drag && dragItem && (
        <div
          className="inv-drag-ghost"
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          <span style={{ color: dragItem.color }}>{dragItem.icon}</span>
        </div>
      )}
    </div>
  )
}
