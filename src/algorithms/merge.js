/** Merge Sort frame engine — iterative bottom-up merging, deterministic, pure. */
import { snap, finish } from './frameTypes.js'

export const MERGE_META = {
  id: 'merge',
  label: 'Merge Sort',
  icon: '🔀',
  build: generateMerge,
  bigO: { best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)' },
  stable: true,
  pseudocode: {
    lines: [
      'for width in 1, 2, 4, … < n:',
      '    for lo in range(0, n - width, 2 * width):',
      '        merge(arr, lo, lo + width, min(lo + 2*width, n))  # fusion',
      '    width = width * 2',
    ],
    mapping: { outer: 0, split: 1, merge: 2, merged: 2, done: null },
  },
}

/**
 * Merge Sort (bottom-up): width 1, 2, 4… merges adjacent sorted runs.
 * Frames highlight both ranges being merged (`highlight`) and the exact
 * pair compared (`compare`). No tree view: the level is described in
 * `line` ('split' announces the width, 'merge' steps through it) and
 * counters (+1 per write) live in the shared fields.
 */
export function generateMerge(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0

  steps.push(snap(arr, { comparisons, swaps }, { line: 'outer', description: 'Estado inicial — anchura de fusión 1: pares adyacentes' }))

  if (n <= 1) {
    steps.push(finish(arr, { comparisons, swaps }, 'El array ya está ordenado (n ≤ 1)', { line: 'done' }))
    return steps
  }

  const aux = new Array(n)
  for (let width = 1; width < n; width *= 2) {
    steps.push(
      snap(arr, { comparisons, swaps }, {
        line: 'split',
        description: `Nivel: fusión de corridas de ${width} elemento${width === 1 ? '' : 's'} — el array se fusiona por bloques`,
      })
    )
    for (let lo = 0; lo < n - width; lo += 2 * width) {
      const mid = lo + width
      const hi = Math.min(lo + 2 * width, n)
      let i = lo
      let j = mid
      let k = lo

      while (i < mid && j < hi) {
        comparisons++
        const a = arr[i]
        const b = arr[j]
        const takeLeft = a <= b
        if (takeLeft) {
          aux[k++] = arr[i++]
        } else {
          aux[k++] = arr[j++]
        }
        swaps++
        steps.push(
          snap(arr, { comparisons, swaps }, {
            i,
            j,
            line: 'merge',
            compare: takeLeft ? [i, j] : [i - 1, j],
            highlight: [...range(lo, mid), ...range(mid, hi)],
            comparisonText: `arr[${i - 1}] (${a}) ${takeLeft ? '≤' : '>'} arr[${j}] (${b}) → escribe ${takeLeft ? a : b}`,
            description: `Fusiona [${lo}..${mid - 1}] con [${mid}..${hi - 1}]: ${takeLeft ? a : b} sale primero`,
          })
        )
      }
      while (i < mid) {
        aux[k++] = arr[i++]
        swaps++
        steps.push(
          snap(arr, { comparisons, swaps }, {
            i,
            j,
            line: 'merge',
            highlight: [...range(lo, mid), ...range(mid, hi)],
            comparisonText: `resto izquierdo (${arr[i - 1]}) → salida`,
            description: `Rango derecho agotado: copiamos el resto de [${lo}..${mid - 1}]`,
          })
        )
      }
      while (j < hi) {
        aux[k++] = arr[j++]
        swaps++
        steps.push(
          snap(arr, { comparisons, swaps }, {
            i,
            j,
            line: 'merge',
            highlight: [...range(lo, mid), ...range(mid, hi)],
            comparisonText: `resto derecho (${arr[j - 1]}) → salida`,
            description: `Rango izquierdo agotado: copiamos el resto de [${mid}..${hi - 1}]`,
          })
        )
      }
      for (let t = lo; t < hi; t++) arr[t] = aux[t]
      steps.push(
        snap(arr, { comparisons, swaps }, {
          line: 'merged',
          highlight: range(lo, hi),
          sortedFrom: lo,
          comparisonText: `bloque [${lo}..${hi - 1}] escrito de vuelta`,
          description: `Corrida [${lo}..${hi - 1}] ahora ordenada localmente`,
        })
      )
    }
  }

  steps.push(
    finish(arr, { comparisons, swaps }, `Ordenado con ${comparisons} comparaciones y ${swaps} escritura${swaps === 1 ? '' : 's'} (estable)`, {
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
