import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameState } from '../state/GameStateContext'
import { useInventory } from '../state/InventoryContext'
import { useCombat } from './CombatContext'
import { playBlast } from '../../audio/sound'
import { useFxPool, WeaponFxLayer } from './effects/WeaponFx'
import { triggerShake } from './effects/shake'
import { kickFov } from './effects/cameraPunch'
import type { GearItem } from '../systems/gear'

/** The fire dispatch: any DOM control can `window.dispatchEvent(new Event('ll-fire'))`. */
const FIRE_EVENT = 'll-fire'

export interface WeaponControllerProps {
  /** Disable firing (menus, puzzle overlays, cutscenes). */
  disabled?: boolean
  /** Force a specific weapon (e.g. the finale's guaranteed AoE cannon). */
  weaponOverride?: GearItem
}

export default function WeaponController({ disabled = false, weaponOverride }: WeaponControllerProps) {
  const gs = useGameState()
  const { weapon: equippedWeapon } = useInventory()
  const weapon = weaponOverride ?? equippedWeapon
  const combat = useCombat()
  const lastFire = useRef(0)
  const fx = useFxPool()

  // Latest values for the event handlers (avoid stale closures).
  const state = useRef({ disabled, weapon })
  state.current = { disabled, weapon }
  const spawn = fx.spawn

  useEffect(() => {
    function tryFire() {
      const { disabled: off, weapon: w } = state.current
      if (off || gs.paused) return
      const now = performance.now()
      if (now - lastFire.current < (w.cooldownMs ?? 500)) return
      lastFire.current = now
      playBlast(w.aoe ? 'boom' : 'laser')

      const from = gs.playerPos.current
      const heading = gs.playerHeading.current
      const ranged = w.weaponKind === 'ranged'
      const target = combat.findTarget(
        { x: from.x, z: from.z },
        w.range ?? 2.4,
        ranged ? heading : undefined,
      )

      const muzzle: [number, number, number] = [from.x, from.y + 0.2, from.z]

      // AoE weapon: detonate at the aimed enemy (or a forward point) and jolt
      // everyone in the blast — strong crowd control, but not a one-shot.
      if (w.aoe) {
        let ix: number
        let iz: number
        if (target) {
          const tp = target.getPos()
          ix = tp.x
          iz = tp.z
        } else {
          const reach = Math.min(w.range ?? 12, 12)
          ix = from.x + Math.sin(heading) * reach
          iz = from.z + Math.cos(heading) * reach
        }
        combat.damageInRadius(ix, iz, w.aoe, w.damage ?? 1)
        const impact: [number, number, number] = [ix, from.y + 0.2, iz]
        spawn({ kind: 'muzzle', pos: muzzle, color: w.color, ttl: 110 })
        spawn({ kind: 'tracer', pos: muzzle, to: impact, color: w.color, ttl: 150, thickness: 0.2 })
        spawn({ kind: 'shockwave', pos: impact, color: w.color, radius: w.aoe, ttl: 460 })
        spawn({ kind: 'impact', pos: impact, color: '#ffffff', ttl: 200 })
        triggerShake(0.6)
        kickFov(1.4)
        return
      }

      if (target) {
        const tp = target.getPos()
        const killed = target.damage(w.damage ?? 1)
        const impact: [number, number, number] = [tp.x, tp.y + 0.2, tp.z]
        spawn({ kind: 'muzzle', pos: muzzle, color: w.color, ttl: 90 })
        if (ranged) {
          spawn({ kind: 'tracer', pos: muzzle, to: impact, color: w.color, ttl: 130 })
        } else {
          spawn({ kind: 'melee', pos: impact, color: w.color, ttl: 150 })
        }
        spawn({ kind: 'impact', pos: impact, color: killed ? '#ffffff' : w.color, ttl: 180 })
        triggerShake(ranged ? 0.18 : 0.26)
        kickFov(1)
      } else {
        // Whiff: show the shot/swing going forward.
        const reach = ranged ? Math.min(w.range ?? 10, 12) : w.range ?? 2.4
        const tx = from.x + Math.sin(heading) * reach
        const tz = from.z + Math.cos(heading) * reach
        const end: [number, number, number] = [tx, from.y + 0.2, tz]
        spawn({ kind: 'muzzle', pos: muzzle, color: w.color, ttl: 90 })
        if (ranged) spawn({ kind: 'tracer', pos: muzzle, to: end, color: w.color, ttl: 120 })
        else spawn({ kind: 'melee', pos: end, color: w.color, ttl: 140 })
        triggerShake(0.12)
        kickFov(0.6)
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        tryFire()
      }
    }
    function onPointer(e: PointerEvent) {
      // Ignore clicks on UI controls so buttons still work.
      const el = e.target as HTMLElement | null
      if (el && el.closest('button, input, a, [data-ui]')) return
      tryFire()
    }
    function onFireEvent() {
      tryFire()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener(FIRE_EVENT, onFireEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener(FIRE_EVENT, onFireEvent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame(() => {
    fx.prune()
  })

  return <WeaponFxLayer pool={fx.items} />
}
