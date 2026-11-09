/** Heap Sort frame engine — build max-heap then extract max, deterministic, pure. */
import { snap, finish } from './frameTypes.js'

export const HEAP_META = {
  id: 'heap',
  label: 'Heap Sort',
  icon: '🌳',
  build: generateHeap,
  bigO: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)' },
  stable: false,
  pseudocode: {
    lines: [
      'for i in range(n // 2 - 1, -1, -1):',
      '    heapify(arr, n, i)  # construir max-heap',
      'for i in range(n - 1, 0, -1):',
      '    arr[0], arr[i] = arr[i], arr[0]  # extraer máximo',
      '    heapify(arr, i, 0)',
    ],
    mapping: { outer: 0, heapify: 1, 'heapify-swap': 1, 'heapify-done': 1, 'heap-built': 2, extract: 3, done: null },
  },
}

/** Heap Sort: build max-heap, then swap root↔tail and sift down (in place). */
export function generateHeap(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0
  let heapSize = n

  const siftDown = (start) => {
    let root = start
    for (;;) {
      const l = 2 * root + 1
      const r = l + 1
      let largest = root
      let target = null

      if (l < heapSize) {
        comparisons++
        target = l
        if (arr[l] > arr[largest]) largest = l
      }
      if (r < heapSize) {
        comparisons++
        // Single evaluation of the same condition (issue #4 A1): previously
        // `arr[r] > arr[largest]` was checked twice with identical outcome.
        if (arr[r] > arr[largest]) {
          target = r
          largest = r
        }
      }

      if (target !== null) {
        steps.push(
          snap(arr, { comparisons, swaps }, {
            line: 'heapify',
            compare: [largest, target],
            highlight: [root, l, r].filter((k) => k < heapSize),
            comparisonText: `padre arr[${root}] (${arr[root]}) vs hijo candidato arr[${target}] (${arr[target]})`,
            description: `Heapify en ${root}: hijos l=${l < heapSize ? arr[l] : '∅'} r=${r < heapSize ? arr[r] : '∅'} → máx en ${largest}`,
          })
        )
      }

      if (largest === root) break
      const a = arr[root]
      const b = arr[largest]
      ;[arr[root], arr[largest]] = [arr[largest], arr[root]]
      swaps++
      steps.push(
        snap(arr, { comparisons, swaps }, {
          line: 'heapify-swap',
          swap: [root, largest],
          highlight: [root, largest],
          comparisonText: `intercambio padre ↔ hijo: arr[${root}] ↔ arr[${largest}]`,
          description: `${b} sube a ${root} y ${a} baja a ${largest}: seguimos hundeando`,
        })
      )
      root = largest
    }
    steps.push(
      snap(arr, { comparisons, swaps }, {
        line: 'heapify-done',
        highlight: [],
        description: `Subárbol de ${start} cumple la propiedad de max-heap`,
      })
    )
  }

  steps.push(snap(arr, { comparisons, swaps }, { line: 'outer', description: 'Estado inicial — construyendo el max-heap' }))

  if (n <= 1) {
    steps.push(finish(arr, { comparisons, swaps }, 'El array ya está ordenado (n ≤ 1)', { line: 'done' }))
    return steps
  }

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(i)

  steps.push(
    snap(arr, { comparisons, swaps }, { line: 'heap-built', description: 'Max-heap construido: el máximo está en la raíz arr[0]' })
  )

  for (heapSize = n - 1; heapSize > 0; heapSize--) {
    const top = arr[0]
    ;[arr[0], arr[heapSize]] = [arr[heapSize], arr[0]]
    swaps++
    steps.push(
      snap(arr, { comparisons, swaps }, {
        i: heapSize,
        line: 'extract',
        swap: [0, heapSize],
        sortedFrom: heapSize,
        comparisonText: `extrae máximo arr[0] (${top}) → posición ${heapSize}`,
        description: `Sacamos el máximo ${top} de la raíz y lo fijamos en ${heapSize}`,
      })
    )
    siftDown(0)
  }

  steps.push(
    finish(arr, { comparisons, swaps }, `Ordenado con ${comparisons} comparaciones (heapify) y ${swaps} intercambios`, {
      sortedFrom: 0,
      line: 'done',
    })
  )
  return steps
}
