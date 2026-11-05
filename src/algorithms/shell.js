/** Shell Sort frame engine — gapped insertion sort over Ciura gaps, deterministic, pure. */
import { snap, finish } from './frameTypes.js'

export const SHELL_META = {
  id: 'shell',
  label: 'Shell Sort',
  icon: '🐚',
  build: generateShell,
  bigO: { best: 'O(n log n)', avg: 'depende del gap', worst: 'O(n²)', space: 'O(1)' },
  stable: false,
}

/** Ciura sequence; arrays capped at 24 items so no extension is needed. */
const CIURA = [1750, 701, 301, 132, 57, 23, 10, 4, 1]

/**
 * Shell Sort: insertion sort with shrinking strides (Ciura gaps).
 * Each 'gap' frame announces the current stride, then 'compare'/'shift'
 * frames play a normal insertion pass over indices spaced `gap` apart.
 * Shifts count as swaps (like Insertion Sort).
 */
export function generateShell(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0

  steps.push(snap(arr, { comparisons, swaps }, { line: 'outer', description: 'Estado inicial — listo para las pasadas de Ciura' }))

  if (n <= 1) {
    steps.push(finish(arr, { comparisons, swaps }, 'El array ya está ordenado (n ≤ 1)', { line: 'done' }))
    return steps
  }

  const gaps = CIURA.filter((g) => g < n)
  for (const gap of gaps) {
    steps.push(
      snap(arr, { comparisons, swaps }, {
        line: 'gap',
        highlight: range(0, gap),
        comparisonText: `gap actual = ${gap}`,
        description: `Pasada con gap ${gap}: comparamos elementos a distancia ${gap}`,
      })
    )
    for (let i = gap; i < n; i++) {
      const key = arr[i]
      let j = i - gap

      while (j >= 0) {
        comparisons++
        const a = arr[j]
        const shift = a > key
        steps.push(
          snap(arr, { comparisons, swaps }, {
            i,
            j,
            line: 'compare',
            compare: [j, i],
            comparisonText: `arr[${j}] (${a}) ${shift ? '>' : '≤'} key (${key}) · gap ${gap}`,
            description: shift
              ? `${a} > ${key}: lo corremos ${gap} posiciones a la derecha`
              : `${a} ≤ ${key}: ${key} se inserta en arr[${j + gap}]`,
          })
        )
        if (!shift) break
        arr[j + gap] = arr[j]
        swaps++
        steps.push(
          snap(arr, { comparisons, swaps }, {
            i,
            j,
            line: 'shift',
            swap: [j, j + gap],
            comparisonText: `shift arr[${j}] → arr[${j + gap}] · gap ${gap}`,
            description: `Corrimiento: ${a} pasa de arr[${j}] a arr[${j + gap}]`,
          })
        )
        j -= gap
      }

      arr[j + gap] = key
      steps.push(
        snap(arr, { comparisons, swaps }, {
          i,
          j: j + gap,
          line: 'place',
          highlight: [j + gap],
          comparisonText: `key (${key}) → arr[${j + gap}] · gap ${gap}`,
          description: `${key} quedó en la posición ${j + gap} (cadena de gap ${gap})`,
        })
      )
    }
  }

  steps.push(
    finish(arr, { comparisons, swaps }, `Ordenado con ${comparisons} comparaciones y ${swaps} corrimiento${swaps === 1 ? '' : 's'} (inestable)`, {
      sortedFrom: 0,
      line: 'done',
    })
  )
  return steps
}

/** Inclusive-exclusive index range [a, b). */
function range(a, b) {
  const out = []
  for (let k = a; k < b; k++) out.push(k)
  return out
}
