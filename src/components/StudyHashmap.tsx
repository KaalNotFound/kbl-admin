import { useState, useEffect } from 'react'
import type { HistoryItem, StudyStats } from '../types'
import { fetchStudyHistory } from '../api'

// --- Types for grid rendering ---
type ItemType = 'question' | 'doubt' | 'active_recall'

interface DayData {
  date: string
  count: number
  items: HistoryItem[]
  predType: ItemType | 'mixed'
}

const TYPE_COLORS: Record<ItemType, { base: string; bg: (intensity: number) => string }> = {
  question: {
    base: '#22C55E',
    bg: (i) => i === 0 ? 'bg-green-900/20' : i === 1 ? 'bg-green-700/40' : i === 2 ? 'bg-green-600/60' : 'bg-green-500/80',
  },
  doubt: {
    base: '#F59E0B',
    bg: (i) => i === 0 ? 'bg-amber-900/20' : i === 1 ? 'bg-amber-700/40' : i === 2 ? 'bg-amber-600/60' : 'bg-amber-500/80',
  },
  active_recall: {
    base: '#3B82F6',
    bg: (i) => i === 0 ? 'bg-blue-900/20' : i === 1 ? 'bg-blue-700/40' : i === 2 ? 'bg-blue-600/60' : 'bg-blue-500/80',
  },
}

const DAY_NAMES = ['', 'Lun', '', 'Mié', '', 'Vie', '']
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// --- Helpers ---
function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function classifyType(item: HistoryItem): ItemType {
  if (item.hasAnswer) return 'active_recall'
  if (item.score) return 'active_recall' // autoevaluado en Flow/Shadow = práctica activa
  if (item.tipo === 'doubt') return 'doubt'
  return 'question'
}

function getIntensity(count: number): 0 | 1 | 2 | 3 {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  return 3
}

function predominantType(items: HistoryItem[]): ItemType | 'mixed' {
  const types = items.map(classifyType)
  const counts = { question: 0, doubt: 0, active_recall: 0 }
  for (const t of types) counts[t]++
  const max = Math.max(counts.question, counts.doubt, counts.active_recall)
  const top = Object.entries(counts).filter(([, v]) => v === max).map(([k]) => k) as ItemType[]
  if (top.length > 1) return 'mixed'
  return top[0]
}

const SCORE_LABELS: Record<string, string> = {
  correct: '✅ Lo sabía',
  partial: '🟡 Casi',
  incorrect: '❌ No',
}

const TYPE_LABELS: Record<string, string> = {
  question: '❓ Pregunta',
  doubt: '💡 Duda',
  active_recall: '✍️ Active Recall',
}

