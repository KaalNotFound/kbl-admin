// seedGuard.ts — pure seed-once guard for the ShadowStudy store sync (issue #4 A3).
// Extracted from the component so the gating logic can be tested without React
// or jsdom: the effect used to re-POST /active-recall/seed on every 30s poll.

/** Mutable ref-style handle the caller owns. */
export interface SeedRef {
  lastKey: string | null
}

/** Deterministic djb2 over joined texts, length-prefixed to cut collisions. */
export function fingerprint(texts: string[]): string {
  let h = 5381
  for (const t of texts) {
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0
  }
  return `${texts.length}#${(h >>> 0).toString(36)}`
}

/**
 * Whether the current view target must be seeded+hydrated.
 * Consumes the guard on true (records the key); a target with no cards never
 * seeds and is never remembered, so the first non-empty view still runs.
 */
export function shouldSeed(ref: SeedRef, filter: string, cards: unknown[], dataId: string): boolean {
  if (cards.length === 0) return false
  const key = `${filter}|${cards.length}|${dataId}`
  if (ref.lastKey === key) return false
  ref.lastKey = key
  return true
}
