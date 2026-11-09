import { useState, useEffect } from 'react'
import { fetchLogs } from '../api'
import type { LogsResponse } from '../types'

export default function SystemLogs() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [logFilter, setLogFilter] = useState<'all' | 'sessions' | 'thermal' | 'capture'>('all')

  useEffect(() => {
    fetchLogs()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data) return <div className="card p-5 text-text-secondary">No se pudieron cargar los logs</div>

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Sesiones</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.sessions.length}</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Térmicas</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.thermal.length}</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Capture Logs</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.capture_logs.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'sessions', 'thermal', 'capture'] as const).map(f => (
          <button
            key={f}
            onClick={() => setLogFilter(f)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              logFilter === f
                ? 'bg-accent-light text-accent border border-accent/20'
                : 'bg-surface text-text-secondary border border-transparent hover:bg-surface'
            }`}
          >
            {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Sessions */}
      {(logFilter === 'all' || logFilter === 'sessions') && data.sessions.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Sesiones</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {data.sessions.slice(-30).reverse().map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    (s.status === 'ok' || s.estado === 'completado') ? 'bg-success' : 'bg-warning'
                  }`} />
                  <span className="text-xs text-text-primary">
                    {s.date || s.fecha || '-'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-tertiary">
                  <span className="font-mono">{s.duration || s.duracion || '-'}</span>
                  <span>{s.status || s.estado || ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thermal */}
      {(logFilter === 'all' || logFilter === 'thermal') && data.thermal.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Registro Térmico</h3>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {data.thermal.slice(-50).reverse().map((t, i) => {
              const temp = t.temperatura || t.temperature || 0
              return (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-surface">
                  <span className="text-xs text-text-primary">{t.fecha || t.date || '-'}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold font-mono ${
                      temp > 37 ? 'text-danger' : temp > 36 ? 'text-warning' : 'text-success'
                    }`}>
                      {temp.toFixed(1)}°C
                    </span>
                    <span className="text-[0.65rem] text-text-tertiary">{t.estado || t.note || ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Capture Logs */}
      {(logFilter === 'all' || logFilter === 'capture') && data.capture_logs.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Capture Logs</h3>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {data.capture_logs.slice(-20).reverse().map((l, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-surface">
                <span className="text-xs font-mono text-text-primary">{l.name}</span>
                <div className="flex items-center gap-3 text-xs text-text-tertiary">
                  <span>{(l.size / 1024).toFixed(1)} KB</span>
                  <span>{l.modified.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.sessions.length === 0 && data.thermal.length === 0 && data.capture_logs.length === 0 && (
        <div className="card p-8 text-center text-text-tertiary">
          <p className="text-sm">No hay registros disponibles</p>
        </div>
      )}
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