// ─── Component ───
export default function StudyHashmap() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [stats, setStats] = useState<StudyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [scoreFilter, setScoreFilter] = useState<'correct' | 'partial' | 'incorrect' | null>(null)

  useEffect(() => {
    fetchStudyHistory()
      .then(r => {
        setItems(r.items)
        setStats(r.stats)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Build grid: 12 weeks ending on today's week
  const today = new Date()
  const monday = getMonday(today)
  const gridStart = addDays(monday, -11 * 7) // 12 weeks back

  const gridDays: DayData[] = []
  const byDate: Record<string, HistoryItem[]> = {}
  for (const item of items) {
    const d = item.fecha
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(item)
  }

  for (let i = 0; i < 12 * 7; i++) {
    const d = addDays(gridStart, i)
    const ds = formatDate(d)
    const dayItems = byDate[ds] || []
    gridDays.push({
      date: ds,
      count: dayItems.length,
      items: dayItems,
      predType: dayItems.length > 0 ? predominantType(dayItems) : 'question',
    })
  }

  // Week boundaries for month labels
  const weekLabels: { label: string; weekIndex: number }[] = []
  for (let w = 0; w < 12; w++) {
    const d = addDays(gridStart, w * 7)
    const month = d.getMonth()
    if (w === 0 || d.getDate() <= 7) {
      weekLabels.push({ label: MONTH_NAMES[month], weekIndex: w })
    }
  }

  if (loading) {
    return <div className="text-text-secondary text-sm py-8 text-center">Cargando historial...</div>
  }
  if (error) {
    return <div className="text-danger text-sm py-8 text-center">Error: {error}</div>
  }

  // Selected day detail
  const selectedDayItems = selectedDay ? byDate[selectedDay] || [] : []

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        <StatCard label="Total" value={stats?.total ?? 0} color="text-text-primary" active={scoreFilter === null} onClick={() => setScoreFilter(null)} />
        <StatCard label="✅ Correctas" value={stats?.correct ?? 0} color="text-success" active={scoreFilter === 'correct'} onClick={() => setScoreFilter(scoreFilter === 'correct' ? null : 'correct')} />
        <StatCard label="🟡 Parciales" value={stats?.partial ?? 0} color="text-warning" active={scoreFilter === 'partial'} onClick={() => setScoreFilter(scoreFilter === 'partial' ? null : 'partial')} />
        <StatCard label="❌ Incorrectas" value={stats?.incorrect ?? 0} color="text-danger" active={scoreFilter === 'incorrect'} onClick={() => setScoreFilter(scoreFilter === 'incorrect' ? null : 'incorrect')} />
        <StatCard label="🔥 Racha" value={`${stats?.streak ?? 0} días`} color="text-accent" active={false} onClick={() => {}} />
      </div>
      {scoreFilter && (
        <p className="text-xs text-text-secondary mb-3">Filtrando: <span className="font-medium text-text-primary">{scoreFilter === 'correct' ? '✅ Correctas' : scoreFilter === 'partial' ? '🟡 Parciales' : '❌ Incorrectas'}</span> — <button className="text-accent hover:underline" onClick={() => setScoreFilter(null)}>Limpiar filtro</button></p>
      )}

      {/* Grid */}
      <div className="bg-card rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-text-primary">🗺️ Mapa de Estudio</span>
          <span className="text-[0.6rem] text-text-secondary">{stats?.today}</span>
          {items.length === 0 && <span className="text-xs text-text-secondary ml-2">Sin actividad aún</span>}
        </div>

        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 pr-1 text-[0.55rem] text-text-secondary pt-3">
            {DAY_NAMES.map((d, i) => <div key={i} className="h-3 leading-3">{d}</div>)}
          </div>

          {/* Grid columns (weeks) */}
          <div className="flex gap-0.5">
            {Array.from({ length: 12 }, (_, w) => (
              <div key={w} className="flex flex-col gap-0.5">
                {weekLabels.find(l => l.weekIndex === w) && (
                  <div className="text-[0.5rem] text-text-secondary leading-3 h-3" style={{ visibility: weekLabels.find(l => l.weekIndex === w) ? 'visible' : 'hidden' }}>
                    {weekLabels.find(l => l.weekIndex === w)?.label}
                  </div>
                )}
                {Array.from({ length: 7 }, (_, day) => {
                  const idx = w * 7 + day
                  if (idx >= gridDays.length) return <div key={day} className="w-3 h-3" />
                  const cell = gridDays[idx]
                  const isSelected = selectedDay === cell.date
                  const isToday = cell.date === stats?.today
                  const isFuture = new Date(cell.date) > today
                  
                  let bgClass = 'bg-[#1a1a2e]' // empty (dark neutral)
                  if (cell.count > 0 && !isFuture) {
                    const type = cell.predType === 'mixed' ? 'active_recall' : cell.predType
                    const intensity = getIntensity(cell.count)
                    bgClass = TYPE_COLORS[type].bg(intensity)
                  }

                  return (
                    <div
                      key={day}
                      className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-accent/50 ${bgClass} ${isSelected ? 'ring-2 ring-accent' : ''} ${isToday ? 'ring-1 ring-accent/40' : ''}`}
                      title={`${cell.date}: ${cell.count} ítems`}
                      onClick={() => setSelectedDay(selectedDay === cell.date ? null : cell.date)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-[0.6rem] text-text-secondary">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-600/60" /> Preguntas</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60" /> Dudas</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/60" /> Active Recall</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#1a1a2e] border border-[#2a2a3e]" /> Sin actividad</span>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="bg-card rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-text-primary mb-3">📅 {selectedDay} — {selectedDayItems.length} ítems</p>
          <div className="space-y-2">
            {selectedDayItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 bg-surface/50 rounded-lg p-2.5">
                <span className="text-xs mt-0.5 shrink-0">{classifyType(item) === 'active_recall' ? '✍️' : item.tipo === 'doubt' ? '💡' : '❓'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-primary truncate">{item.pregunta || item.file.replace(/^\d{8}_/, '').replace(/\.md$/, '').replace(/-/g, ' ')}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.concepto && <span className="text-[0.55rem] text-accent">🔗 {item.concepto}</span>}
                    {item.score && <span className={`text-[0.55rem] font-medium ${item.score === 'correct' ? 'text-success' : item.score === 'partial' ? 'text-warning' : 'text-danger'}`}>{SCORE_LABELS[item.score]}</span>}
                    {item.hasAnswer && <span className="text-[0.55rem] text-blue-400">✍️ escrita</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full session list */}
      <div className="bg-card rounded-xl p-4">
        <p className="text-sm font-medium text-text-primary mb-3">📋 {scoreFilter ? `Filtrado: ${scoreFilter === 'correct' ? '✅ Correctas' : scoreFilter === 'partial' ? '🟡 Parciales' : '❌ Incorrectas'}` : 'Historial de sesiones'}</p>
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {(() => {
            const filtered = scoreFilter ? items.filter(i => i.score === scoreFilter) : items
            if (filtered.length === 0) return <p className="text-xs text-text-secondary text-center py-4">Sin actividad registrada. Respondé preguntas en Flow o Lista para que aparezcan aquí.</p>
            return filtered.map((item, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => setSelectedDay(item.fecha)}>
                <span className="text-[0.55rem] text-text-secondary w-16 shrink-0">{item.fecha}</span>
                <span className="text-xs shrink-0">{classifyType(item) === 'active_recall' ? '✍️' : item.tipo === 'doubt' ? '💡' : '❓'}</span>
                <span className="text-xs text-text-primary truncate min-w-0 flex-1">{item.pregunta || item.file.replace(/^\d{8}_/, '').replace(/\.md$/, '').replace(/-/g, ' ')}</span>
                {item.score && <span className={`text-[0.55rem] font-medium shrink-0 ${item.score === 'correct' ? 'text-success' : item.score === 'partial' ? 'text-warning' : 'text-danger'}`}>{SCORE_LABELS[item.score]}</span>}
                {item.hasAnswer && <span className="text-[0.55rem] text-blue-400 shrink-0">✍️</span>}
                {item.concepto && <span className="text-[0.55rem] text-accent shrink-0 hidden sm:inline">🔗{item.concepto}</span>}
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

// --- Stat card mini-component ---
function StatCard({ label, value, color, active, onClick }: { label: string; value: string | number; color: string; active: boolean; onClick: () => void }) {
  return (
    <div className={`bg-card rounded-xl p-3 text-center cursor-pointer transition-all hover:bg-surface/50 ${active ? 'ring-2 ring-accent bg-surface/30' : ''}`} onClick={onClick}>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[0.6rem] text-text-secondary mt-0.5">{label}</p>
    </div>
  )
}
