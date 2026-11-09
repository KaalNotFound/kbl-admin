// seedGuard.test.ts — pure seed-once guard (issue #4 A3)
import { describe, it, expect } from 'vitest'
import { shouldSeed, fingerprint } from '../lib/seedGuard'

describe('shouldSeed', () => {
  it('seeds on first run (empty ref)', () => {
    const ref = { lastKey: null }
    expect(shouldSeed(ref, 'all', [{} as never, {} as never], 'abc')).toBe(true)
  })

  it('skips re-runs for the same (filter, cards.length, dataId) target', () => {
    const ref = { lastKey: null }
    expect(shouldSeed(ref, 'all', [{} as never, {} as never], 'abc')).toBe(true)
    // Same target: the 30s StudyDashboard poll produces a NEW data object
    // identity but the same key → must NOT re-POST.
    expect(shouldSeed(ref, 'all', [{} as never, {} as never], 'abc')).toBe(false)
  })

  it('seeds again when the filter changes', () => {
    const ref = { lastKey: null }
    shouldSeed(ref, 'all', [{} as never], 'abc')
    expect(shouldSeed(ref, 'questions', [{} as never], 'abc')).toBe(true)
  })

  it('seeds again when the data fingerprint changes (new cards content)', () => {
    const ref = { lastKey: null }
    shouldSeed(ref, 'all', [{} as never], 'abc')
    expect(shouldSeed(ref, 'all', [{} as never, {} as never], 'abc')).toBe(true)
  })

  it('does not seed when cards is empty', () => {
    const ref = { lastKey: null }
    expect(shouldSeed(ref, 'all', [], 'abc')).toBe(false)
    // and an empty target is not remembered as "seeded"
    expect(ref.lastKey).toBeNull()
  })
})

describe('fingerprint', () => {
  it('is stable for identical content and differs on any change', () => {
    expect(fingerprint(['hola', 'mundo'])).toBe(fingerprint(['hola', 'mundo']))
    expect(fingerprint(['hola', 'mundo'])).not.toBe(fingerprint(['hola', 'mundo!']))
    expect(fingerprint(['hola', 'mundo'])).not.toBe(fingerprint(['mundo', 'hola']))
  })
})
