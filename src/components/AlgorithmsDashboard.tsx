import { useState } from 'react'
import { BUBBLE_META } from '../algorithms/bubble'
import { SELECTION_META } from '../algorithms/selection'
import { INSERTION_META } from '../algorithms/insertion'
import { HEAP_META } from '../algorithms/heap'
import type { AlgorithmMeta } from '../algorithms/frameTypes'
import SortVisualizer from './algorithms/SortVisualizer'

/**
 * Algorithms dashboard — pill switcher over the shared SortVisualizer
 * (issue #2, slice 1). Each algorithm module exports its own engine + meta;
 * the panel stays a single shared implementation.
 */

const ALGORITHMS: AlgorithmMeta[] = [BUBBLE_META, SELECTION_META, INSERTION_META, HEAP_META]

export default function AlgorithmsDashboard() {
  const [active, setActive] = useState<string>(BUBBLE_META.id)
  const meta = ALGORITHMS.find((a) => a.id === active) ?? ALGORITHMS[0]

  return (
    <div>
      {/* Selector de algoritmo */}
      <div className="flex flex-wrap gap-1 mb-6 bg-card rounded-lg p-1">
        {ALGORITHMS.map((algo) => (
          <button
            key={algo.id}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              active === algo.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActive(algo.id)}
          >
            {algo.icon} {algo.label}
          </button>
        ))}
      </div>

      {/* key forces a fresh playback state when switching algorithms */}
      <SortVisualizer key={meta.id} meta={meta} />
    </div>
  )
}
