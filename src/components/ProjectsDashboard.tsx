import { useState, useEffect } from 'react'
import { fetchProjects } from '../api'
import type { ProjectsResponse } from '../types'

const statusColors: Record<string, string> = {
  active: 'text-success',
  activo: 'text-success',
  en_progreso: 'text-accent',
  en_progress: 'text-accent',
  low: 'text-warning',
  pending: 'text-warning',
  pendiente: 'text-warning',
  stalled: 'text-danger',
  estancado: 'text-danger',
  inactive: 'text-text-tertiary',
  done: 'text-text-tertiary',
  completed: 'text-text-tertiary',
}

const statusDots: Record<string, string> = {
  active: 'good',
  activo: 'good',
  en_progreso: 'info',
  en_progress: 'info',
  low: 'warn',
  pending: 'warn',
  pendiente: 'warn',
  stalled: 'bad',
  estancado: 'bad',
  inactive: 'bad',
  done: 'good',
  completed: 'good',
}

export default function ProjectsDashboard() {
  const [data, setData] = useState<ProjectsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProjects()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <div className="card p-5 text-danger">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Total Proyectos</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.projects.length}</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Estancados</h3>
          <p className={`text-3xl font-bold mt-1 ${data.stalled.length > 0 ? 'text-danger' : 'text-success'}`}>
            {data.stalled.length}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">sin actividad {'>'} 7 días</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Con AGENTS.md</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.projects.filter(p => p.has_agents).length}</p>
        </div>
      </div>

      {/* Stalled Alert */}
      {data.stalled.length > 0 && (
        <div className="card p-5 border-l-4 border-danger bg-danger/10">
          <h3 className="text-sm font-bold text-danger">Proyectos estancados</h3>
          <div className="mt-2 space-y-1">
            {data.stalled.map(p => (
              <p key={p.name} className="text-xs text-text-secondary">
                • {p.name} — última actividad: {p.last_update?.slice(0, 10)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Projects Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light">
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Proyecto</th>
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Estado</th>
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Última Act.</th>
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Archivos</th>
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Stack</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map(p => (
                <tr key={p.name} className="border-b border-border-light hover:bg-surface transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-primary font-medium">{p.name}</span>
                      {p.has_agents && (
                        <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-accent-light text-accent font-mono">AI</span>
                      )}
                    </div>
                    {p.description && <p className="text-[0.7rem] text-text-tertiary mt-0.5">{p.description}</p>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-mono ${statusColors[p.status] || 'text-text-secondary'}`}>
                      <span className={`status-dot ${statusDots[p.status] || 'good'} mr-1.5 align-middle`} />
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-text-tertiary font-mono">
                    {p.last_update ? p.last_update.slice(0, 10) : '-'}
                  </td>
                  <td className="py-3 px-4 text-xs text-text-tertiary font-mono">
                    {p.files_count}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {p.stack.slice(0, 4).map(s => (
                        <span key={s} className="text-[0.6rem] px-1.5 py-0.5 rounded bg-surface text-text-tertiary font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Summary */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">Resumen de Estados</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['active', 'en_progreso', 'pending', 'stalled'].map(status => {
            const count = data.projects.filter(p => p.status === status || p.status === status.replace('_', '')).length
            if (count === 0) return null
            return (
              <div key={status} className="text-center p-3 rounded-lg bg-surface">
                <span className={`status-dot ${statusDots[status] || 'good'} mx-auto mb-1`} />
                <p className="text-lg font-bold text-text-primary">{count}</p>
                <p className="text-[0.65rem] text-text-tertiary uppercase">{status.replace('_', ' ')}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
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
