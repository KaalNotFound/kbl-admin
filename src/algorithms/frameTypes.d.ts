/**
 * Types for frameTypes.js — shared frame vocabulary for the sort algorithms
 * study module (issue #2). The JSDoc typedefs in frameTypes.js stay the
 * source of truth; this declaration file adds static types for TS imports.
 */

/** One micro-step frame rendered by SortVisualizer. */
export interface SortFrame {
  /** Array contents at this micro-step. */
  arr: number[]
  /** Algorithm pointer info (null when not applicable). */
  i: number | null
  /** Algorithm pointer info (null when not applicable). */
  j: number | null
  /** [a, b] indices being compared, or null. */
  compare: [number, number] | null
  /** [a, b] indices that just swapped, or null. */
  swap: [number, number] | null
  /** Extra emphasized indices (e.g. heap sift-down region). */
  highlight: number[]
  /** Indices >= sortedFrom are already fixed; -1 when none. */
  sortedFrom: number
  /** Algorithm-specific line key (drives pseudo-code panel). */
  line: string
  /** Human-readable comparison at this step (Spanish UI copy). */
  comparisonText: string
  /** Running comparisons counter. */
  comparisons: number
  /** Running swaps counter. */
  swaps: number
  /** True on the final frames. */
  done: boolean
  /** Spanish explanation shown under the bars. */
  description: string
}

/** Running cost counters shared by every engine. */
export interface Counters {
  comparisons: number
  swaps: number
}

/** Pseudo-code trace for the shared execution point panel. */
export interface PseudocodeMeta {
  lines: string[]
  /** frame.line → highlighted row (null = no highlight). */
  mapping: Record<string, number | null>
}

/**
 * Metadata every algorithm module exports so SwitchVisualizer/
 * AlgorithmsDashboard can render it generically.
 */
export interface AlgorithmMeta {
  id: string
  label: string
  icon: string
  build: (arr: number[]) => SortFrame[]
  bigO: { best: string; avg: string; worst: string; space: string }
  stable: boolean
  /** Enables the shared execution point panel in SortVisualizer. */
  pseudocode?: PseudocodeMeta
  /** True when the algorithm needs non-negative integers (counting/radix). */
  nonNegative?: boolean
  /** Overrides the didactic counters card labels (e.g. lecturas/colocaciones). */
  counterLabels?: { comparisons?: string; swaps?: string }
}

/** Frame factory: current array + per-step overrides. */
export function frame(arr: number[], extra: Partial<SortFrame>): SortFrame

/** Snapshot: current array + counters, plus per-step extras. */
export function snap(arr: number[], counters: Counters, extra: Partial<SortFrame>): SortFrame

/** Terminal frame with done=true and a final description. */
export function finish(arr: number[], counters: Counters, description: string, extra?: Partial<SortFrame>): SortFrame
