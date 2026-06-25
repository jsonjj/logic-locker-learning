import {
  GEAR,
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
import { useInventory } from '../state/InventoryContext'
import '../../styles/combat.css'

export interface InventoryPanelProps {
  open: boolean
  onClose: () => void
}

const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  utility: 'Utility',
}

const SLOT_ORDER: GearSlot[] = ['weapon', 'armor', 'utility']

const WEAPON_TRACKS: UpgradeTrack[] = ['damage', 'range', 'projectiles']

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
  const { owned, equipped, equip, cores } = useInventory()

  if (!open) return null

  return (
    <div className="inv-scrim" role="dialog" aria-modal="true" aria-label="Inventory" onClick={onClose}>
      <div className="inv-card" onClick={(e) => e.stopPropagation()} data-ui>
        <div className="inv-head">
          <h2>Loadout</h2>
          <span className="inv-cores" title="Tech Cores — spend on weapon upgrades">
            🔧 {cores} Cores
          </span>
          <button type="button" className="inv-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {SLOT_ORDER.map((slot) => {
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
                    return (
                      <div key={g.id} className={`inv-item${isEquipped ? ' is-equipped' : ''}`}>
                        <div className="inv-item-head">
                          <span className="inv-item-icon" style={{ color: g.color }}>
                            {g.icon}
                          </span>
                          <div className="inv-item-body">
                            <div className="inv-item-name">{g.name}</div>
                            <div className="inv-item-desc">{g.desc}</div>
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

        <p className="inv-tip">
          Tip: clear rooms to earn <b>🔧 Tech Cores</b>, then spend them here to boost a weapon's
          damage, range, and projectiles. Press <b>F</b> (or the FIRE button) to attack.
        </p>
      </div>
    </div>
  )
}
