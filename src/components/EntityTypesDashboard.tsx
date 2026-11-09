import { useState, useEffect } from 'react'
import { fetchEntityTypes } from '../api'
import type { EntityTypesResponse } from '../types'

export default function EntityTypesDashboard() {
  const [data, setData] = useState<EntityTypesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchEntityTypes()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />
  if (!data) return <div className="card p-5 text-text-secondary">No se pudieron cargar los entity types</div>

  const filtered = data.types.filter(t =>
    t.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Entity Types</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.types.length}</p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">tipos distintos en uso</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Notas con Entity Type</h3>
          <p className="text-3xl font-bold text-accent mt-1">{data.total}</p>
        </div>
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Top</h3>
          <p className="text-xl font-bold text-accent mt-1">
            {data.types[0]?.type || '-'}
          </p>
          <p className="text-[0.7rem] text-text-tertiary mt-1">
            {data.types[0]?.count || 0} notas ({data.types[0]?.pct || 0}%)
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Filtrar entity types..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 bg-card border border-border-light rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/30 transition-colors"
        />
      </div>

      {/* Distribution Bar */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Distribución</h3>
        {data.total > 0 && (
          <div className="space-y-2">
            {data.types.slice(0, 20).map((t, i) => {
              const colors = ['bg-accent', 'bg-accent', 'bg-accent', 'bg-accent', 'bg-danger']
              const color = colors[i % colors.length]
              return (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary w-24 font-medium truncate" title={t.type}>
                    {t.type}
                  </span>
                  <div className="flex-1 h-3 bg-surface rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-700 opacity-70`}
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-secondary font-mono w-12 text-right">{t.count}</span>
                  <span className="text-[0.65rem] text-text-tertiary w-10 text-right">{t.pct}%</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Full Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-light">
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Entity Type</th>
                <th className="text-right py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Notas</th>
                <th className="text-right py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">%</th>
                <th className="text-left py-3 px-4 text-text-secondary font-semibold text-xs uppercase tracking-wider">Barra</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.type} className="border-b border-border-light hover:bg-surface transition-colors">
                  <td className="py-2.5 px-4 font-mono text-sm text-text-primary">{t.type}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-sm text-text-primary">{t.count}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-text-tertiary">{t.pct}%</td>
                  <td className="py-2.5 px-4">
                    <div className="h-2 bg-surface rounded-full overflow-hidden max-w-[200px]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent/40 to-accent/20"
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {search && filtered.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-4">
          No se encontraron entity types que coincidan con "{search}"
        </p>
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
