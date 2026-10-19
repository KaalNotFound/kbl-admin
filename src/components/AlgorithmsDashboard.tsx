import { useState } from 'react'
import BubbleSortVisualizer from './BubbleSortVisualizer'

type AlgorithmId = 'bubble'

const ALGORITHMS: { id: AlgorithmId; label: string; icon: string; available: boolean }[] = [
  { id: 'bubble', label: 'Bubble Sort', icon: '🫧', available: true },
]

export default function AlgorithmsDashboard() {
  const [active, setActive] = useState<AlgorithmId>('bubble')

  return (
    <div>
      {/* Selector de algoritmo */}
      <div className="flex flex-wrap gap-1 mb-6 bg-card rounded-lg p-1">
        {ALGORITHMS.map((algo) => (
          <button
            key={algo.id}
            disabled={!algo.available}
            className={`py-2 px-4 rounded-md text-sm font-medium transition-all ${
              active === algo.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
            onClick={() => setActive(algo.id)}
          >
            {algo.icon} {algo.label}
          </button>
        ))}
        <span className="ml-auto self-center px-3 text-[0.65rem] text-text-tertiary">
          Más algoritmos próximamente
        </span>
      </div>

      {active === 'bubble' && <BubbleSortVisualizer />}
    </div>
  )
}
