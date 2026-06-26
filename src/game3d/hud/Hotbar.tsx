import { GEAR } from '../systems/gear'
import { useInventory, HOTBAR_SIZE } from '../state/InventoryContext'
import '../../styles/combat.css'

interface HotbarProps {
  /** Activate slot N (equip weapon / use consumable). Wire to useHotbar's return. */
  onActivate: (index: number) => void
}

/**
 * On-screen Minecraft-style quick bar. Tap a slot (or press its number key) to
 * equip that weapon or use that consumable. Reordering/assignment happens in the
 * full inventory; this bar is purely for fast switching during a fight.
 */
export default function Hotbar({ onActivate }: HotbarProps) {
  const { hotbar, equipped, consumables } = useInventory()

  return (
    <div className="hotbar" role="toolbar" aria-label="Quick bar">
      {Array.from({ length: HOTBAR_SIZE }, (_, i) => {
        const id = hotbar[i]
        const item = id ? GEAR[id] : null
        const isWeapon = item?.slot === 'weapon'
        const isConsumable = item?.slot === 'consumable'
        const active = isWeapon && equipped.weapon === id
        const count = isConsumable && id ? consumables[id] ?? 0 : 0
        const depleted = isConsumable && count <= 0
        return (
          <button
            type="button"
            key={i}
            className={`hotbar-slot${active ? ' is-active' : ''}${depleted ? ' is-depleted' : ''}${
              item ? '' : ' is-empty'
            }`}
            data-ui
            aria-pressed={active}
            onClick={() => onActivate(i)}
            disabled={!item || depleted}
            title={item ? item.name : `Slot ${i + 1} — empty`}
            aria-label={item ? `${item.name} (key ${i + 1})` : `Empty slot ${i + 1}`}
          >
            {active && <span className="hotbar-cursor" aria-hidden="true" />}
            <span className="hotbar-key">{i + 1}</span>
            {item ? (
              <span className="hotbar-icon" style={{ color: item.color }}>
                {item.icon}
              </span>
            ) : (
              <span className="hotbar-icon hotbar-icon-empty" aria-hidden="true" />
            )}
            {isConsumable && <span className="hotbar-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
