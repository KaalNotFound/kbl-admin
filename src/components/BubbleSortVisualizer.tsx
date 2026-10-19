import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Bubble Sort con early-exit (el mismo algoritmo que se estudia):
 *
 *   for i in range(n - 1):
 *       swapped = False
 *       for j in range(0, n - i - 1):
 *           if arr[j] > arr[j + 1]:
 *               arr[j], arr[j + 1] = arr[j + 1], arr[j]  # intercambio
 *               swapped = True
 *       if not swapped:
 *           break
 *
 * La traza se precomputa una vez por array: cada elemento es una foto del estado
 * tras una micro-acción (comparación, intercambio, fin de pasada o fin).
 * Avanzar un paso hacia adelante sólo incrementa un índice; "Reiniciar" lo pone en 0.
 */

type LineKey = 'outer' | 'compare' | 'swap' | 'break' | 'done'
type Speed = 'slow' | 'normal' | 'fast'

interface TraceStep {
  arr: number[]
  i: number
  j: number | null
  swapped: boolean
  line: LineKey
  comparePair: [number, number] | null
  comparisonText: string
  willSwap: boolean
  swappedNow: boolean
  sortedTailStart: number
  done: boolean
  comparisons: number
  swaps: number
  description: string
}

const SPEED_MS: Record<Speed, number> = { slow: 1200, normal: 650, fast: 250 }
const SPEED_LABEL: Record<Speed, string> = { slow: 'Lenta', normal: 'Normal', fast: 'Rápida' }

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
  break: 6,
  done: null,
}

const DEFAULT_ARRAY = [5, 1, 4, 2, 8]

/** Simula bubble sort y devuelve la traza completa de micro-pasos. */
export function buildTrace(input: number[]): TraceStep[] {
  const arr = [...input]
  const n = arr.length
  const steps: TraceStep[] = []
  let comparisons = 0
  let swaps = 0

  const snapshot = (
    i: number,
    j: number | null,
    swapped: boolean,
    line: LineKey,
    comparePair: [number, number] | null,
    comparisonText: string,
    willSwap: boolean,
    swappedNow: boolean,
    sortedTailStart: number,
    done: boolean,
    description: string,
  ): TraceStep => ({
    arr: [...arr],
    i,
    j,
    swapped,
    line,
    comparePair,
    comparisonText,
    willSwap,
    swappedNow,
    sortedTailStart,
    done,
    comparisons,
    swaps,
    description,
  })

  steps.push(
    snapshot(-1, null, false, 'outer', null, '', false, false, n, false,
      'Estado inicial — listo para comenzar'),
  )

  if (n <= 1) {
    steps.push(snapshot(0, null, false, 'done', null, '', false, false, 0, true,
      'El array ya está ordenado (n ≤ 1)'))
    return steps
  }

  for (let i = 0; i < n - 1; i++) {
    let swapped = false
    // Índices >= n - i ya quedaron fijos en pasadas anteriores.
    const tailBefore = n - i

    for (let j = 0; j < n - i - 1; j++) {
      comparisons++
      const a = arr[j]
      const b = arr[j + 1]
      const willSwap = a > b

      steps.push(
        snapshot(i, j, swapped, 'compare', [j, j + 1],
          `arr[${j}] (${a}) ${willSwap ? '>' : '≤'} arr[${j + 1}] (${b})`,
          willSwap, false, tailBefore, false,
          `Pasada ${i + 1} · j=${j}: ${a} ${willSwap ? '>' : '≤'} ${b} → ${willSwap ? 'intercambia' : 'no intercambia'}`),
      )

      if (willSwap) {
        const pair: [number, number] = [j, j + 1]
        ;[arr[j], arr[j + 1]] = [arr[j + 1], arr[j]]
        swaps++
        swapped = true
        steps.push(
          snapshot(i, j, swapped, 'swap', pair,
            `intercambio arr[${j}] ↔ arr[${j + 1}]`, true, true, tailBefore, false,
            `Intercambio: ${b} pasa a la posición ${j} y ${a} a la ${j + 1}`),
        )
      }
    }

    // Fin de la pasada interna: el mayor del tramo quedó en n - i - 1.
    const tailAfter = n - i - 1

    if (!swapped) {
      steps.push(
        snapshot(i, null, swapped, 'break', null, '', false, false, 0, true,
          `Pasada ${i + 1} sin intercambios → "if not swapped: break". Array ordenado.`),
      )
      return steps
    }

    steps.push(
      snapshot(i, null, swapped, 'break', null, '',
        false, false, tailAfter, false,
        `Fin de pasada ${i + 1}: el mayor (${arr[tailAfter]}) quedó fijo en la posición ${tailAfter}. swapped=True → continuar.`),
    )
  }

  // Última pasada ejecutada = n - 2, así "i + 1" refleja n - 1 pasadas.
  steps.push(
    snapshot(n - 2, null, false, 'done', null, '', false, false, 0, true,
      `Ordenado en ${n - 1} pasadas y ${comparisons} comparaciones`),
  )
  return steps
}

