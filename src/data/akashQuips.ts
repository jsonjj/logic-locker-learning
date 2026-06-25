/** Short in-character reactions from Akash, shown on the feedback panel. */
export type QuipTier = 'correct' | 'firstWrong' | 'secondWrong'

const QUIPS: Record<QuipTier, string[]> = {
  correct: [
    'Hmph. Correct.',
    'Look at you, reasoning.',
    'Acceptable detective work.',
    'Right. Don’t get smug.',
    'Good. The grid agrees with you.',
  ],
  firstWrong: [
    'Wrong. Look again, rookie.',
    'Not quite. Reread the clue.',
    'Nope. Slow down and think.',
    'That’s a guess, not a deduction.',
  ],
  secondWrong: [
    'Still off. Let me walk you through it.',
    'Alright, enough flailing. Here’s the logic.',
    'Breathe. Follow the reasoning below.',
  ],
}

/** Pick a quip deterministically from a seed so it stays stable per render. */
export function pickQuip(tier: QuipTier, seed: string): string {
  const pool = QUIPS[tier]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return pool[Math.abs(hash) % pool.length]
}
