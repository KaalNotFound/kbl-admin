import { BUBBLE_META } from '../algorithms/bubble'
import type { SortFrame } from '../algorithms/frameTypes'
import type { ReactNode } from 'react'
import SortVisualizer from './algorithms/SortVisualizer'

/**
 * Bubble Sort visualizer — thin wrapper over the shared SortVisualizer.
 * The pseudo-code trace now lives in the shared PseudoCodePanel, driven by
 * BUBBLE_META.pseudocode and rendered by SortVisualizer for ALL tabs; what
 * remains here is the Bubble-specific execution state panel.
 */

/** Bubble-specific execution state (pointer info + current comparison). */
function ExecutionStatePanel({ frame }: { frame: SortFrame }): ReactNode {
  const comparingValue =
    frame.compare && frame.i !== null
      ? `${frame.arr[frame.compare[0]] ?? '—'} > ${frame.arr[frame.compare[1]] ?? '—'} ?`
      : '—'
  const n = frame.arr.length

  const boxes: { label: string; value: string }[] = [
    { label: 'i (pasada)', value: frame.i !== null ? String(frame.i) : '—' },
    { label: 'j (interna)', value: frame.j !== null ? String(frame.j) : '—' },
    { label: 'swapped (última pasada)', value: frame.swap !== null ? 'True' : 'False' },
    { label: 'n - i - 1', value: frame.i !== null ? String(Math.max(n - frame.i - 1, 0)) : '—' },
    { label: 'arr[j] > arr[j+1]', value: comparingValue },
  ]

  return (
    <div className="bg-card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Estado de ejecución</h3>
      <div className="grid grid-cols-2 gap-2">
        {boxes.map((box) => (
          <div key={box.label} className={`metric-box py-2 px-3 ${box.label.startsWith('arr[') ? 'col-span-2' : ''}`}>
            <p className="text-[0.6rem] text-text-secondary">{box.label}</p>
            <p className="text-sm font-semibold tabular-nums text-text-primary">{box.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BubbleSortVisualizer() {
  return (
    <SortVisualizer
      meta={BUBBLE_META}
      renderAside={(frame) => <ExecutionStatePanel frame={frame} />}
    />
  )
}
