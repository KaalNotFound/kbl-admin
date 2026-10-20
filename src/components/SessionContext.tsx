import { useState, useEffect } from 'react'
import type { SessionContextData, PendienteItem } from '../types'
import { fetchSessionContext } from '../api'

const PRIORITY_COLORS: Record<string, string> = {
  Alta: 'bg-red-500/10 text-red-400 border-red-500/20',
  Media: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Baja: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

function PendienteCard({ item }: { item: PendienteItem }) {
  return (
    <div className="bg-card border border-border-light rounded-lg p-4 space-y-2 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-text-primary text-sm leading-snug">{item.title}</h3>
        <span className={`shrink-0 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[item.priority] || 'bg-surface text-text-secondary border-border-light'}`}>
          {item.priority}
        </span>
      </div>
      {item.status && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${
            item.status.match(/Bloqueado|Pendiente/i) ? 'bg-warning' :
            item.status.match(/Completado|Done|Completo/i) ? 'bg-success' :
            'bg-info'
          }`} />
          <span className="text-text-secondary">{item.status}</span>
        </div>
      )}
      {item.project && (
        <p className="text-[0.7rem] text-text-tertiary font-mono truncate">{item.project}</p>
      )}
      {item.what && (
        <p className="text-xs text-text-secondary line-clamp-2">{item.what}</p>
      )}
    </div>
  )
}

function CheckpointCard({ cp }: { cp: { date: string; file: string; summary: string; lines: number } }) {
  return (
    <div className="bg-card border border-border-light rounded-lg p-3 space-y-1.5 hover:border-accent/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-primary font-mono">{cp.date}</span>
        <span className="text-[0.6rem] text-text-tertiary">{cp.lines} líneas</span>
      </div>
      <p className="text-xs text-text-secondary line-clamp-2">{cp.summary}</p>
      <p className="text-[0.6rem] text-text-tertiary font-mono truncate">{cp.file}</p>
    </div>
  )
}

const STATUS_ORDER = ['Alta', 'Media', 'Baja']

/** Data provenance chip: opens the SSOT source note in Obsidian. */
function SourceChip({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open source note in Obsidian"
      className="inline-flex items-center text-[0.65rem] px-2 py-0.5 rounded-full border border-border-light text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
    >
      {label} ↗
    </a>
  )
}

export default function SessionContext() {
  const [data, setData] = useState<SessionContextData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterPriority, setFilterPriority] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const ctx = await fetchSessionContext()
        if (mounted) setData(ctx)
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-card rounded-lg w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 bg-card rounded-lg" />)}
      </div>
    </div>
  )

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <p className="text-red-400 text-sm font-medium">Error al cargar contexto</p>
      <p className="text-red-400/60 text-xs mt-1">{error}</p>
    </div>
  )

  if (!data) return (
    <div className="text-center py-12 text-text-tertiary text-sm">Sin datos de contexto</div>
  )

  const pendientes = data.pendientes || []
  const grouped = STATUS_ORDER.map(p => ({
    priority: p,
    items: pendientes.filter(i => i.priority === p),
  })).filter(g => g.items.length > 0)

  const filtered = filterPriority
    ? grouped.filter(g => g.priority === filterPriority)
    : grouped

  return (
    <div className="space-y-8">
      {/* Pendientes Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span>📋</span> Pendientes ({pendientes.length})
          </h2>
          <div className="flex items-center gap-2">
            {data.sources?.find(s => s.file === '_PENDIENTES.md') && (
              <SourceChip url={data.sources.find(s => s.file === '_PENDIENTES.md')!.obsidian_url} label="Edit in Obsidian" />
            )}
            <div className="flex gap-1.5">
            {['all', ...STATUS_ORDER].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p === 'all' ? null : p)}
                className={`text-[0.65rem] px-2.5 py-1 rounded-full border transition-colors ${
                  filterPriority === (p === 'all' ? null : p)
                    ? 'bg-accent text-white border-accent'
                    : 'bg-card text-text-secondary border-border-light hover:border-accent/40'
                }`}
              >
                {p === 'all' ? 'Todas' : p}
              </button>
            ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary text-sm">
            {filterPriority ? `No hay pendientes de prioridad ${filterPriority}` : 'No hay pendientes'}
          </div>
        ) : (
          filtered.map(group => (
            <div key={group.priority} className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${
                  group.priority === 'Alta' ? 'bg-red-400' :
                  group.priority === 'Media' ? 'bg-yellow-400' : 'bg-blue-400'
                }`} />
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {group.priority}
                </span>
                <span className="text-[0.6rem] text-text-tertiary">({group.items.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {group.items.map((item, i) => (
                  <PendienteCard key={`${item.title}-${i}`} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Roadmap Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <span>🗺️</span> Roadmap
          </h2>
          {data.sources?.find(s => s.file === '_ROADMAP.md') && (
            <SourceChip url={data.sources.find(s => s.file === '_ROADMAP.md')!.obsidian_url} label="Edit in Obsidian" />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current */}
          <div className="bg-card border border-accent/20 rounded-lg p-4">
            <p className="text-[0.6rem] uppercase tracking-wider text-accent font-semibold mb-2">Actual</p>
            <p className="text-sm text-text-primary">{data.roadmap.current || '—'}</p>
          </div>
          {/* Pending */}
          <div className="bg-card border border-border-light rounded-lg p-4">
            <p className="text-[0.6rem] uppercase tracking-wider text-text-tertiary font-semibold mb-2">
              Pendientes ({data.roadmap.pending.length})
            </p>
            <ul className="space-y-1">
              {data.roadmap.pending.slice(0, 8).map((item, i) => (
                <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                  <span className="text-warning mt-0.5 shrink-0">○</span>
                  <span className="line-clamp-1">{item}</span>
                </li>
              ))}
              {data.roadmap.pending.length > 8 && (
                <li className="text-[0.6rem] text-text-tertiary">+{data.roadmap.pending.length - 8} más</li>
              )}
            </ul>
          </div>
          {/* Completed */}
          <div className="bg-card border border-border-light rounded-lg p-4">
            <p className="text-[0.6rem] uppercase tracking-wider text-text-tertiary font-semibold mb-2">
              Completadas ({data.roadmap.completed.length})
            </p>
            <ul className="space-y-1">
              {data.roadmap.completed.slice(0, 8).map((item, i) => (
                <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                  <span className="text-success mt-0.5 shrink-0">✓</span>
                  <span className="line-clamp-1">{item}</span>
                </li>
              ))}
              {data.roadmap.completed.length > 8 && (
                <li className="text-[0.6rem] text-text-tertiary">+{data.roadmap.completed.length - 8} más</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Checkpoints Section */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <span>📜</span> Últimos Checkpoints
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.checkpoints.map((cp, i) => (
            <CheckpointCard key={`${cp.date}-${i}`} cp={cp} />
          ))}
        </div>
      </section>
    </div>
  )
}
