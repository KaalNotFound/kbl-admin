/** Raw array input parsing shared by every sort visualizer. */

/** Parse "4, 2, 7, 1" or "[4, 2, 7, 1]" into an integer array. */
export function parseArray(raw: string): { values?: number[]; error?: string } {
  const cleaned = raw.replace(/[[\]]/g, ' ').trim()
  if (cleaned.length === 0) return { error: 'Ingresá al menos un número.' }

  const parts = cleaned.split(/[\s,]+/).filter((p) => p.length > 0)
  if (parts.length === 0) return { error: 'Ingresá al menos un número.' }
  if (parts.length > 24) return { error: 'Máximo 24 números para que se vea bien.' }

  const values: number[] = []
  for (const p of parts) {
    if (!/^-?\d+$/.test(p)) {
      return { error: `"${p}" no es un número entero.` }
    }
    values.push(parseInt(p, 10))
  }
  return { values }
}
