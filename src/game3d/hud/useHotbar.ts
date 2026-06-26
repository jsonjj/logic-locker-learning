import { useCallback, useEffect } from 'react'
import { GEAR, type GearItem } from '../systems/gear'
import { useInventory } from '../state/InventoryContext'

interface UseHotbarOpts {
  /** When false the 1-9 keys are ignored (menu / puzzle open, game over, etc.). */
  enabled: boolean
  /** Apply a used consumable's heal here (lives in SP, HP in MP). */
  onUseConsumable?: (item: GearItem) => void
}

/**
 * Minecraft-style quick bar control: binds number keys 1-9 to the hotbar and
 * returns an `activate(index)` you can also call from on-screen taps. Activating
 * a weapon slot equips it; a consumable slot spends one and fires onUseConsumable.
 * Mirrors the game's input discipline — it only listens while `enabled`, so it
 * auto-detaches when a menu/puzzle opens.
 */
export function useHotbar({ enabled, onUseConsumable }: UseHotbarOpts) {
  // Aliased so the rules-of-hooks lint doesn't mistake this context method for a hook.
  const { hotbar, equip, isOwned, useConsumable: spendConsumable } = useInventory()

  const activate = useCallback(
    (index: number) => {
      const id = hotbar[index]
      if (!id) return
      const item = GEAR[id]
      if (!item) return
      if (item.slot === 'weapon') {
        if (isOwned(id)) equip(id)
      } else if (item.slot === 'consumable') {
        const used = spendConsumable(id)
        if (used) onUseConsumable?.(used)
      }
    },
    [hotbar, equip, isOwned, spendConsumable, onUseConsumable],
  )

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key >= '1' && e.key <= '9') {
        activate(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, activate])

  return activate
}
