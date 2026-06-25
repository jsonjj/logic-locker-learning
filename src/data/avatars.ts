export interface Avatar {
  id: string
  label: string
  monogram: string
  color: string
}

/** 6 preset avatars (no image uploads allowed in MVP). */
export const avatars: Avatar[] = [
  { id: 'inspector', label: 'The Inspector', monogram: 'IN', color: '#6a5cff' },
  { id: 'sleuth', label: 'The Sleuth', monogram: 'SL', color: '#12a150' },
  { id: 'fox', label: 'The Fox', monogram: 'FX', color: '#e0792b' },
  { id: 'owl', label: 'The Owl', monogram: 'OW', color: '#a855f7' },
  { id: 'analyst', label: 'The Analyst', monogram: 'AN', color: '#0ea5a5' },
  { id: 'shadow', label: 'The Shadow', monogram: 'SH', color: '#475569' },
]

export const DEFAULT_AVATAR_ID = 'inspector'

export function getAvatar(id: string | undefined): Avatar {
  return avatars.find((a) => a.id === id) ?? avatars[0]
}
