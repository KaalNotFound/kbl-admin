// Contract test: every ALGORITHM_META must carry pseudo-code (lines + mapping)
// and the mapping must cover every `line` key its generator emits.
import { describe, it, expect } from 'vitest'
import { generateBubble, BUBBLE_META } from '../../src/algorithms/bubble.js'
import { generateSelection, SELECTION_META } from '../../src/algorithms/selection.js'
import { generateInsertion, INSERTION_META } from '../../src/algorithms/insertion.js'
import { generateHeap, HEAP_META } from '../../src/algorithms/heap.js'
import { generateMerge, MERGE_META } from '../../src/algorithms/merge.js'
import { generateShell, SHELL_META } from '../../src/algorithms/shell.js'
import { generateCounting, COUNTING_META } from '../../src/algorithms/counting.js'
import { generateRadix, RADIX_META } from '../../src/algorithms/radix.js'

const ALGORITHMS = [
  ['bubble', generateBubble, BUBBLE_META],
  ['selection', generateSelection, SELECTION_META],
  ['insertion', generateInsertion, INSERTION_META],
  ['heap', generateHeap, HEAP_META],
  ['merge', generateMerge, MERGE_META],
  ['shell', generateShell, SHELL_META],
  ['counting', generateCounting, COUNTING_META],
  ['radix', generateRadix, RADIX_META],
]

function collectLines(generate) {
  // Unsorted sample exercises every loop branch of each generator; counting
  // and radix are non-negative only, so the sample avoids negatives.
  return new Set(generate([5, 1, 4, 2, 8]).map((f) => f.line))
}

describe('pseudo-code metadata across all 8 algorithms', () => {
  it('every ALGORITHM_META has non-empty pseudocode.lines', () => {
    for (const [id, , meta] of ALGORITHMS) {
      expect(meta.pseudocode, `${id}: pseudocode missing`).toBeDefined()
      expect(meta.pseudocode.lines.length, `${id}: no lines`).toBeGreaterThan(0)
      for (const line of meta.pseudocode.lines) {
        expect(typeof line).toBe('string')
        expect(line.length, `${id}: empty line`).toBeGreaterThan(0)
      }
    }
  })

  it('mapping keys cover every frame.line value the generator emits', () => {
    for (const [id, generate, meta] of ALGORITHMS) {
      const observed = collectLines(generate)
      for (const key of observed) {
        expect(key in meta.pseudocode.mapping, `${id}: mapping lacks key "${key}"`).toBe(true)
      }
    }
  })

  it('mapping values are valid row indices or null', () => {
    for (const [id, generate, meta] of ALGORITHMS) {
      const maxRow = meta.pseudocode.lines.length - 1
      for (const [key, row] of Object.entries(meta.pseudocode.mapping)) {
        expect(row === null || (Number.isInteger(row) && row >= 0 && row <= maxRow), `${id}: mapping[${key}]=${row}`).toBe(true)
      }
    }
  })
})
