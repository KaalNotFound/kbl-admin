// Contract tests for the Bubble Sort frame engine (src/algorithms/bubble.js).
import { describe, it, expect } from 'vitest'
import { generateBubble, BUBBLE_META } from '../../src/algorithms/bubble.js'
import { parseArray } from '../../src/algorithms/input.ts'

function last(arr) {
  return arr[arr.length - 1]
}

const sorted = (arr) => [...arr].sort((a, b) => a - b)

describe('bubble frame generator', () => {
  it('final frame array equals sorted input (known case, empty, single, duplicates)', () => {
    for (const input of [[5, 1, 4, 2, 8], [], [7], [3, 3, 1, 3, 2, 2], [9, -2, 5, -2]]) {
      const frames = generateBubble(input)
      expect(frames.length).toBeGreaterThan(0)
      expect(last(frames).arr).toEqual(sorted(input))
    }
  })

  it('frame vocabulary has compare/swap fields and serviced counters', () => {
    const frames = generateBubble([2, 1, 3])
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

  it('early exit on already-sorted input (one pass, no swaps)', () => {
    const frames = generateBubble([1, 2, 3, 4])
    expect(last(frames).swaps).toBe(0)
    expect(last(frames).done).toBe(true)
    // one full pass of comparisons is enough before the break frame
    expect(frames.filter((f) => f.line === 'compare').length).toBe(3)
  })

  it('meta declares label, big-O bounds and stability', () => {
    expect(BUBBLE_META.label).toBeTypeOf('string')
    for (const key of ['best', 'avg', 'worst']) expect(BUBBLE_META.bigO[key]).toBeTypeOf('string')
    expect(BUBBLE_META.bigO.space).toBeTypeOf('string')
    expect(typeof BUBBLE_META.stable).toBe('boolean')
  })
})

describe('parseArray (visualizer input parsing)', () => {
  it('parses plain and bracketed comma/space lists', () => {
    expect(parseArray('5, 1, 4, 2, 8')).toEqual({ values: [5, 1, 4, 2, 8] })
    expect(parseArray('  [3,1,2] ')).toEqual({ values: [3, 1, 2] })
    expect(parseArray('4 2 7')).toEqual({ values: [4, 2, 7] })
    expect(parseArray(' 7 , 4 ')).toEqual({ values: [7, 4] })
  })

  it('returns the expected Spanish errors without throwing', () => {
    expect(parseArray('').error).toBeTruthy()
    expect(parseArray('///').error).toBeTruthy()
    expect(parseArray('3, x, 5').error).toContain('no es un número entero')
    expect(parseArray('a').error).toContain('no es un número entero')
  })

  it('enforces the 24-value limit and accepts negatives', () => {
    const big = Array.from({ length: 25 }, (_, i) => i + 1).join(', ')
    expect(parseArray(big).error).toContain('Máximo 24')
    expect(parseArray('-5, 2, -3')).toEqual({ values: [-5, 2, -3] })
  })
})
