/** Selection Sort frame engine — one swap per pass, deterministic, pure. */
import { snap, finish } from './frameTypes.js'

export const SELECTION_META = {
  id: 'selection',
  label: 'Selection Sort',
  icon: '🎯',
  build: generateSelection,
  bigO: { best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: false,
}

/** Selection Sort: one swap per pass (only when the min is not already in place). */
export function generateSelection(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0

  steps.push(snap(arr, { comparisons, swaps }, { line: 'outer', description: 'Estado inicial — listo para comenzar' }))

  if (n <= 1) {
    steps.push(finish(arr, { comparisons, swaps }, 'El array ya está ordenado (n ≤ 1)', { line: 'done' }))
    return steps
  }

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i

    for (let j = i + 1; j < n; j++) {
      comparisons++
      const a = arr[minIdx]
      const b = arr[j]
      const better = b < a
      if (better) minIdx = j

      steps.push(
        snap(arr, { comparisons, swaps }, {
          i,
          j,
          line: 'compare',
          compare: [minIdx, j],
          highlight: [i],
          sortedFrom: i,
          comparisonText: `mín arr[${minIdx}] (${a}) ${better ? '>' : '≤'} arr[${j}] (${b})`,
          description: `Pasada ${i + 1} · j=${j}: ${a} ${better ? '>' : '≤'} ${b} → ${better ? `nuevo mínimo en ${j}` : `el mínimo sigue en ${minIdx}`}`,
        })
      )
    }

    if (minIdx !== i) {
      const a = arr[i]
      const b = arr[minIdx]
      ;[arr[i], arr[minIdx]] = [arr[minIdx], arr[i]]
      swaps++
      steps.push(
        snap(arr, { comparisons, swaps }, {
          i,
          j: minIdx,
          line: 'swap',
          swap: [i, minIdx],
          sortedFrom: i + 1,
          comparisonText: `intercambio arr[${i}] ↔ arr[${minIdx}]`,
          description: `Intercambio: ${b} ocupa la posición ${i} y ${a} la ${minIdx}`,
        })
      )
    } else {
      steps.push(
        snap(arr, { comparisons, swaps }, {
          i,
          line: 'in-place',
          sortedFrom: i + 1,
          description: `arr[${i}] ya era el mínimo: sin intercambio`,
        })
      )
    }
  }

  steps.push(
    finish(arr, { comparisons, swaps }, `Ordenado con ${comparisons} comparaciones y ${swaps} intercambio${swaps === 1 ? '' : 's'}`, {
      sortedFrom: 0,
      line: 'done',
    })
  )
  return steps
}
