import { useState, useEffect } from 'react'
import type { CognitiveDebt } from '../types'
import { fetchCognitiveDebt } from '../api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function CognitiveDebtChart() {
  const [data, setData] = useState<CognitiveDebt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCognitiveDebt()
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-text-secondary text-sm py-8 text-center">Calculando deuda cognitiva...</div>
  if (error) return <div className="text-danger text-sm py-8 text-center">Error: {error}</div>
  if (!data) return null

  const debtColor = data.debt_ratio > 60 ? 'text-danger' : data.debt_ratio > 30 ? 'text-warning' : 'text-success'

  return (
    <div>
      {/* Alert banner */}
      {data.alert && (
        <div className="mb-4 p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning">
          {'\u26A0\uFE0F'} {data.alert}
        </div>
      )}

      {/* Main metric */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Deuda</p>
          <p className={`text-3xl font-bold ${debtColor}`}>{data.debt_ratio}%</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Total</p>
          <p className="text-2xl font-bold text-text-primary">{data.total_concepts}</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Validados</p>
          <p className="text-2xl font-bold text-green-400">{data.validated}</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Consolidados</p>
          <p className="text-2xl font-bold text-purple-400">{data.consolidated}</p>
        </div>
      </div>

      {/* Burn-down chart */}
      {data.burn_down_history.length > 0 && (
        <div className="bg-card rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-text-primary mb-3">{'\u{1F4C8}'} Burn-down de Deuda (30 días)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.burn_down_history}>
              <defs>
                <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="remaining"
                stroke="#ef4444"
                fill="url(#debtGradient)"
                strokeWidth={2}
                name="Conceptos sin consolidar"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By module breakdown */}
      {data.by_module.length > 0 && (
        <div className="bg-card rounded-xl p-4">
          <p className="text-sm font-medium text-text-primary mb-3">{'\u{1F4CA}'} Deuda por Módulo</p>
          <div className="space-y-3">
            {data.by_module.map(m => {
              const pct = m.total > 0 ? Math.round((m.consolidated / m.total) * 100) : 0
              const barColor = pct > 70 ? 'bg-green-500' : pct > 40 ? 'bg-yellow-500' : 'bg-red-500'
              return (
                <div key={m.module}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-text-primary font-medium">{m.module}</span>
                    <span className="text-text-secondary">{m.consolidated}/{m.total} consolidados ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
