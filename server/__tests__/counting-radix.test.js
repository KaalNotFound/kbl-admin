// Contract tests for the non-comparison sorts (src/algorithms/{counting,radix}.js).
// These use a different frame contract (buckets/digits) but must still satisfy
// the shared vocabulary so SortVisualizer can render them.
import { describe, it, expect } from 'vitest'
import { generateCounting, COUNTING_META } from '../../src/algorithms/counting.js'
import { generateRadix, RADIX_META } from '../../src/algorithms/radix.js'

function last(arr) {
  return arr[arr.length - 1]
}

const sorted = (arr) => [...arr].sort((a, b) => a - b)

const SIZE_CASES = [
  [7],
  [4, 0, 999, 3, 5, 1, 0, 12],
  Array.from({ length: 20 }, (_, i) => [12, 3, 999, 45, 45, 0, 7, 100, 7, 3, 88, 12, 0, 47, 999, 5, 64, 12, 3, 90][i]),
]

// each is wrapped so vitest treats the array itself as one argument
const CASE_ARGS = SIZE_CASES.map((c) => [c])

describe('counting sort generator', () => {
  it.each(CASE_ARGS)('final frame equals integer-sorted input (sizes 1, 8, 20)', (input) => {
    const frames = generateCounting(input)
    expect(frames.length).toBeGreaterThan(0)
    expect(last(frames).arr).toEqual(sorted(input))
    expect(last(frames).done).toBe(true)
  })

  it('cuenta fase marks each counted value in the bins view', () => {
    const frames = generateCounting([2, 0, 2, 1])
    const countFrames = frames.filter((f) => f.line === 'count')
    // 4 increment frames (one per input value) + 1 "cuenta fase completa" summary frame
    expect(countFrames.filter((f) => f.comparisonText.startsWith('cuenta fase:')).length).toBe(4)
    expect(countFrames.every((f) => /cuenta fase/i.test(f.description))).toBe(true)
    // bins array rendered in count frames: bins[2] reaches 2, final counts match frequencies
    expect(countFrames[countFrames.length - 1].arr).toEqual([1, 1, 2])
  })

  it('placement pass writes n values back (array length restored)', () => {
    const frames = generateCounting([3, 1, 2])
    const placeFrames = frames.filter((f) => f.line === 'place')
    expect(placeFrames.length).toBe(3)
    expect(placeFrames.every((f) => f.arr.length === 3)).toBe(true)
  })

  it('handles empty and single inputs', () => {
    expect(last(generateCounting([])).done).toBe(true)
    expect(last(generateCounting([5])).arr).toEqual([5])
  })

  it('counters sane: reads and placements both counted', () => {
    const frames = generateCounting([2, 1, 3])
    expect(last(frames).comparisons).toBe(3) // n reads
    expect(last(frames).swaps).toBe(3) // n placements
  })

  it('pure — same seed always produces identical frames', () => {
    expect(generateCounting([5, 2, 8, 2, 1])).toEqual(generateCounting([5, 2, 8, 2, 1]))
  })
})

describe('radix sort generator (LSD, base 10)', () => {
  it.each(CASE_ARGS)('final frame equals integer-sorted input (sizes 1, 8, 20)', (input) => {
    const frames = generateRadix(input)
    expect(frames.length).toBeGreaterThan(0)
    expect(last(frames).arr).toEqual(sorted(input))
    expect(last(frames).done).toBe(true)
  })

  it('one pass per digit: 999 needs 3 digit passes, digit-read frames annotate the digit', () => {
    const frames = generateRadix([170, 45, 75, 999, 90])
    const passFrames = frames.filter((f) => f.line === 'digit-pass')
    expect(passFrames.length).toBe(3) // unidades, decenas, centenas
    expect(passFrames.every((f) => /dígito/.test(f.description))).toBe(true)
    const digitFrames = frames.filter((f) => f.line === 'digit')
    expect(digitFrames.length).toBe(15) // 5 values × 3 passes
    expect(digitFrames[0].comparisonText).toMatch(/dígito.*de.*170/)
  })

  it('array stays length n between passes with partial sorted-ness at the end only', () => {
    const frames = generateRadix([21, 12, 3])
    expect(frames.every((f) => f.arr.length === 3)).toBe(true)
    expect(last(frames).arr).toEqual([3, 12, 21])
  })

  it('handles empty and single inputs', () => {
    expect(last(generateRadix([])).done).toBe(true)
    expect(last(generateRadix([7])).arr).toEqual([7])
  })

  it('counters sane: digit reads and writes both counted', () => {
    const frames = generateRadix([2, 13, 4])
    expect(last(frames).comparisons).toBe(6) // 3 values × 2 digit passes
    expect(last(frames).swaps).toBe(6) // n writes per pass
  })

  it('pure — same seed always produces identical frames', () => {
    expect(generateRadix([5, 22, 8, 2, 139])).toEqual(generateRadix([5, 22, 8, 2, 139]))
  })
})

describe('non-negative integer guard (behavior decision for counting/radix)', () => {
  // Counting bins and digit passes are undefined for negative values; the
  // decision is to reject them at input time via the meta.nonNegative flag.
  it('counting and radix declare nonNegative so the UI rejects negatives', () => {
    expect(COUNTING_META.nonNegative).toBe(true)
    expect(RADIX_META.nonNegative).toBe(true)
  })
})
