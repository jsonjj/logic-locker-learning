/**
 * Kid-friendly definitions for the concepts each room teaches. Keys match the
 * `conceptTags` used on lessons in lessons.ts.
 */
export interface GlossaryEntry {
  term: string
  definition: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  facts: {
    term: 'Facts',
    definition: 'A fact is something a clue states directly. You can trust it without guessing.',
  },
  possibilities: {
    term: 'Possibilities',
    definition: 'A possibility could be true, but no clue has proven it yet.',
  },
  contradictions: {
    term: 'Contradictions',
    definition: 'A contradiction is when two things cannot both be true — it means a guess is wrong.',
  },
  contradiction: {
    term: 'Contradictions',
    definition:
      'A contradiction is when a guess breaks a clue. When that happens, throw the guess out.',
  },
  unknowns: {
    term: 'Unknowns',
    definition: "An unknown is something you don't have enough information about yet. Leave it blank.",
  },
  'deduction grid': {
    term: 'Deduction Grid',
    definition:
      'A grid that tracks what is possible: ✓ means confirmed, ✕ means impossible, blank means unknown.',
  },
  elimination: {
    term: 'Elimination',
    definition: 'Crossing out options you have proven impossible, so the real answer stands out.',
  },
  'constraint propagation': {
    term: 'Chain Reactions',
    definition: "One confirmed answer forces others. A single ✓ usually creates several ✕'s.",
  },
  AND: {
    term: 'AND',
    definition: 'AND is true only when BOTH parts are true.',
  },
  OR: {
    term: 'OR',
    definition: 'OR is true when AT LEAST ONE part is true.',
  },
  NOT: {
    term: 'NOT',
    definition: 'NOT flips it: true becomes false, and false becomes true.',
  },
  'reasoning order': {
    term: 'Reasoning Order',
    definition: 'Good reasoning goes in order: start with the rule, add the evidence, then conclude.',
  },
  explanation: {
    term: 'Strong Explanations',
    definition: 'A strong explanation uses the clues, in order, to reach the conclusion.',
  },
  'combined deduction': {
    term: 'Combined Deduction',
    definition: 'Using every skill together — facts, grids, contradictions, and logic — to crack a case.',
  },
  final: {
    term: 'Final Challenge',
    definition: 'Putting everything you learned together to escape the Logic Locker.',
  },
}

export function getGlossaryEntry(tag: string): GlossaryEntry {
  return GLOSSARY[tag] ?? { term: tag, definition: '' }
}
