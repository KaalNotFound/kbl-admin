import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from 'recharts'
import Card from './ui/Card'
import Badge from './ui/Badge'
import Skeleton from './ui/Skeleton'
import { useBehavioralWeekly, useBehavioralBlocks, useBehavioralStreaks, useCurrentBlock } from '../hooks/use-behavioral'

// Cognitive Dark block colors
const BLOCK_COLORS: Record<string, string> = {
  estudio: '#b4a7d6',   // lavender
  infra: '#89b8e0',     // sky
  descanso: '#d4cfc4',  // cream
  flex: '#8ecfb5',      // mint
  cierre: '#d98e9a',    // rose
}

const BLOCK_LABELS: Record<string, string> = {
  estudio: 'Estudio',
  infra: 'Infra',
  descanso: 'Descanso',
  flex: 'Flex',
  cierre: 'Cierre',
}

function StreakCard() {
  const { data: streaks, isLoading } = useBehavioralStreaks()
  const { data: current } = useCurrentBlock()

  if (isLoading) return <Skeleton lines={3} />

  const blockLabel = current?.block ? BLOCK_LABELS[current.block] || current.block : '—'
  const blockColor = current?.block ? BLOCK_COLORS[current.block] || '#666' : '#666'

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Racha de Estudio</h3>

      <div className="flex items-end gap-4 mb-4">
        <div>
          <span className="text-4xl font-bold text-text-primary">{streaks?.current ?? 0}</span>
          <span className="text-sm text-text-tertiary ml-1">días seguidos</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-text-tertiary">Récord</p>
          <p className="font-semibold text-text-primary">{streaks?.longest ?? 0} días</p>
        </div>
        <div>
          <p className="text-text-tertiary">Días totales</p>
          <p className="font-semibold text-text-primary">{streaks?.total_study_days ?? 0}</p>
        </div>
        <div>
          <p className="text-text-tertiary">Último estudio</p>
          <p className="font-semibold text-text-primary">{streaks?.last_study_date ?? 'Nunca'}</p>
        </div>
        <div>
          <p className="text-text-tertiary">Bloque actual</p>
          <p className="font-semibold" style={{ color: blockColor }}>{blockLabel}</p>
        </div>
      </div>
    </Card>
  )
}

function AdherenceCard() {
  const { data: blocks, isLoading } = useBehavioralBlocks()

  if (isLoading) return <Skeleton lines={3} />

  const adherence = blocks?.adherence_pct ?? 0
  const totalMin = blocks?.total_minutes ?? 0
  const violations = blocks?.violations ?? 0

  const pieData = blocks?.breakdown
    ? Object.entries(blocks.breakdown)
        .filter(([_, v]) => v.actual > 0)
        .map(([key, v]) => ({ name: BLOCK_LABELS[key] || key, value: v.actual, color: BLOCK_COLORS[key] || '#666' }))
    : []

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Adherencia de Bloques</h3>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl font-bold text-text-primary">{adherence}%</span>
        <Badge variant={adherence >= 70 ? 'good' : adherence >= 40 ? 'warn' : 'bad'}>
          {adherence >= 70 ? 'Bien' : adherence >= 40 ? 'Mejorar' : 'Crítico'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-text-tertiary">Tiempo total</p>
          <p className="font-semibold text-text-primary">{totalMin} min</p>
        </div>
        <div>
          <p className="text-text-tertiary">Violaciones</p>
          <p className={`font-semibold ${violations > 0 ? 'text-warning' : 'text-text-primary'}`}>{violations}</p>
        </div>
      </div>

      {pieData.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d37', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => [`${value} min`, 'Tiempo']}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}

      {pieData.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-4">Sin datos de hoy</p>
      )}
    </Card>
  )
}

function WeeklyChart() {
  const { data: weekly, isLoading } = useBehavioralWeekly()

  if (isLoading) return <Skeleton lines={4} />

  const chartData = (weekly?.days || []).map(d => ({
    date: d.date.slice(5),  // MM-DD
    Estudio: d.estudio_minutes,
    Infra: d.infra_minutes,
    Descanso: d.descanso_minutes,
    Flex: d.flex_minutes,
  }))

  const hasData = chartData.some(d => d.Estudio > 0 || d.Infra > 0)

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Tendencia Semanal</h3>

      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2d37" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
            <YAxis tick={{ fontSize: 11, fill: '#888' }} label={{ value: 'min', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#666' } }} />
            <Tooltip
              contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d37', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => [`${value} min`]}
            />
            <Bar dataKey="Estudio" stackId="a" fill={BLOCK_COLORS.estudio} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Infra" stackId="a" fill={BLOCK_COLORS.infra} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Flex" stackId="a" fill={BLOCK_COLORS.flex} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Descanso" stackId="a" fill={BLOCK_COLORS.descanso} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-8">Sin datos de la semana</p>
      )}
    </Card>
  )
}

function BlockBreakdown() {
  const { data: blocks, isLoading } = useBehavioralBlocks()

  if (isLoading) return <Skeleton lines={2} />

  if (!blocks?.breakdown) return null

  const entries = Object.entries(blocks.breakdown)
    .filter(([_, v]) => v.expected > 0)

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-text-secondary mb-3 uppercase tracking-wider">Desglose por Bloque</h3>
      <div className="space-y-3">
        {entries.map(([key, v]) => {
          const pct = v.expected > 0 ? Math.min(100, Math.round((v.actual / v.expected) * 100)) : 0
          const color = BLOCK_COLORS[key] || '#666'
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium" style={{ color }}>{BLOCK_LABELS[key] || key}</span>
                <span className="text-xs text-text-tertiary">{v.actual}/{v.expected} min</span>
              </div>
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function BehavioralDashboard() {
  return (
    <div className="space-y-6">
      {/* Top row: streak + adherence */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StreakCard />
        <AdherenceCard />
      </div>

      {/* Weekly trend */}
      <WeeklyChart />

      {/* Block breakdown */}
      <BlockBreakdown />
    </div>
  )
}
