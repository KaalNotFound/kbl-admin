import { BUBBLE_META } from '../algorithms/bubble'
import type { SortFrame } from '../algorithms/frameTypes'
import type { ReactNode } from 'react'
import SortVisualizer from './algorithms/SortVisualizer'

/**
 * Bubble Sort visualizer — thin wrapper over the shared SortVisualizer
 * (issue #2 slice 1). The frame engine (buildTrace logic), bars, controls,
 * counters and movement matrix now live in src/algorithms + SortVisualizer;
 * what remains here is the Bubble-specific pseudo-code trace panel.
 */

type LineKey = 'outer' | 'compare' | 'swap' | 'pass-end' | 'break' | 'done'

const CODE_LINES = [
  'for i in range(n - 1):',
  '    swapped = False',
  '    for j in range(0, n - i - 1):',
  '        if arr[j] > arr[j + 1]:',
  '            arr[j], arr[j + 1] = arr[j + 1], arr[j]  # intercambio',
  '            swapped = True',
  '    if not swapped:',
  '        break',
]

const LINE_TO_CODE: Record<LineKey, number | null> = {
  outer: 0,
  compare: 3,
  swap: 4,
  'pass-end': 6,
  break: 6,
  done: null,
}

function CodeTracePanel({ frame }: { frame: SortFrame }) {
  const activeCodeLine = LINE_TO_CODE[frame.line as LineKey] ?? null

  return (
    <div className="bg-card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Punto de ejecución</h3>
      <pre className="mono text-[0.7rem] leading-relaxed overflow-x-auto">
        {CODE_LINES.map((line, idx) => (
          <div
            key={idx}
            className={`px-2 -mx-1 rounded transition-colors ${
              idx === activeCodeLine ? 'bg-accent-light text-accent font-semibold' : 'text-text-secondary'
            }`}
          >
            <span className="text-text-tertiary select-none mr-2">{String(idx + 1).padStart(2, ' ')}</span>
            {line}
          </div>
        ))}
      </pre>
    </div>
  )
}

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
      renderAside={(frame) => (
        <>
          <ExecutionStatePanel frame={frame} />
          <CodeTracePanel frame={frame} />
        </>
      )}
    />
  )
}
