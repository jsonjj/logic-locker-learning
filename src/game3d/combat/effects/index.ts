/**
 * Combat effects barrel — pooled weapon juice + the screen-shake bus.
 */
export { useFxPool, WeaponFxLayer } from './WeaponFx'
export type { WeaponFx, WeaponFxKind, FxPool } from './WeaponFx'
export { triggerShake, getShakeOffset, resetShake } from './shake'
export { kickFov, drainFovKick, resetFovKick } from './cameraPunch'
