/** Counting Sort frame engine — non-negative integers only; bins as frames. */
import { snap, finish } from './frameTypes.js'

export const COUNTING_META = {
  id: 'counting',
  label: 'Counting Sort',
  icon: '🔢',
  build: generateCounting,
  bigO: { best: 'O(n+k)', avg: 'O(n+k)', worst: 'O(n+k)', space: 'O(k)' },
  stable: true,
  pseudocode: {
    lines: [
      'max = max(arr)',
      'count = [0] * (max + 1)',
      'for v in arr:',
      '    count[v] += 1  # fase de conteo',
      'pos = 0',
      'for v in range(max + 1):',
      '    for _ in range(count[v]):',
      '        out[pos] = v  # fase de colocación',
      '        pos += 1',
    ],
    mapping: { outer: 0, count: 3, place: 7, done: null },
  },
  // non-negative integers only: bins indexed by value are undefined for
  // negatives. SortVisualizer rejects such input at parse time.
  nonNegative: true,
  // This engine counts reads and placements instead of comparisons of pairs:
  // the didactic counters card relabels them via these optional names.
  counterLabels: { comparisons: 'Lecturas', swaps: 'Colocaciones' },
}

/**
 * Counting Sort: a two-phase visualization within the shared frame vocabulary.
 *
 * Phase 1 ("cuenta fase"): the render array becomes the BINS view — one bar
 * per possible value (k = max+1). Each frame increments the bin for one input
 * value, highlight marks the bin, and the note names the value being counted.
 *
 * Phase 2 ("place"): the render array goes back to length n and is rebuilt
 * left to right by walking the bins in value order and writing each value
 * `counts[v]` times.
 *
 * Counters reuse the shared fields: `comparisons` counts reads (one per
 * input value), `swaps` counts placements (one per write-back). No negatives:
 * the meta declares `nonNegative` so input parsing guards this.
 */
export function generateCounting(input) {
  const n = input.length
  const steps = []
  let comparisons = 0
  let swaps = 0

  steps.push(
    snap(input, { comparisons, swaps }, {
      line: 'outer',
      description: `Estado inicial — Counting Sort: dos fases (contar frecuencias, luego reconstruir) · n=${n}`,
    })
  )

  if (n === 0) {
    steps.push(finish(input, { comparisons, swaps }, 'Array vacío: nada que ordenar', { line: 'done' }))
    return steps
  }

  const max = Math.max(...input)
  const counts = new Array(max + 1).fill(0)

  // Phase 1: count occurrences — frames show the bins array.
  for (const v of input) {
    counts[v]++
    comparisons++
    steps.push(
      snap(counts, { comparisons, swaps }, {
        line: 'count',
        highlight: [v],
        comparisonText: `cuenta fase: lee valor ${v} → cubeta[${v}] = ${counts[v]}`,
        description: `Cuenta fase: recorremos la entrada y sumamos el valor ${v} en su cubeta (vista de ${max + 1} cubetas)`,
      })
    )
  }
  steps.push(
    snap(counts, { comparisons, swaps }, {
      line: 'count',
      description: 'Cuenta fase completa: cada cubeta guarda cuántas veces aparece su valor en la entrada',
    })
  )

  // Phase 2: rebuild the array left to right in value order.
  const out = new Array(n).fill(0)
  let pos = 0
  for (let v = 0; v <= max; v++) {
    for (let c = 0; c < counts[v]; c++) {
      out[pos] = v
      pos++
      swaps++
      steps.push(
        snap(out, { comparisons, swaps }, {
          line: 'place',
          highlight: [pos - 1],
          comparisonText: `coloca fase: escribe ${v} en out[${pos - 1}] (cubeta[${v}] tenía ${counts[v]})`,
          description: `Fase de colocación: escribimos el valor ${v} en su posición final`,
        })
      )
    }
  }

  steps.push(
    finish(out, { comparisons, swaps }, `Ordenado con ${comparisons} lecturas y ${swaps} colocaciones — sin comparaciones entre pares, estable`, {
      sortedFrom: 0,
      line: 'done',
    })
  )
  return steps
}
