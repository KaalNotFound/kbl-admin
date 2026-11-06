/** Insertion Sort frame engine — grows a sorted prefix, deterministic, pure. */
import { snap, finish } from './frameTypes.js'

export const INSERTION_META = {
  id: 'insertion',
  label: 'Insertion Sort',
  icon: '⤵️',
  build: generateInsertion,
  bigO: { best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)' },
  stable: true,
  pseudocode: {
    lines: [
      'for i in range(1, n):',
      '    key = arr[i]',
      '    j = i - 1',
      '    while j >= 0 and arr[j] > key:',
      '        arr[j + 1] = arr[j]',
      '        j = j - 1',
      '    arr[j + 1] = key  # inserción',
    ],
    mapping: { outer: 0, pick: 1, compare: 3, shift: 4, place: 6, done: null },
  },
}

/** Insertion Sort: grows a sorted prefix; shifts count as swaps. */
export function generateInsertion(input) {
  const arr = [...input]
  const n = arr.length
  const steps = []
  let comparisons = 0
  let swaps = 0

  steps.push(snap(arr, { comparisons, swaps }, { line: 'outer', sortedFrom: 1, description: 'Estado inicial — el prefijo arr[0] ya está "ordenado"' }))

  if (n <= 1) {
    steps.push(finish(arr, { comparisons, swaps }, 'El array ya está ordenado (n ≤ 1)', { line: 'done' }))
    return steps
  }

  for (let i = 1; i < n; i++) {
    const key = arr[i]
    let j = i - 1

    steps.push(
      snap(arr, { comparisons, swaps }, {
        i,
        j,
        line: 'pick',
        highlight: [i],
        sortedFrom: -1,
        comparisonText: `key = arr[${i}] (${key})`,
        description: `Pasada ${i}: tomamos ${key} y lo insertamos en el prefijo ordenado [0..${i - 1}]`,
      })
    )

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
          comparisonText: `arr[${j}] (${a}) ${shift ? '>' : '≤'} key (${key})`,
          description: shift
            ? `${a} > ${key}: lo corremos una posición a la derecha`
            : `${a} ≤ ${key}: ${key} se inserta en arr[${j + 1}]`,
        })
      )
      if (!shift) break
      arr[j + 1] = arr[j]
      swaps++
      steps.push(
        snap(arr, { comparisons, swaps }, {
          i,
          j,
          line: 'shift',
          swap: [j, j + 1],
          comparisonText: `shift arr[${j}] → arr[${j + 1}]`,
          description: `Corrimiento: ${a} pasa de arr[${j}] a arr[${j + 1}]`,
        })
      )
      j--
    }

    arr[j + 1] = key
    steps.push(
      snap(arr, { comparisons, swaps }, {
        i,
        j: j + 1,
        line: 'place',
        highlight: [j + 1],
        sortedFrom: i + 1,
        comparisonText: `key (${key}) → arr[${j + 1}]`,
        description: `${key} quedó en la posición ${j + 1}: prefijo [0..${i}] ordenado`,
      })
    )
  }

  steps.push(
    finish(arr, { comparisons, swaps }, `Ordenado con ${comparisons} comparaciones y ${swaps} corrimiento${swaps === 1 ? '' : 's'}`, {
      sortedFrom: 0,
      line: 'done',
    })
  )
  return steps
}
