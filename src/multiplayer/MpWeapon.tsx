import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameState } from '../game3d/state/GameStateContext'
import { pushHit } from './net'
import { playBlast } from '../audio/sound'
import { useFxPool, WeaponFxLayer } from '../game3d/combat/effects/WeaponFx'
import { triggerShake } from '../game3d/combat/effects/shake'
import { kickFov } from '../game3d/combat/effects/cameraPunch'
import type { EnemiesHandle } from './SharedEnemies'

/** Weapon profile the arena derives from the player's equipped gear. */
export interface MpWeaponProfile {
  name: string
  damage: number
  range: number
  cooldownMs: number
  aoe?: number
  color: string
}

interface MpWeaponProps {
  code: string
  uid: string
  isHost: boolean
  playing: boolean
  handle: RefObject<EnemiesHandle | null>
  weapon: MpWeaponProfile
}

/**
 * The multiplayer sidearm — available from the first second (guns-fast). Its
 * stats come from the player's single-player loadout, so unlocking better gear
 * in One Player makes you stronger here. Auto-assists onto the nearest enemy in
 * the aim cone; the host applies damage, guests report hits over the wire.
 */
export default function MpWeapon({ code, uid, isHost, playing, handle, weapon }: MpWeaponProps) {
  const gs = useGameState()
  const cooldown = useRef(0)
  const fx = useFxPool()
  const spawn = fx.spawn

  // Keep the latest weapon profile for the (stable) event handler.
  const wRef = useRef(weapon)
  wRef.current = weapon

  useEffect(() => {
    function fire() {
      if (!playing) return
      const w = wRef.current
      const now = performance.now()
      if (now < cooldown.current) return
      cooldown.current = now + w.cooldownMs
      const h = handle.current
      if (!h) return
      const px = gs.playerPos.current.x
      const pz = gs.playerPos.current.z
      const heading = gs.playerHeading.current
      const target = h.nearest(px, pz, heading, w.range)

      let ix = px + Math.sin(heading) * w.range
      let iz = pz + Math.cos(heading) * w.range
      if (target) {
        ix = target.x
        iz = target.z
      }

      const deal = (id: string) => {
        if (isHost) h.damage(id, w.damage, uid)
        else pushHit(code, { eid: id, dmg: w.damage, by: uid })
      }

      if (w.aoe) {
        // Splash: damage everyone within the blast around the impact point.
        for (const e of h.within(ix, iz, w.aoe)) deal(e.id)
      } else if (target) {
        deal(target.id)
      }

      playBlast(w.aoe ? 'boom' : 'laser')

      // --- Juice -------------------------------------------------------------
      // Stronger guns read as visibly thicker tracers.
      const thick = 0.06 + Math.min(0.24, (w.damage - 1) * 0.05)
      const muzzle: [number, number, number] = [px, 1.1, pz]
      const impact: [number, number, number] = [ix, 1.1, iz]
      spawn({ kind: 'muzzle', pos: muzzle, color: w.color, ttl: w.aoe ? 110 : 90 })
      spawn({ kind: 'tracer', pos: muzzle, to: impact, color: w.color, ttl: 120, thickness: thick })
      if (w.aoe) {
        spawn({ kind: 'shockwave', pos: impact, color: w.color, radius: w.aoe, ttl: 460 })
        spawn({ kind: 'impact', pos: impact, color: '#ffffff', ttl: 200 })
        triggerShake(0.55)
        kickFov(1.4)
      } else if (target) {
        spawn({ kind: 'impact', pos: impact, color: w.color, ttl: 170 })
        triggerShake(0.18)
        kickFov(1)
      } else {
        triggerShake(0.1)
        kickFov(0.6)
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'f') fire()
    }
    function onFireEvent() {
      fire()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('ll-fire', onFireEvent as EventListener)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('ll-fire', onFireEvent as EventListener)
    }
  }, [code, uid, isHost, playing, handle, gs, spawn])

  useFrame(() => {
    fx.prune()
  })

  return <WeaponFxLayer pool={fx.items} />
}
