import { useState, useEffect } from 'react'
import { fetchOverview } from '../api'
import type { Overview, HealthStatus } from '../types'

const statusColors: Record<HealthStatus, string> = {
  good: 'text-success',
  warn: 'text-warning',
  bad: 'text-danger',
}

export default function Overview() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchOverview()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} />
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Health Status Banner */}
      <HealthBanner health={data.health} issues={data.health_issues} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Notas"
          value={data.vault.total_notes}
          subtitle={`${data.vault.areas['02 - AREAS']?.files || 0} en AREAS`}
        />
        <StatCard
          title="Pipeline"
          value={data.pipeline.total}
          subtitle={`${data.pipeline.pending} pendientes · ${data.pipeline.done} procesados · ${data.pipeline.failed} fallidos`}
          accent={data.pipeline.failed > 0 ? 'bad' : data.pipeline.pending > 5 ? 'warn' : 'good'}
        />
        <StatCard
          title="Entity Catalog"
          value={data.vault.entity_catalog_entries}
          subtitle="tipos de entidad registrados"
        />
        <StatCard
          title="Sesiones"
          value={data.sessions.total}
          subtitle={data.sessions.last_session
            ? `última: ${data.sessions.last_session.date?.slice(0, 10) || data.sessions.last_session.date || ''}`
            : 'sin registro'}
        />
      </div>

      {/* Vault Areas */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Distribución por Área</h3>
        <div className="space-y-2">
          {Object.entries(data.vault.areas).map(([area, stats]) => {
            const pct = data.vault.total_notes > 0
              ? Math.round((stats.files / data.vault.total_notes) * 100)
              : 0
            return (
              <div key={area} className="flex items-center gap-3">
                <span className="text-xs text-text-secondary w-24 font-medium">{area}</span>
                <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/40 to-accent/20 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-text-secondary font-mono w-16 text-right">{stats.files}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Thermal Readings */}
      {data.thermal.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Térmicas Recientes</h3>
          <div className="flex items-end gap-1 h-20">
            {data.thermal.slice(-30).map((t, i) => {
              const temp = t.temperatura || t.temperature || 0
              const height = Math.min(Math.max((temp / 40) * 100, 5), 100)
              const color = temp > 37 ? '#e08a7a' : temp > 36 ? '#e8b84b' : '#8fcaa0'
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all duration-300 hover:opacity-80 cursor-pointer relative group"
                  style={{ height: `${height}%`, background: color, opacity: 0.7 }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[0.6rem] text-text-secondary opacity-0 group-hover:opacity-100 whitespace-nowrap">
                    {temp.toFixed(1)}°C
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Inbox Unclassified */}
      {data.vault.inbox_unclassified > 0 && (
        <div className="card p-5 border-l-2 border-warning">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Notas sin clasificar</h3>
              <p className="text-2xl font-bold text-warning mt-1">{data.vault.inbox_unclassified}</p>
            </div>
            <span className="text-[0.7rem] text-text-secondary">en 00 - INBOX</span>
          </div>
        </div>
      )}
    </div>
  )
}

function HealthBanner({ health, issues }: { health: HealthStatus; issues: Overview['health_issues'] }) {
  const colors: Record<HealthStatus, string> = {
    good: 'border-success bg-success/10',
    warn: 'border-warning bg-warning/10',
    bad: 'border-danger bg-danger/10',
  }
  const labels: Record<HealthStatus, string> = {
    good: '✅ Sistema saludable',
    warn: '⚠️ Atención requerida',
    bad: '🔴 Problemas críticos',
  }

  return (
    <div className={`card p-5 border-l-4 ${colors[health]}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-base font-bold ${statusColors[health]}`}>{labels[health]}</h3>
          {issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {issues.map((issue, i) => (
                <li key={i} className="text-xs text-text-secondary flex items-center gap-2">
                  <span className={`status-dot ${issue.severity === 'error' ? 'bad' : issue.severity === 'warning' ? 'warn' : 'good'}`} />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`status-dot ${health}`} />
      </div>
    </div>
  )
}

function StatCard({ title, value, subtitle, accent }: {
  title: string
  value: number
  subtitle: string
  accent?: HealthStatus
}) {
  const accentColor = accent === 'bad' ? 'text-danger' : accent === 'warn' ? 'text-warning' : 'text-accent'
  return (
    <div className="card p-5">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{title}</h3>
      <p className={`text-3xl font-bold mt-1 ${accentColor}`}>{value}</p>
      <p className="text-[0.7rem] text-text-tertiary mt-1">{subtitle}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-5 animate-pulse"><div className="h-6 bg-surface rounded w-1/3" /></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card p-5 border-l-4 border-danger">
      <h3 className="text-base font-bold text-danger">Error de conexión</h3>
      <p className="text-sm text-text-secondary mt-1">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-3 px-4 py-2 text-xs font-medium bg-accent-light text-accent rounded-lg hover:bg-accent/20 transition-colors"
      >
        Reintentar
      </button>
    </div>
  )
}
