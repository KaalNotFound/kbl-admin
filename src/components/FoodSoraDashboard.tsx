import { useEffect, useState, useMemo } from 'react'
import { fetchFoodSoraStats, fetchFoodSora } from '../api'
import type { FoodSoraStats, FoodSoraDay } from '../types'
import AnimatedNumber from './AnimatedNumber'
import { CardSkeleton, HeroSkeleton } from './SkeletonFin'

const SLOT_NAMES = ['Madrugada', 'Mañana', 'Mediodía', 'Tarde', 'Noche']

function phrase(filled: number, total: number) {
  if (filled === 0) return 'Hoy no registró comidas'
  if (filled === total) return 'Completó todas las comidas 🐱✨'
  if (filled >= 3) return `Comió en ${filled}/${total} momentos`
  return `Solo ${filled}/${total} comidas registradas`
}

export default function FoodSoraDashboard() {
  const [stats, setStats] = useState<FoodSoraStats | null>(null)
  const [detail, setDetail] = useState<FoodSoraDay[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchFoodSoraStats(), fetchFoodSora()])
      .then(([s, d]) => { setStats(s); setDetail(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const today = useMemo(() => detail?.[detail.length - 1] || null, [detail])

  const bestSlot = useMemo(() => {
    // by_slot can be empty on a fresh vault (no Daily food records yet) —
    // reduce without an initial value crashed the whole dashboard section.
    if (!stats?.by_slot?.length) return null
    return stats.by_slot.reduce((a, b) => (a.count > b.count ? a : b))
  }, [stats])

  if (loading) return (
    <div className="flex flex-col gap-5 [&>*]:animate-card-enter">
      <HeroSkeleton />
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card p-4 rounded-[16px] text-center">
            <div className="skeleton-line" style={{ width: '40%', height: 28, margin: '0 auto 8px' }} />
            <div className="skeleton-line" style={{ width: '60%', height: 10, margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <CardSkeleton />
    </div>
  )
  if (error) return <div className="flex items-center gap-[0.6rem] px-5 py-[0.9rem] bg-[rgba(224,138,122,0.06)] border border-[rgba(224,138,122,0.15)] rounded-[10px] text-[#e0a0a0] text-sm"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(224,138,122,0.15)] text-kbl-red font-bold text-[0.75rem]">!</span>{error}</div>
  if (!stats) return null

  return (
    <div className="flex flex-col gap-5 [&>*]:animate-card-enter [&>*:nth-child(1)]:[animation-delay:0s] [&>*:nth-child(2)]:[animation-delay:0.06s] [&>*:nth-child(3)]:[animation-delay:0.12s] [&>*:nth-child(4)]:[animation-delay:0.18s] [&>*:nth-child(5)]:[animation-delay:0.24s] [&>*:nth-child(6)]:[animation-delay:0.3s]">
      {/* Hero */}
      <div className="relative bg-card p-7 border-[rgba(143,202,160,0.10)] hover:border-[rgba(143,202,160,0.2)]">
        <div className="absolute -top-2/5 -right-1/5 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(143,202,160,0.10),transparent_70%)] pointer-events-none animate-glow-pulse" />
        <div className="flex items-center gap-[0.6rem] mb-2">
          <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-green bg-[rgba(143,202,160,0.12)] px-[0.6rem] py-[0.2rem] rounded-[4px]">🐱 Comedero</span>
          <span className="text-[0.75rem] text-[#a0907e]">la gorda</span>
        </div>
        <div className="text-[2.2rem] font-bold leading-tight mb-3 text-gradient-green">
          <AnimatedNumber value={stats.total_days} /> días registrados
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-[0.8rem] text-[#c8b8a8]">
            racha: <strong>{stats.streak}</strong> días
          </span>
          <span className="w-[3px] h-[3px] rounded-full bg-[#a0907e]" />
          <span className="text-[0.8rem] text-[#c8b8a8]">{stats.filled_slots}/{stats.total_slots} comidas</span>
          <span className="w-[3px] h-[3px] rounded-full bg-[#a0907e]" />
          <span className="text-[0.8rem] text-[#c8b8a8]">{stats.rate}% tasa</span>
        </div>
        {today && <div className="mt-2 text-sm text-kbl-green italic">{phrase(today.filled_slots, today.total_slots)}</div>}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        <div className="bg-card p-4 rounded-[16px] text-center hover:border-[rgba(143,202,160,0.2)] hover:-translate-y-0.5 transition-all">
          <div className="text-[1.3rem] mb-[0.35rem]">🔥</div>
          <div className="text-[1.8rem] font-bold leading-tight text-kbl-green">{stats.streak}</div>
          <div className="text-[0.6rem] text-[#a0907e] uppercase tracking-wider mt-1">días de racha</div>
        </div>
        <div className="bg-card p-4 rounded-[16px] text-center hover:border-[rgba(143,202,160,0.2)] hover:-translate-y-0.5 transition-all">
          <div className="text-[1.3rem] mb-[0.35rem]">📊</div>
          <div className="text-[1.8rem] font-bold leading-tight text-kbl-blue">{stats.rate}%</div>
          <div className="text-[0.6rem] text-[#a0907e] uppercase tracking-wider mt-1">días con registro</div>
        </div>
        <div className="bg-card p-4 rounded-[16px] text-center hover:border-[rgba(143,202,160,0.2)] hover:-translate-y-0.5 transition-all">
          <div className="text-[1.3rem] mb-[0.35rem]">⭐</div>
          <div className="text-[0.9rem] font-semibold leading-tight text-[#f59e0b]">{bestSlot?.name || '—'}</div>
          <div className="text-[0.6rem] text-[#a0907e] uppercase tracking-wider mt-1">{bestSlot?.count || 0}x más activo</div>
        </div>
        <div className="bg-card p-4 rounded-[16px] text-center hover:border-[rgba(143,202,160,0.2)] hover:-translate-y-0.5 transition-all">
          <div className="text-[1.3rem] mb-[0.35rem]">🎯</div>
          <div className="text-[1.8rem] font-bold leading-tight text-[#a855f7]">{stats.by_slot?.filter(s => s.pct >= 50).length || 0}/5</div>
          <div className="text-[0.6rem] text-[#a0907e] uppercase tracking-wider mt-1">franjas +50%</div>
        </div>
      </div>

      {/* Slot analysis */}
      <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Rendimiento por momento del día</h3>
        </div>
        <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2">
          {stats.by_slot?.map(slot => (
            <div key={slot.name} className="text-center">
              <div className="text-[0.6rem] text-[#a0907e] uppercase tracking-wider mb-[0.3rem]">{slot.name}</div>
              <div className="text-[1.4rem] font-bold text-kbl-green mb-[0.4rem]">{slot.count}x</div>
              <div className="h-[4px] bg-[rgba(143,202,160,0.10)] rounded-[2px] overflow-hidden">
                <div
                  className={`h-full rounded-[2px] transition-all duration-600 ${slot.pct >= 50 ? 'bg-gradient-to-r from-kbl-green to-[#8fcaa0] shadow-[0_0_6px_rgba(143,202,160,0.2)]' : 'bg-[#a0907e]'}`}
                  style={{ width: `${slot.pct}%` }}
                />
              </div>
              <div className="text-[0.6rem] text-[#a0907e] flex flex-col mt-[0.3rem] gap-[0.1rem]">
                <span>{slot.pct}%</span>
                {slot.avg_hora && <span className="opacity-60">{slot.avg_hora}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Calendario de comidas</h3>
          <span className="text-[0.6rem] font-semibold px-[0.5rem] py-[0.15rem] rounded-full bg-[rgba(143,202,160,0.10)] text-kbl-green">{stats.calendar?.length || 0} días</span>
        </div>
        <div className="grid grid-cols-[36px_repeat(5,1fr)_40px] gap-[3px] mb-[6px] items-center max-md:grid-cols-[28px_repeat(5,1fr)_34px]">
          <span />
          {SLOT_NAMES.map(s => <span key={s} className="text-[0.5rem] text-[#a0907e] text-center uppercase tracking-wider">{s.slice(0, 4)}</span>)}
          <span className="text-[0.6rem] text-[#a0907e] text-center">🍽️</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {stats.calendar?.slice().reverse().map(day => (
            <div key={day.fecha} className="grid grid-cols-[36px_repeat(5,1fr)_40px] gap-[3px] mb-[3px] items-center max-md:grid-cols-[28px_repeat(5,1fr)_34px]">
              <span className="text-[0.6rem] text-[#a0907e] text-right pr-[3px] [font-variant-numeric:tabular-nums]">{day.fecha.slice(5)}</span>
              {SLOT_NAMES.map(s => (
                <span
                  key={s}
                  className={`w-full aspect-square rounded-[4px] transition-all hover:scale-130 hover:z-10 ${day.slots[s] ? 'bg-kbl-green shadow-[0_0_8px_rgba(143,202,160,0.3)]' : 'bg-[rgba(143,202,160,0.05)] border border-[rgba(143,202,160,0.08)]'}`}
                  title={`${day.fecha} — ${s}: ${day.slots[s] ? '✓' : '✗'}`}
                />
              ))}
              <span className="text-[0.6rem] text-[#c8b8a8] text-center flex items-center justify-center gap-[3px]">
                <span className={`inline-block w-[5px] h-[5px] rounded-full ${
                  day.filled === 5 ? 'bg-kbl-green' :
                  day.filled >= 3 ? 'bg-kbl-amber' :
                  day.filled > 0 ? 'bg-kbl-blue' :
                  'bg-[#a0907e] opacity-30'
                }`} />
                {day.filled}/5
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      {detail && detail.length > 0 && (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Detalle por día</h3>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {detail.slice().reverse().map(day => (
              <div key={day.fecha} className="grid grid-cols-[80px_1fr_40px] gap-2 items-center py-[0.35rem] border-b border-[rgba(143,202,160,0.05)] last:border-b-0">
                <span className="text-[0.65rem] text-[#a0907e] [font-variant-numeric:tabular-nums]">{day.fecha}</span>
                <div className="flex gap-[3px]">
                  {SLOT_NAMES.map(s => (
                    <span
                      key={s}
                      className={`flex-1 h-[22px] rounded-[4px] flex items-center justify-center text-[0.5rem] font-semibold transition-all ${
                        day.slots[s] && day.slots[s] !== ''
                          ? 'bg-[rgba(143,202,160,0.15)] text-kbl-green border border-[rgba(143,202,160,0.18)]'
                          : 'bg-[rgba(143,202,160,0.04)] text-[#a0907e] border border-[rgba(143,202,160,0.06)]'
                      }`}
                      title={`${s}: ${day.slots[s] || '—'}`}
                    >
                      {day.slots[s] && day.slots[s] !== '' ? day.slots[s].replace(/:\d{2}.*/, '') : '·'}
                    </span>
                  ))}
                </div>
                <div className="h-[4px] bg-[rgba(143,202,160,0.06)] rounded-[2px] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-kbl-green to-[#8fcaa0] rounded-[2px] transition-all duration-300" style={{ width: `${(day.filled_slots / 5) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
