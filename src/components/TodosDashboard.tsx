import { useState, useEffect } from 'react'
import { fetchTodos, fetchTodosMetrics, fetchTodosGraph, toggleTodo } from '../api'
import type { TodosResponse, TodosMetrics, TodosGraph, TodoState, TodoItem } from '../types'

const STATE_COLORS: Record<TodoState, string> = {
  backlog: 'bg-surface text-text-secondary',
  todo: 'bg-warning/15 text-warning',
  'in-progress': 'bg-accent-light text-accent',
  review: 'bg-accent-light text-accent',
  blocked: 'bg-danger/15 text-danger',
  done: 'bg-success/15 text-success',
  cancelled: 'bg-surface text-text-tertiary',
}

const STATE_DOT: Record<TodoState, string> = {
  backlog: 'bg-surface border border-border-light',
  todo: 'bg-warning',
  'in-progress': 'bg-accent',
  review: 'bg-accent',
  blocked: 'bg-danger',
  done: 'bg-success',
  cancelled: 'bg-surface',
}

const STATE_LABEL: Record<TodoState, string> = {
  backlog: 'Backlog',
  todo: 'Pendiente',
  'in-progress': 'En progreso',
  review: 'Revisión',
  blocked: 'Bloqueado',
  done: 'Hecho',
  cancelled: 'Cancelado',
}

