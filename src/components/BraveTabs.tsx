import { useState, useEffect, useRef } from 'react'
import { fetchBraveTabs, activateBraveTab } from '../api'
import type { BraveTab } from '../types'

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-pink-500', 'bg-lime-500',
]

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function getFaviconColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'ahora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="card p-4 animate-pulse space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-surface rounded w-3/4" />
              <div className="h-2 bg-surface rounded w-1/2" />
            </div>
          </div>
          <div className="h-2 bg-surface rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

function ErrorCDP({ message }: { message: string }) {
  return (
    <div className="card p-6 border-l-4 border-warning">
      <h3 className="text-base font-bold text-warning">Brave no conecta</h3>
      <p className="text-sm text-text-secondary mt-1">
        CDP no está disponible en <code className="text-xs bg-surface px-1.5 py-0.5 rounded">127.0.0.1:9222</code>
      </p>
      <details className="mt-3">
        <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary">
          Detalle técnico
        </summary>
        <pre className="mt-2 text-xs text-text-tertiary bg-surface p-3 rounded-lg overflow-auto max-h-24 font-mono">
          {message}
        </pre>
      </details>
      <ol className="mt-3 text-xs text-text-secondary space-y-1 list-decimal list-inside">
        <li>Abrir Brave con <code className="bg-surface px-1 py-0.5 rounded">--remote-debugging-port=9222</code></li>
        <li>Verificar que el puerto no esté bloqueado</li>
      </ol>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 text-xs font-medium bg-accent-light text-accent rounded-lg hover:bg-accent/20 transition-colors"
      >
        Reintentar
      </button>
    </div>
  )
}

export default function BraveTabs() {
  const [tabs, setTabs] = useState<BraveTab[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [activating, setActivating] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    function load() {
      fetchBraveTabs()
        .then(setTabs)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
    load()

    intervalRef.current = setInterval(load, 3000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const filtered = filter
    ? tabs.filter(t =>
        t.title.toLowerCase().includes(filter.toLowerCase()) ||
        t.url.toLowerCase().includes(filter.toLowerCase())
      )
    : tabs

  async function handleActivate(id: string) {
    setActivating(id)
    try {
      await activateBraveTab(id)
    } catch (e) {
      console.error('activate failed', e)
    } finally {
      setTimeout(() => setActivating(null), 500)
    }
  }

  if (loading) return <LoadingGrid />
  if (error) return <ErrorCDP message={error} />

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">{tabs.length}</span> pestañas abiertas
          <span className="mx-1.5 text-border-light">·</span>
          <span className="text-text-tertiary">auto-refresh 3s</span>
        </p>
        <input
          type="search"
          placeholder="Filtrar pestañas..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-56 pl-3 pr-8 py-1.5 text-xs bg-card border border-border-light rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-text-tertiary">
            {filter ? 'Sin resultados para ese filtro' : 'No hay pestañas abiertas'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleActivate(tab.id)}
              disabled={activating === tab.id}
              className="card p-4 text-left transition-all duration-150 hover:shadow-card-hover hover:-translate-y-0.5 disabled:opacity-50 group"
            >
              <div className="flex items-start gap-3">
                {/* Favicon or fallback */}
                {tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    className="w-8 h-8 rounded-lg flex-shrink-0 bg-surface"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getFaviconColor(tab.title)}`}>
                    {tab.title.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                    {tab.title}
                  </p>
                  <p className="text-[0.65rem] text-text-tertiary mt-0.5 truncate font-mono">
                    {getDomain(tab.url)}
                  </p>
                </div>

                {/* Time badge */}
                {tab.last_accessed && (
                  <span className="text-[0.6rem] text-text-tertiary bg-surface px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {formatTime(tab.last_accessed)}
                  </span>
                )}
              </div>

              {/* URL preview */}
              <p className="mt-2 text-[0.6rem] text-text-tertiary truncate font-mono">
                {tab.url}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
