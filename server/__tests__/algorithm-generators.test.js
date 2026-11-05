// Contract tests for the sort frame engines (src/algorithms/{bubble,selection,insertion,heap}.js).
// Frames must follow one vocabulary so SortVisualizer can render any algorithm.
import { describe, it, expect } from 'vitest'
import { generateBubble, BUBBLE_META } from '../../src/algorithms/bubble.js'
import { generateSelection, SELECTION_META } from '../../src/algorithms/selection.js'
import { generateInsertion, INSERTION_META } from '../../src/algorithms/insertion.js'
import { generateHeap, HEAP_META } from '../../src/algorithms/heap.js'

const ALL = {
  bubble: { gen: generateBubble, meta: BUBBLE_META },
  selection: { gen: generateSelection, meta: SELECTION_META },
  insertion: { gen: generateInsertion, meta: INSERTION_META },
  heap: { gen: generateHeap, meta: HEAP_META },
}

function last(arr) {
  return arr[arr.length - 1]
}

const sorted = (arr) => [...arr].sort((a, b) => a - b)

describe('sort frame generators', () => {
  it.each([
    ['bubble', generateBubble],
    ['selection', generateSelection],
    ['insertion', generateInsertion],
    ['heap', generateHeap],
  ])('%s: final frame array equals sorted input (known case, empty, single, duplicates)', (_name, gen) => {
    for (const input of [[5, 1, 4, 2, 8], [], [7], [3, 3, 1, 3, 2, 2], [9, -2, 5, -2]]) {
      const frames = gen(input)
      expect(frames.length).toBeGreaterThan(0)
      expect(last(frames).arr).toEqual(sorted(input))
    }
  })

  it('heap: sorts correctly on trees of sizes 1, 8 and 20 (with duplicates)', () => {
    const cases = [[1], [4, 10, 3, 5, 1, 9, 2, 8], Array.from({ length: 20 }, (_, i) => 7 - (i % 5) - i)]
    for (const input of cases) {
      const frames = generateHeap(input)
      expect(last(frames).arr).toEqual(sorted(input))
    }
  })

  it.each(Object.keys(ALL))('%s: frame vocabulary has compare/swap fields and serviced counters', (name) => {
    const frames = ALL[name].gen([2, 1, 3])
    for (const f of frames) {
      expect(f).toHaveProperty('arr')
      expect(f).toHaveProperty('compare')
      expect(f).toHaveProperty('swap')
      expect(f).toHaveProperty('comparisons')
      expect(f).toHaveProperty('swaps')
      expect(f).toHaveProperty('done')
      expect(f).toHaveProperty('description')
    }
    const end = last(frames)
    expect(end.comparisons).toBeGreaterThan(0)
    expect(end.done).toBe(true)
  })

  it('bubble: early exit on already-sorted input (one pass, no swaps)', () => {
    const frames = generateBubble([1, 2, 3, 4])
    expect(last(frames).swaps).toBe(0)
    expect(frames.filter((f) => f.line === 'compare').length).toBe(3)
  })

  it('selection: swap count is exact (one swap per needed pass, at most n-1)', () => {
    // [4,1,3,2]: pass0 swaps (4↔1), pass1 swaps (4↔2), pass2 already fixed → 2 swaps.
    const frames = generateSelection([4, 1, 3, 2])
    expect(last(frames).swaps).toBe(2)
    // already-sorted input needs zero swaps
    expect(last(generateSelection([1, 2, 3])).swaps).toBe(0)
  })

  it('meta: every algorithm declares big-O bounds, space and stability', () => {
    for (const [name, { meta }] of Object.entries(ALL)) {
      expect(meta.label).toBeTypeOf('string')
      for (const key of ['best', 'avg', 'worst']) expect(meta.bigO[key]).toBeTypeOf('string')
      expect(meta.bigO.space).toBeTypeOf('string')
      expect(typeof meta.stable).toBe('boolean')
      expect(typeof ALL[name].gen).toBe('function')
    }
  })
})