export default function TodosDashboard() {
  const [todos, setTodos] = useState<TodosResponse | null>(null)
  const [metrics, setMetrics] = useState<TodosMetrics | null>(null)
  const [graph, setGraph] = useState<TodosGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  // Phase 4 write-back: one toggle in flight at a time; failures surface as
  // an inline '!' on the row (button becomes the retry affordance). Strategy:
  // INTEGRATE the server-returned refreshed item into local state (no full
  // refetch here) — navigating away and back re-runs the mount fetch and
  // re-syncs counts with the SSOT.
  const [toggling, setToggling] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchTodos(), fetchTodosMetrics(), fetchTodosGraph()])
      .then(([t, m, g]) => { setTodos(t); setMetrics(m); setGraph(g) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!todos) return <div className="card p-5 text-text-secondary">No se pudo cargar el TODO del vault</div>

  // Visual done state: the parser models done via `state === 'done'` (no
  // separate done/completed field) — that is the `item.done` equivalent.
  const isDone = (t: TodoItem) => t.state === 'done'
  const toggleKey = (t: TodoItem) => `${t.id}:${t.line ?? 0}`

  const onToggle = async (t: TodoItem) => {
    if (toggling) return
    const key = toggleKey(t)
    setToggling(key)
    setToggleError(null)
    try {
      const res = await toggleTodo({ id: t.id, line: t.line })
      if (!res.ok && res.error) {
        console.warn('[todos] toggle failed:', res.error)
        setToggleError(key)
        return
      }
      // Integrate the returned (re-parsed) item — the SSOT file is the
      // server-side truth and this row is now byte-aligned with it.
      setTodos(prev => prev ? {
        ...prev,
        active: prev.active.map(it =>
          it.id === res.item.id && (it.line ?? 0) === (res.item.line ?? 0) ? res.item : it),
      } : prev)
    } catch (e) {
      console.warn('[todos] toggle request failed:', e)
      setToggleError(key)
    } finally {
      setToggling(null)
    }
  }

  const c = todos.counts
  const inFlight = c['in-progress'] + c.review
  const waiting = c.todo + c.backlog

  const list = filter === 'all' ? todos.active
    : filter === 'active' ? todos.active.filter(t => t.state !== 'done')
    : todos.active.filter(t => t.state === 'done')

  const copyMermaid = () => {
    if (!graph) return
    navigator.clipboard.writeText(graph.mermaid).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards — TODO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            TODOs totales
            {todos.sources?.[0] && (
              <a
                href={todos.sources[0].obsidian_url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open source note in Obsidian"
                className="float-right -mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full border border-border-light text-text-secondary text-[0.6rem] normal-case tracking-normal font-medium hover:border-accent/40 hover:text-accent transition-colors"
              >Open _PENDING.md ↗</a>
            )}
          </h3>
          <p className="text-3xl font-bold text-text-primary mt-1">{todos.total}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">SSOT _PENDING.md</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">En vuelo</h3>
          <p className="text-3xl font-bold text-accent mt-1">{inFlight}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">en-progreso + revisión</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Esperando</h3>
          <p className="text-3xl font-bold text-warning mt-1">{waiting}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">pendiente + backlog</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Hechos</h3>
          <p className="text-3xl font-bold text-success mt-1">{c.done}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">cerrados en _HECHOS</p>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Distribución por estado</h3>
        {todos.total > 0 && (
          <div className="h-4 rounded-full overflow-hidden flex">
            <div className="bg-warning" style={{ width: `${(c.todo / todos.total) * 100}%` }} title={`${c.todo} pendiente`} />
            <div className="bg-accent" style={{ width: `${(inFlight / todos.total) * 100}%` }} title={`${inFlight} en vuelo`} />
            <div className="bg-surface" style={{ width: `${(c.backlog / todos.total) * 100}%` }} title={`${c.backlog} backlog`} />
            <div className="bg-danger" style={{ width: `${(c.blocked / todos.total) * 100}%` }} title={`${c.blocked} bloqueado`} />
            <div className="bg-success" style={{ width: `${(c.done / todos.total) * 100}%` }} title={`${c.done} hecho`} />
          </div>
        )}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Pendiente ({c.todo})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent" /> En vuelo ({inFlight})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface" /> Backlog ({c.backlog})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> Bloqueado ({c.blocked})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Hecho ({c.done})</span>
        </div>
      </div>

      {/* Vault graph — SVG + Mermaid source */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Grafo del vault</h3>
          <button
            onClick={copyMermaid}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface text-text-secondary hover:bg-accent-light hover:text-accent transition-colors"
          >
            {copied ? '✓ Copiado' : 'Copiar Mermaid'}
          </button>
        </div>
        {graph && <VaultGraphSvg graph={graph} />}
        {graph && (
          <pre className="mt-4 p-3 rounded-lg bg-surface text-[0.7rem] text-text-tertiary overflow-x-auto font-mono">{graph.mermaid}</pre>
        )}
      </div>

      {/* Real-time metrics */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Excepciones</h3>
            <p className={`text-3xl font-bold mt-1 ${metrics.exceptions.by_status.fail > 0 ? 'text-danger' : 'text-text-primary'}`}>
              {metrics.exceptions.total}
            </p>
            <p className="text-[0.7rem] text-text-tertiary mt-1">
              {metrics.exceptions.by_status.fail} fail · {metrics.exceptions.by_status.warn} warn
            </p>
          </div>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Sesiones</h3>
            <p className="text-3xl font-bold text-text-primary mt-1">{metrics.sessions.total}</p>
            <p className="text-[0.7rem] text-text-tertiary mt-1 truncate">{metrics.sessions.last || '—'}</p>
          </div>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Operaciones</h3>
            <p className="text-3xl font-bold text-text-primary mt-1">{metrics.operational.total}</p>
            <p className="text-[0.7rem] text-text-tertiary mt-1">traces en operational-log</p>
          </div>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Huérfanos</h3>
            <p className={`text-3xl font-bold mt-1 ${(graph?.orphan_count ?? 0) > 0 ? 'text-warning' : 'text-success'}`}>
              {graph?.orphan_count ?? '—'}
            </p>
            <p className="text-[0.7rem] text-text-tertiary mt-1">broken: {graph?.broken_count ?? '—'}</p>
          </div>
        </div>
      )}

      {/* Top failing gates */}
      {metrics && metrics.exceptions.top_gates.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Top gates con excepciones</h3>
          <div className="space-y-2">
            {metrics.exceptions.top_gates.map(g => (
              <div key={g.gate} className="flex items-center gap-3">
                <span className="w-32 text-xs font-mono text-text-secondary truncate">{g.gate}</span>
                <div className="flex-1 h-3 rounded-full bg-surface overflow-hidden">
                  <div
                    className={`h-full rounded-full ${g.count > 100 ? 'bg-danger' : 'bg-warning'}`}
                    style={{ width: `${Math.min(100, (g.count / metrics.exceptions.top_gates[0].count) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-text-tertiary">{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODO list */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">TODOs activos</h3>
          <div className="flex gap-2">
            {(['all', 'active', 'done'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filter === f
                    ? 'bg-accent-light text-accent border border-accent/20'
                    : 'bg-surface text-text-secondary border border-transparent hover:bg-surface'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'active' ? 'En vuelo' : 'Hechos'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1 max-h-[480px] overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-text-secondary text-sm py-3">Sin TODOs en esta vista</p>
          ) : (
            list.map(t => {
              const key = toggleKey(t)
              const done = isDone(t)
              return (
                <div key={key} className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-surface transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      aria-label="Toggle todo"
                      title={done ? 'Marcar como pendiente' : 'Marcar como hecho'}
                      disabled={toggling !== null}
                      onClick={() => onToggle(t)}
                      className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[0.65rem] leading-none transition-colors ${
                        done
                          ? 'bg-success/15 border-success/50 text-success'
                          : 'bg-surface border-border-light text-transparent hover:border-accent/50'
                      } ${toggling ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                    >
                      {toggleError === key ? <span className="text-danger font-bold">!</span> : done ? '✓' : ''}
                    </button>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATE_DOT[t.state]}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{t.title}</p>
                      {t.updated && <p className="text-[0.65rem] text-text-tertiary">última actualización: {t.updated}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[0.65rem] font-semibold ${STATE_COLORS[t.state]}`}>
                      {STATE_LABEL[t.state]}
                    </span>
                    {t.priority && (
                      <span className={`text-xs ${t.priority.includes('Alta') || t.priority.includes('🔴') ? 'text-danger' : t.priority.includes('Media') ? 'text-warning' : 'text-text-tertiary'}`}>
                        {t.priority}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── SVG graph (no deps) ──
function VaultGraphSvg({ graph }: { graph: TodosGraph }) {
  const W = 860, H = 420
  const cx = W / 2
  const areaCols = 4
  const boxW = 150, boxH = 54
  const startX = cx - (areaCols * boxW + (areaCols - 1) * 24) / 2
  const yArea = 170

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-surface/40">
      {/* VAULT root */}
      <rect x={cx - 110} y={24} width={220} height={44} rx={10} className="fill-accent-light stroke-accent" />
      <text x={cx} y={52} textAnchor="middle" className="fill-accent font-semibold" fontSize="14">🏛 KBL_SYSTEM</text>

      {/* areas */}
      {graph.nodes.map((n, i) => {
        const col = i % areaCols
        const row = Math.floor(i / areaCols)
        const x = startX + col * (boxW + 24)
        const y = yArea + row * (boxH + 20)
        return (
          <g key={n.id}>
            <line x1={cx} y1={70} x2={x + boxW / 2} y2={y} className="stroke-border-light" strokeWidth="1.2" />
            <rect x={x} y={y} width={boxW} height={boxH} rx={8} className="fill-card stroke-border-light" />
            <text x={x + boxW / 2} y={y + 22} textAnchor="middle" className="fill-text-primary" fontSize="11" fontWeight="600">{n.label}</text>
            <text x={x + boxW / 2} y={y + 40} textAnchor="middle" className="fill-text-tertiary" fontSize="10">{n.md_notes} notas md</text>
          </g>
        )
      })}

      {/* orphans/broken warning */}
      {(graph.orphan_count ?? 0) > 0 && (
        <g>
          <line x1={cx} y1={70} x2={W - 170} y2={360} className="stroke-border-light" strokeWidth="1.2" strokeDasharray="5 4" />
          <rect x={W - 250} y={336} width={190} height={56} rx={8} className="fill-warning/10 stroke-warning" />
          <text x={W - 155} y={360} textAnchor="middle" className="fill-warning font-semibold" fontSize="12">⚠ Huérfanos: {graph.orphan_count}</text>
          <text x={W - 155} y={378} textAnchor="middle" className="fill-text-tertiary" fontSize="10">broken: {graph.broken_count ?? '—'}</text>
        </g>
      )}
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-3 bg-surface rounded w-1/2 mb-2" />
            <div className="h-8 bg-surface rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
