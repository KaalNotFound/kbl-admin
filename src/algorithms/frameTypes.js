/**
 * Shared frame vocabulary for the sort algorithms study module (issue #2).
 *
 * Frame fields consumed by SortVisualizer:
 *   arr             — array contents at this micro-step
 *   i / j           — algorithm pointer info (null when not applicable)
 *   compare         — [a, b] indices being compared, or null
 *   swap            — [a, b] indices that just swapped, or null
 *   highlight       — extra emphasized indices (e.g. heap sift-down region)
 *   sortedFrom      — indices >= sortedFrom are already fixed, -1 when none
 *   line            — algorithm-specific line key (drives pseudo-code panel)
 *   comparisonText  — human-readable comparison at this step (Spanish UI copy)
 *   comparisons / swaps — running counters
 *   done            — true on the final frames
 *   description     — Spanish explanation shown under the bars
 */

/**
 * @typedef {Object} SortFrame
 * @property {number[]} arr
 * @property {number|null} i
 * @property {number|null} j
 * @property {[number, number]|null} compare
 * @property {[number, number]|null} swap
 * @property {number[]} highlight
 * @property {number} sortedFrom
 * @property {string} line
 * @property {string} comparisonText
 * @property {number} comparisons
 * @property {number} swaps
 * @property {boolean} done
 * @property {string} description
 */

/**
 * Metadata every algorithm module exports so SwitchVisualizer/AlgorithmsDashboard
 * can render it generically.
 * @typedef {Object} AlgorithmMeta
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {(arr: number[]) => SortFrame[]} build
 * @property {{best: string, avg: string, worst: string, space: string}} bigO
 * @property {boolean} stable
 */

export function frame(arr, extra) {
  return {
    i: null,
    j: null,
    compare: null,
    swap: null,
    highlight: [],
    sortedFrom: -1,
    line: '',
    comparisonText: '',
    comparisons: 0,
    swaps: 0,
    done: false,
    description: '',
    arr: [...arr],
    ...extra,
  }
}

/** Snapshot: current array + counters, plus per-step extras. */
export const snap = (arr, counters, extra) => frame(arr, { ...counters, ...extra })

/** Terminal frame with done=true and a final description. */
export const finish = (arr, counters, description, extra = {}) =>
  snap(arr, counters, { ...extra, done: true, description })
