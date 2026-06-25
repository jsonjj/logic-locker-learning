/** Local date as YYYY-MM-DD. */
export function todayString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dayBefore(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  return todayString(date)
}

/**
 * Streak based on lesson-completion days.
 *  - Same day as last completion: unchanged.
 *  - Day right after last completion: +1.
 *  - Any other gap (or first ever): resets to 1.
 */
export function computeStreak(prevStreak: number, lastDate: string, today: string): number {
  if (!lastDate) return 1
  if (lastDate === today) return Math.max(prevStreak, 1)
  if (lastDate === dayBefore(today)) return prevStreak + 1
  return 1
}
