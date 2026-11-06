/** LSD Radix Sort (base 10) frame engine — non-negative integers, pure. */
import { snap, finish } from './frameTypes.js'

export const RADIX_META = {
  id: 'radix',
  label: 'Radix Sort',
  icon: '🌌',
  build: generateRadix,
  bigO: { best: 'O(d×(n+b))', avg: 'O(d×(n+b))', worst: 'O(d×(n+b))', space: 'O(n+b)' },
  stable: true,
  // non-negative integers only: digit extraction assumes unsigned values.
  // SortVisualizer rejects negatives at parse time via this flag.
  nonNegative: true,
}

const DIGIT_NAMES = ['unidades', 'decenas', 'centenas', 'millares', 'diez-millares', 'cien-millares']

/**
 * Radix Sort LSD (base 10): one pass per decimal digit, least significant first.
 *
 * Frame contract per pass:
 *   - 'digit-pass' frame announces the pass (digit name in the description).
 *   - 'digit' frames read each value and highlight its index; the note carries
 *     `dígito d de valor v = k → cubeta k` (digit + bucket observation).
 *   - 'place' frames write the buckets back into the array, one frame per write.
 * Counters reuse the shared fields: `comparisons` counts digit reads, `swaps`
 * counts writes-back. No negatives: the meta declares `nonNegative`.
 */
export function generateRadix(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0

  steps.push(
    snap(arr, { comparisons, swaps }, {
      line: 'outer',
      description: `Estado inicial — Radix Sort LSD base 10: una pasada por dígito, del menos al más significativo`,
    })
  )

  if (n <= 1) {
    steps.push(finish(arr, { comparisons, swaps }, n === 0 ? 'Array vacío: nada que ordenar' : 'El array ya está ordenado (n ≤ 1)', { line: 'done' }))
    return steps
  }

  const maxDigits = String(Math.max(...arr)).length

  for (let d = 1; d <= maxDigits; d++) {
    const divisor = 10 ** (d - 1)
    const digitName = DIGIT_NAMES[d - 1] ?? `10^${d - 1}`
    steps.push(
      snap(arr, { comparisons, swaps }, {
        line: 'digit-pass',
        description: `Pasada ${d}/${maxDigits} por dígito (${digitName}): cada valor va a la cubeta de su dígito ${digitName}`,
      })
    )

    // Distribute by digit d into 10 buckets (stable order preserved).
    const buckets = Array.from({ length: 10 }, () => [])
    for (let i = 0; i < n; i++) {
      const digit = Math.floor(arr[i] / divisor) % 10
      buckets[digit].push(arr[i])
      comparisons++
      steps.push(
        snap(arr, { comparisons, swaps }, {
          i,
          line: 'digit',
          highlight: [i],
          comparisonText: `dígito ${digitName} de valor ${arr[i]} = ${digit} → cubeta ${digit}`,
          description: `Leemos el dígito ${digitName} de ${arr[i]} y lo enviamos a la cubeta ${digit}`,
        })
      )
    }

    // Collect buckets in digit order back into the array.
    let pos = 0
    for (let b = 0; b < 10; b++) {
      for (const v of buckets[b]) {
        arr[pos] = v
        pos++
        swaps++
        steps.push(
          snap(arr, { comparisons, swaps }, {
            line: 'place',
            highlight: [pos - 1],
            comparisonText: `cubeta ${b} (${digitName}) → out[${pos - 1}] escribe ${v}`,
            description: `Recolectamos las cubetas en orden: tras la pasada por ${digitName} el array queda parcialmente ordenado por ese dígito`,
          })
        )
      }
    }
  }

  steps.push(
    finish(arr, { comparisons, swaps }, `Ordenado con ${comparisons} lecturas de dígito y ${swaps} escrituras en ${maxDigits} pasada${maxDigits === 1 ? '' : 's'} — estable`, {
      sortedFrom: 0,
      line: 'done',
    })
  )
  return steps
}