/** Parsea "4, 2, 7, 1" o "[4, 2, 7, 1]" a un array de enteros. */
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

export default function BubbleSortVisualizer() {
  const [inputText, setInputText] = useState(DEFAULT_ARRAY.join(', '))
  const [array, setArray] = useState<number[]>(DEFAULT_ARRAY)
  const [error, setError] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')

  const trace = useMemo(() => buildTrace(array), [array])
  const safeIndex = Math.min(stepIndex, trace.length - 1)
  const step = trace[safeIndex]
  const atEnd = safeIndex >= trace.length - 1
  const n = array.length
  const maxVal = Math.max(...array.map(Math.abs), 1)

  // Reproducción automática
  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, trace.length - 1))
    }, SPEED_MS[speed])
    return () => clearTimeout(id)
  }, [playing, safeIndex, speed, trace.length, atEnd])

  const resetRun = useCallback(() => {
    setPlaying(false)
    setStepIndex(0)
  }, [])

  const applyArray = useCallback((values: number[]) => {
    setArray(values)
    setInputText(values.join(', '))
    setError(null)
    setPlaying(false)
    setStepIndex(0)
  }, [])

  const handleGenerate = useCallback(() => {
    const { values, error: err } = parseArray(inputText)
    if (err || !values) {
      setError(err ?? 'Entrada inválida.')
      return
    }
    applyArray(values)
  }, [inputText, applyArray])

  const handleShuffle = useCallback(() => {
    const size = array.length > 0 ? array.length : 5
    const next = Array.from({ length: size }, () => Math.floor(Math.random() * 99) + 1)
    applyArray(next)
  }, [array.length, applyArray])

  const stepForward = useCallback(() => {
    setPlaying(false)
    setStepIndex((i) => Math.min(i + 1, trace.length - 1))
  }, [trace.length])

  // Filas ya ejecutadas para la matriz de movimientos (sin la foto inicial).
  const executedRows = useMemo(
    () => trace.slice(1, safeIndex + 1),
    [trace, safeIndex],
  )

  const comparingValue =
    step.comparePair && step.j !== null
      ? `${step.arr[step.comparePair[0]] ?? '—'} > ${step.arr[step.comparePair[1]] ?? '—'} ?`
      : '—'

  const activeCodeLine = LINE_TO_CODE[step.line]

  return (
    <div className="space-y-5">
      {/* ── Entrada de datos ─────────────────────────────────────────── */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              Array a ordenar
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate()
              }}
              placeholder="4, 2, 7, 1  o  [4, 2, 7, 1]"
              className="w-full"
            />
          </div>
          <button
            onClick={handleGenerate}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
          >
            Generar
          </button>
          <button onClick={handleShuffle} className="btn-ghost px-4 py-2.5">
            🎲 Barajar
          </button>
        </div>
        {error && <p className="text-xs text-danger mt-2">⚠ {error}</p>}
        <p className="text-[0.65rem] text-text-tertiary mt-2">
          Separá los números con comas o espacios. Los corchetes son opcionales. Máximo 24 valores.
        </p>
      </div>

      {/* ── Controles de ejecución ───────────────────────────────────── */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={stepForward}
            disabled={atEnd}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ⏭ Siguiente paso
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={atEnd}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-accent-light text-accent hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {playing ? '⏸ Pausa' : '▶ Reproducir'}
          </button>
          <button onClick={resetRun} className="btn-ghost px-4 py-2.5">
            ↺ Reiniciar
          </button>

          <div className="flex items-center gap-1 ml-auto bg-surface rounded-lg p-1">
            {(Object.keys(SPEED_MS) as Speed[]).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  speed === s ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {SPEED_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: `${(safeIndex / Math.max(trace.length - 1, 1)) * 100}%` }}
            />
          </div>
          <span className="text-[0.65rem] text-text-tertiary tabular-nums whitespace-nowrap">
            paso {safeIndex}/{trace.length - 1}
          </span>
        </div>
      </div>

      {/* ── Algoritmo + Debug ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-5">
        {/* Visualizador */}
        <div className="flex-1 min-w-[320px] bg-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">Visualización</h3>
            <div className="flex flex-wrap gap-3 text-[0.6rem] text-text-secondary">
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-warning inline-block" /> comparando</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-danger inline-block" /> intercambio</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-success inline-block" /> ordenado</span>
              <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> pendiente</span>
            </div>
          </div>

          <div className="flex items-end justify-center gap-1.5 h-56 px-1">
            {step.arr.map((v, idx) => {
              const isPair = step.comparePair?.includes(idx) ?? false
              const isSwapping = step.swappedNow && isPair
              const isSorted = idx >= step.sortedTailStart
              const color = isSwapping
                ? 'bg-danger'
                : isPair
                  ? 'bg-warning'
                  : isSorted
                    ? 'bg-success'
                    : 'bg-accent'
              const heightPct = Math.max(6, (Math.abs(v) / maxVal) * 100)
              return (
                <div key={idx} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                  <span className="text-[0.6rem] font-semibold text-text-secondary tabular-nums">{v}</span>
                  <div className="w-full flex items-end" style={{ height: '190px' }}>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ease-out ${color} ${
                        isSwapping ? '-translate-y-1 shadow-md' : ''
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[0.55rem] text-text-tertiary tabular-nums">{idx}</span>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-text-secondary mt-4 min-h-[1.25rem]">{step.description}</p>

          {step.done && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-success/10 border border-success/30">
              <p className="text-sm font-semibold text-success">
                ✓ Ordenado en {step.i + 1} pasada{step.i + 1 === 1 ? '' : 's'} y {step.comparisons} comparaciones
              </p>
              <p className="text-[0.65rem] text-text-secondary mt-0.5">
                {step.swaps} intercambio{step.swaps === 1 ? '' : 's'} en total
              </p>
            </div>
          )}
        </div>

        {/* Debug en vivo */}
        <div className="w-full lg:w-[360px] max-lg:flex-1 min-w-[300px] space-y-4">
          {/* Estado actual */}
          <div className="bg-card rounded-xl p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Estado de ejecución</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="i (pasada)" value={step.i >= 0 ? String(step.i) : '—'} />
              <StatBox label="j (interna)" value={step.j !== null ? String(step.j) : '—'} />
              <StatBox
                label="swapped"
                value={step.swapped ? 'True' : 'False'}
                accent={step.swapped ? 'success' : undefined}
              />
              <StatBox label="n - i - 1" value={step.i >= 0 ? String(Math.max(n - step.i - 1, 0)) : '—'} />
              <StatBox label="arr[j] > arr[j+1]" value={comparingValue} wide />
            </div>
          </div>

          {/* Código */}
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
        </div>
      </div>

      {/* ── Matriz de movimientos ────────────────────────────────────── */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Matriz de movimientos</h3>
          <span className="text-[0.65rem] text-text-tertiary">
            {executedRows.length} paso{executedRows.length === 1 ? '' : 's'} ejecutado{executedRows.length === 1 ? '' : 's'}
          </span>
        </div>

        {executedRows.length === 0 ? (
          <p className="text-xs text-text-secondary py-4 text-center">
            Presioná "Siguiente paso" o "Reproducir" para registrar movimientos.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-card">
                <tr className="table-header">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Pasada</th>
                  <th className="py-2 pr-3 font-semibold">j</th>
                  <th className="py-2 pr-3 font-semibold">Comparación</th>
                  <th className="py-2 pr-3 font-semibold">¿Intercambia?</th>
                  <th className="py-2 pr-3 font-semibold">Array resultante</th>
                </tr>
              </thead>
              <tbody>
                {executedRows.map((row, idx) => {
                  const isSwap = row.line === 'swap'
                  const isBreak = row.line === 'break'
                  const isDone = row.line === 'done'
                  return (
                    <tr key={idx} className="table-row">
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-tertiary tabular-nums">{idx + 1}</td>
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-secondary tabular-nums">
                        {row.i >= 0 ? row.i + 1 : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-secondary tabular-nums">
                        {row.j !== null ? row.j : '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-primary mono">
                        {isBreak ? (isDone ? 'fin' : 'fin de pasada') : row.comparisonText || '—'}
                      </td>
                      <td className="py-1.5 pr-3 text-[0.7rem]">
                        {isSwap ? (
                          <span className="px-1.5 py-0.5 rounded bg-danger/10 text-danger font-medium">Sí</span>
                        ) : isBreak || isDone ? (
                          <span className="text-text-tertiary">—</span>
                        ) : (
                          <span className="text-text-secondary">No</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-secondary mono whitespace-nowrap">
                        [{row.arr.join(', ')}]
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

interface StatBoxProps {
  label: string
  value: string
  accent?: 'success'
  wide?: boolean
}

function StatBox({ label, value, accent, wide }: StatBoxProps) {
  const valueColor = accent === 'success' ? 'text-success' : 'text-text-primary'
  return (
    <div className={`metric-box py-2 px-3 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-[0.6rem] text-text-secondary">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  )
}
