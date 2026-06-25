import { lessons } from '../data/lessons'

/** Ordered list of lesson ids. */
export function lessonOrder(): string[] {
  return lessons.map((l) => l.id)
}

/** The lesson that comes after the given one, or null if it is the last. */
export function getNextLessonId(lessonId: string): string | null {
  const order = lessonOrder()
  const idx = order.indexOf(lessonId)
  if (idx === -1 || idx === order.length - 1) return null
  return order[idx + 1]
}

export function isLessonUnlocked(lessonId: string, unlockedIds: string[]): boolean {
  return unlockedIds.includes(lessonId)
}

/**
 * After completing a lesson, unlock ONLY the next lesson (idempotent).
 * Returns the updated unlocked list.
 */
export function computeUnlocks(unlockedIds: string[], completedLessonId: string): string[] {
  const next = getNextLessonId(completedLessonId)
  if (!next || unlockedIds.includes(next)) return unlockedIds
  return [...unlockedIds, next]
}
