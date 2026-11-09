import { useState, useEffect } from 'react'
import { fetchQueue } from '../api'
import type { Queue } from '../types'

export default function QueueDashboard() {
  const [data, setData] = useState<Queue | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed'>('all')

  useEffect(() => {
    fetchQueue()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data) return <div className="card p-5 text-text-secondary">No se pudo cargar la cola</div>

  const total = data.pending.length + data.done.length + data.failed.length
  const files = filter === 'all'
    ? [...data.pending, ...data.failed]
    : filter === 'pending' ? data.pending : data.failed

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Pendientes</h3>
          <p className="text-3xl font-bold text-warning mt-1">{data.pending.length}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">esperando procesamiento</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Procesados</h3>
          <p className="text-3xl font-bold text-success mt-1">{data.done.length}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">completados en _queue/done</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Fallidos</h3>
          <p className={`text-3xl font-bold mt-1 ${data.failed.length > 0 ? 'text-danger' : 'text-success'}`}>
            {data.failed.length}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">
            {data.failed.length > 0 ? 'requieren revisión' : 'sin errores'}
          </p>
        </div>
      </div>

      {/* Distribution Bar */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Distribución</h3>
        {total > 0 && (
          <div className="h-4 rounded-full overflow-hidden flex">
            <div
              className="bg-warning transition-all duration-500"
              style={{ width: `${(data.pending.length / total) * 100}%` }}
              title={`${data.pending.length} pendientes`}
            />
            <div
              className="bg-success transition-all duration-500"
              style={{ width: `${(data.done.length / total) * 100}%` }}
              title={`${data.done.length} procesados`}
            />
            <div
              className="bg-danger transition-all duration-500"
              style={{ width: `${(data.failed.length / total) * 100}%` }}
              title={`${data.failed.length} fallidos`}
            />
          </div>
        )}
        <div className="flex gap-4 mt-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Pendientes ({data.pending.length})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> Procesados ({data.done.length})</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> Fallidos ({data.failed.length})</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              filter === f
                ? 'bg-accent-light text-accent border border-accent/20'
                : 'bg-surface text-text-secondary border border-transparent hover:bg-surface'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Fallidos'}
          </button>
        ))}
      </div>

      {/* File List */}
      <div className="card p-5">
        {files.length === 0 ? (
          <p className="text-text-secondary text-sm">No hay archivos en esta categoría</p>
        ) : (
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {files.map(f => (
              <div key={f.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    f.status === 'pending' ? 'bg-warning' : f.status === 'failed' ? 'bg-danger' : 'bg-success'
                  }`} />
                  <span className="text-sm font-mono text-text-primary">{f.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-tertiary">
                  <span>{(f.size / 1024).toFixed(1)} KB</span>
                  <span>{f.modified.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-3 bg-surface rounded w-1/2 mb-2" />
            <div className="h-8 bg-surface rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
