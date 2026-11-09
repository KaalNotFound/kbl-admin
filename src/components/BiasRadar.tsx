import { useState, useEffect } from 'react'
import type { BiasData } from '../types'
import { fetchBiasData } from '../api'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  medium: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  high: 'bg-red-500/10 border-red-500/30 text-red-400',
}

export default function BiasRadar() {
  const [data, setData] = useState<BiasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBiasData()
      .then(r => setData(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-text-secondary text-sm py-8 text-center">Analizando sesgos...</div>
  if (error) return <div className="text-danger text-sm py-8 text-center">Error: {error}</div>
  if (!data) return null

  // Build radar data (invert so higher = better for visualization)
  const radarData = [
    { axis: 'Humano/IA', value: data.human_vs_ai_ratio, fullMark: 100 },
    { axis: 'Sin Ilusión', value: Math.max(0, 100 - data.illusion_of_competence * 20), fullMark: 100 },
    { axis: 'Actualización', value: Math.max(0, 100 - data.staleness_index * 5), fullMark: 100 },
  ]

  return (
    <div>
      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {data.alerts.map((alert, i) => (
            <div key={i} className={`p-3 rounded-xl border text-sm ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low}`}>
              <span className="font-medium">
                {alert.type === 'automation' ? '\u{1F916}' : alert.type === 'illusion' ? '\u{1F441}' : '\u{1F550}'}
              </span>{' '}
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Radar chart */}
      <div className="bg-card rounded-xl p-4 mb-4">
        <p className="text-sm font-medium text-text-primary mb-3">{'\u{1F3AF}'} Radar de Sesgos</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} />
            <Radar
              name="Sesgo"
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Ratio Humano/IA</p>
          <p className="text-2xl font-bold text-accent">{data.human_vs_ai_ratio}%</p>
          <p className="text-[0.6rem] text-text-tertiary mt-1">
            {data.human_vs_ai_ratio < 30 ? '\u26A0\uFE0F Muy automatizado' : data.human_vs_ai_ratio > 70 ? '\u2705 Balanceado' : '\u{1F504} Mixto'}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Ilusión de Competencia</p>
          <p className="text-2xl font-bold text-yellow-400">{data.illusion_of_competence}</p>
          <p className="text-[0.6rem] text-text-tertiary mt-1">
            {data.illusion_of_competence > 3 ? '\u26A0\uFE0F Revisar conceptos' : '\u2705 OK'}
          </p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-xs text-text-secondary">Staleness</p>
          <p className="text-2xl font-bold text-orange-400">{data.staleness_index}</p>
          <p className="text-[0.6rem] text-text-tertiary mt-1">
            {data.staleness_index > 10 ? '\u26A0\uFE0F Muchos sin tocar' : '\u2705 OK'}
          </p>
        </div>
      </div>

      {/* Stale concepts list */}
      {data.stale_concepts.length > 0 && (
        <div className="bg-card rounded-xl p-4">
          <p className="text-sm font-medium text-text-primary mb-3">{'\u{1F550}'} Conceptos sin actualizar (14+ días)</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.stale_concepts.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface/50">
                <span className="text-xs text-text-primary">{c.concept}</span>
                <span className="text-[0.6rem] text-text-tertiary">
                  {c.lastValidated ? `Último: ${new Date(c.lastValidated).toLocaleDateString()}` : 'Nunca validado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
