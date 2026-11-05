import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseArray } from '../../algorithms/input'
import type { AlgorithmMeta, SortFrame } from '../../algorithms/frameTypes'

/**
 * Shared frame player for every sort algorithm (issue #2, slice 1).
 * Owns the seed array + playback state and renders the input card, bars,
 * controls, live counters, big-O table and movement matrix from ONE
 * implementation. `renderAside` lets a specific algorithm inject its own
 * panel (e.g. the Bubble pseudo-code trace) fed with the current frame.
 */

type Speed = 'slow' | 'normal' | 'fast'

const SPEED_MS: Record<Speed, number> = { slow: 1200, normal: 650, fast: 250 }
const SPEED_LABEL: Record<Speed, string> = { slow: 'Lenta', normal: 'Normal', fast: 'Rápida' }

const DEFAULT_ARRAY = [5, 1, 4, 2, 8]

interface SortVisualizerProps {
  meta: AlgorithmMeta
  renderAside?: (frame: SortFrame) => ReactNode
}

export default function SortVisualizer({ meta, renderAside }: SortVisualizerProps) {
  const [inputText, setInputText] = useState(DEFAULT_ARRAY.join(', '))
  const [array, setArray] = useState<number[]>(DEFAULT_ARRAY)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [speed, setSpeed] = useState<Speed>('normal')

  // Frames are deterministic from the seed array (no Math.random inside).
  const frames = useMemo(() => meta.build(array), [meta, array])
  const safeIndex = Math.min(stepIndex, frames.length - 1)
  const step = frames[safeIndex]
  const atEnd = frames.length === 0 || safeIndex >= frames.length - 1
  const maxVal = Math.max(...step.arr.map(Math.abs), 1)

  // Playback timer
  useEffect(() => {
    if (!playing) return
    if (atEnd) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, frames.length - 1))
    }, SPEED_MS[speed])
    return () => clearTimeout(id)
  }, [playing, safeIndex, speed, frames.length, atEnd])

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
    setStepIndex((i) => Math.min(i + 1, frames.length - 1))
  }, [frames.length])

  // Executed rows for the movement matrix (skips the initial snapshot).
  const executedRows = useMemo(() => frames.slice(1, safeIndex + 1), [frames, safeIndex])

  return (
    <div className="space-y-5">
      {/* Seed array input */}
      <div className="bg-card rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">Array a ordenar</label>
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

      {/* Playback controls */}
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

        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: `${(safeIndex / Math.max(frames.length - 1, 1)) * 100}%` }}
            />
          </div>
          <span className="text-[0.65rem] text-text-tertiary tabular-nums whitespace-nowrap">
            paso {safeIndex}/{Math.max(frames.length - 1, 0)}
          </span>
        </div>
      </div>

      {/* Bars + per-algorithm aside */}
      <div className="flex flex-wrap gap-5">
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
              const isPair = step.compare?.includes(idx) ?? false
              const isSwapping = step.swap?.includes(idx) ?? false
              const isSorted = step.sortedFrom >= 0 && idx >= step.sortedFrom
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
              <p className="text-sm font-semibold text-success">✓ Algoritmo terminado</p>
              <p className="text-[0.65rem] text-text-secondary mt-0.5">
                {step.comparisons} comparacion{step.comparisons === 1 ? '' : 'es'} y {step.swaps}{' '}
                intercambio{step.swaps === 1 ? '' : 's'} en total
              </p>
            </div>
          )}
        </div>

        {/* Live counters + big-O table */}
        <div className="w-full lg:w-[300px] max-lg:flex-1 min-w-[280px] bg-card rounded-xl p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Contadores en vivo</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="metric-box py-2 px-3">
                <p className="text-[0.6rem] text-text-secondary">comparaciones</p>
                <p className="text-sm font-semibold tabular-nums text-text-primary">{step.comparisons}</p>
              </div>
              <div className="metric-box py-2 px-3">
                <p className="text-[0.6rem] text-text-secondary">intercambios</p>
                <p className="text-sm font-semibold tabular-nums text-text-primary">{step.swaps}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Complejidad (Big-O)</h3>
            <table className="w-full text-left">
              <tbody>
                {(
                  [
                    ['mejor', meta.bigO.best],
                    ['promedio', meta.bigO.avg],
                    ['peor', meta.bigO.worst],
                    ['espacio', meta.bigO.space],
                  ] as const
                ).map(([k, v]) => (
                  <tr key={k} className="table-row">
                    <td className="py-1.5 pr-3 text-[0.7rem] text-text-secondary capitalize">{k}</td>
                    <td className="py-1.5 pr-3 text-[0.7rem] text-text-primary mono tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[0.6rem] text-text-tertiary mt-2">
              {meta.stable ? 'Estable: preserva el orden relativo de iguales' : 'Inestable: puede reordenar iguales'}
            </p>
          </div>
        </div>

        {renderAside && <div className="w-full lg:w-[360px] max-lg:flex-1 min-w-[300px] space-y-4">{renderAside(step)}</div>}
      </div>

      {/* Movement matrix */}
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
                  <th className="py-2 pr-3 font-semibold">Paso</th>
                  <th className="py-2 pr-3 font-semibold">Comparación</th>
                  <th className="py-2 pr-3 font-semibold">¿Intercambia?</th>
                  <th className="py-2 pr-3 font-semibold">Array resultante</th>
                </tr>
              </thead>
              <tbody>
                {executedRows.map((row, idx) => {
                  const isSwap = row.swap !== null
                  return (
                    <tr key={idx} className="table-row">
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-tertiary tabular-nums">{idx + 1}</td>
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-secondary">{row.line || '—'}</td>
                      <td className="py-1.5 pr-3 text-[0.7rem] text-text-primary mono">{row.comparisonText || '—'}</td>
                      <td className="py-1.5 pr-3 text-[0.7rem]">
                        {isSwap ? (
                          <span className="px-1.5 py-0.5 rounded bg-danger/10 text-danger font-medium">Sí</span>
                        ) : row.done ? (
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
