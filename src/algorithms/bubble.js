/** Bubble Sort frame engine with early-exit — deterministic, pure. */
import { snap, finish } from './frameTypes.js'

export const BUBBLE_META = {
  id: 'bubble',
  label: 'Bubble Sort',
  icon: '🫧',
  build: generateBubble,
  bigO: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: true,
  // Pseudo-code trace for the shared execution point panel (moved from the
  // old Bubble-only CodeTracePanel; frame.line → highlighted row).
  pseudocode: {
    lines: [
      'for i in range(n - 1):',
      '    swapped = False',
      '    for j in range(0, n - i - 1):',
      '        if arr[j] > arr[j + 1]:',
      '            arr[j], arr[j + 1] = arr[j + 1], arr[j]  # intercambio',
      '            swapped = True',
      '    if not swapped:',
      '        break',
    ],
    mapping: { outer: 0, compare: 3, swap: 4, 'pass-end': 6, break: 6, done: null },
  },
}

/** Bubble Sort with early exit (extracted from BubbleSortVisualizer.buildTrace). */
export function generateBubble(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0
  const counters = () => ({ comparisons, swaps })

  steps.push(snap(arr, counters(), { line: 'outer', sortedFrom: n, description: 'Estado inicial — listo para comenzar' }))

  if (n <= 1) {
    steps.push(finish(arr, counters(), 'El array ya está ordenado (n ≤ 1)', { sortedFrom: 0, line: 'done' }))
    return steps
  }

  for (let i = 0; i < n - 1; i++) {
    let swappedThisPass = false
    const tail = n - i

    for (let j = 0; j < n - i - 1; j++) {
      comparisons++
      const a = arr[j]
      const b = arr[j + 1]
      const willSwap = a > b

      steps.push(
        snap(arr, counters(), {
          i,
          j,
          line: 'compare',
          compare: [j, j + 1],
          sortedFrom: tail,
          comparisonText: `arr[${j}] (${a}) ${willSwap ? '>' : '≤'} arr[${j + 1}] (${b})`,
          description: `Pasada ${i + 1} · j=${j}: ${a} ${willSwap ? '>' : '≤'} ${b} → ${willSwap ? 'intercambia' : 'no intercambia'}`,
        })
      )

      if (willSwap) {
        ;[arr[j], arr[j + 1]] = [arr[j + 1], arr[j]]
        swaps++
        swappedThisPass = true
        steps.push(
          snap(arr, counters(), {
            i,
            j,
            line: 'swap',
            compare: [j, j + 1],
            swap: [j, j + 1],
            sortedFrom: tail,
            comparisonText: `intercambio arr[${j}] ↔ arr[${j + 1}]`,
            description: `Intercambio: ${b} pasa a la posición ${j} y ${a} a la ${j + 1}`,
          })
        )
      }
    }

    const tailAfter = n - i - 1
    if (!swappedThisPass) {
      steps.push(
        finish(arr, counters(), `Pasada ${i + 1} sin intercambios → early exit. Array ordenado.`, { i, sortedFrom: 0, line: 'break' })
      )
      return steps
    }

    steps.push(
      snap(arr, counters(), {
        i,
        line: 'pass-end',
        sortedFrom: tailAfter,
        description: `Fin de pasada ${i + 1}: el mayor (${arr[tailAfter]}) quedó fijo en la posición ${tailAfter}.`,
      })
    )
  }

  steps.push(
    finish(arr, counters(), `Ordenado en ${n - 1} pasadas y ${comparisons} comparaciones`, { i: n - 2, sortedFrom: 0, line: 'done' })
  )
  return steps
}
