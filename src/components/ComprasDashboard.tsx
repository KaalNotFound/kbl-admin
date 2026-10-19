import { useEffect, useState, useMemo, useCallback } from 'react'
import { fetchSummary, fetchInsights, searchItems } from '../api'
import type { Summary, Insights, SearchResults } from '../types'
import AnimatedNumber from './AnimatedNumber'
import { Sparkline } from './Sparkline'
import { CardSkeleton, HeroSkeleton } from './SkeletonFin'
import CompareView from './CompareView'

function prevMonth(m: string) {
  const y = +m.slice(0, 4); const mo = +m.slice(5)
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`
}

export default function ComprasDashboard({ month }: { month: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [storeFilter, setStoreFilter] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setSummary(null)
    setPrevSummary(null)
    Promise.all([
      fetchSummary(month),
      fetchSummary(prevMonth(month)),
      fetchInsights(month),
    ])
      .then(([s, p, i]) => { setSummary(s); setPrevSummary(p); setInsights(i); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [month])

  useEffect(() => {
    if (!searchQ && !storeFilter) { setSearchResults(null); return }
    const t = setTimeout(() => searchItems(searchQ, storeFilter).then(r => setSearchResults(r)), 300)
    return () => clearTimeout(t)
  }, [searchQ, storeFilter])

  const stores = useMemo(() => summary?.store_stats?.map(s => s.name) || [], [summary])

  const hormigaTotal = useMemo(() => insights?.hormiga?.reduce((s, h) => s + h.total_mes, 0) || 0, [insights])

  const exportCSV = useCallback(() => {
    if (!summary) return
    const rows = [
      ['Campo', 'Valor'],
      ['Mes', summary.month],
      ['Total', summary.total],
      ['Promedio diario', summary.daily_avg],
      ['Tickets', summary.tickets],
      ['Productos', summary.items],
      ['Mes anterior', summary.last_month_total],
      ['Cambio %', summary.change_percent ?? ''],
      [],
      ['Categoría', 'Total', '%'],
      ...(summary.top_categories?.map(c => [c.name, c.total, c.percent]) || []),
      [],
      ['Comercio', 'Total', 'Visitas'],
      ...(summary.store_stats?.map(s => [s.name, s.total, s.visits]) || []),
    ]
    const csv = rows.map(r => r.map(v => String(v).replace(/,/g, '.')).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kbl-reporte-${summary.month}.csv`
    a.click(); URL.revokeObjectURL(url)
  }, [summary])

  if (loading) return (
    <div className="flex flex-col gap-5">
      <HeroSkeleton />
      <CardSkeleton />
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1"><CardSkeleton /><CardSkeleton /></div>
    </div>
  )
  if (error) return <div className="flex items-center gap-[0.6rem] px-5 py-[0.9rem] bg-[rgba(224,138,122,0.08)] border border-[rgba(224,138,122,0.2)] rounded-[10px] text-[#e0a0a0] text-sm"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-[rgba(224,138,122,0.2)] text-kbl-red font-bold text-[0.75rem]">!</span>{error}</div>
  if (!summary) return null

  const changeIncrease = summary.change_percent !== null && summary.change_percent > 0
  const changeArrow = summary.change_percent !== null
    ? (summary.change_percent > 0 ? '↑' : '↓') : '—'

  return (
      <div className="flex flex-col gap-6 [&>*]:animate-card-enter [&>*:nth-child(1)]:[animation-delay:0s] [&>*:nth-child(2)]:[animation-delay:0.06s] [&>*:nth-child(3)]:[animation-delay:0.12s] [&>*:nth-child(4)]:[animation-delay:0.18s] [&>*:nth-child(5)]:[animation-delay:0.24s] [&>*:nth-child(6)]:[animation-delay:0.3s] [&>*:nth-child(7)]:[animation-delay:0.36s] [&>*:nth-child(8)]:[animation-delay:0.42s] [&>*:nth-child(9)]:[animation-delay:0.48s] [&>*:nth-child(10)]:[animation-delay:0.54s]">
      {/* Hero */}
      <div className="relative bg-card p-7 hover:border-[rgba(232,184,75,0.2)]">
        <div className="absolute -top-2/5 -right-1/5 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(232,184,75,0.08),transparent_70%)] pointer-events-none animate-glow-pulse" />
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-[0.6rem]">
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-blue bg-[rgba(232,184,75,0.1)] px-[0.6rem] py-[0.2rem] rounded-[4px]">{month}</span>
            <span className="text-[0.8rem] text-[#a0907e]">gasto total del mes</span>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-[0.4rem] text-[0.65rem] font-medium text-[#a0907e] bg-[rgba(232,184,75,0.06)] hover:bg-[rgba(232,184,75,0.12)] hover:text-[#c8b8a8] px-[0.6rem] py-[0.3rem] rounded-[6px] border border-[rgba(232,184,75,0.08)] transition-colors" title="Descargar CSV">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
        </div>
        <div className="text-[3.2rem] font-bold leading-tight mb-3 text-gradient-blue animate-hero-shimmer max-lg:text-[2.4rem]">
          $<AnimatedNumber value={summary.total} />
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className={`text-sm font-semibold ${changeIncrease ? 'text-kbl-red' : 'text-kbl-green'}`}>
            {changeArrow} {summary.change_percent !== null ? `${Math.abs(summary.change_percent)}% vs mes pasado` : '—'}
          </span>
          <span className="text-[0.8rem] text-[#c8b8a8]">${summary.daily_avg}/día</span>
          <span className="w-[3px] h-[3px] rounded-full bg-[#a0907e]" />
          <span className="text-[0.8rem] text-[#c8b8a8]">{summary.tickets} tickets</span>
          <span className="w-[3px] h-[3px] rounded-full bg-[#a0907e]" />
          <span className="text-[0.8rem] text-[#c8b8a8]">{summary.items} productos</span>
        </div>
        <div className="mt-1 opacity-70 hover:opacity-100">
          <Sparkline data={summary.daily_spending} color="#7ec8e3" />
        </div>
      </div>

      {/* Comparison */}
      {prevSummary && summary && summary.last_month_total > 0 && (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Comparativa mensual</h3>
          </div>
          <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
            <div>
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-[#a0907e]">{prevMonth(month)}</span>
              <div className="text-[2rem] font-bold text-[#c8b8a8] mt-1">${prevSummary.total}</div>
              <div className="flex gap-3 mt-2 text-[0.75rem] text-[#a0907e]">
                <span>{prevSummary.tickets} tickets</span>
                <span>${prevSummary.daily_avg}/día</span>
              </div>
              {prevSummary.top_categories?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[rgba(232,184,75,0.06)]">
                  <span className="text-[0.65rem] text-[#a0907e] uppercase tracking-wider font-semibold">Top categorías</span>
                  {prevSummary.top_categories.slice(0, 4).map(c => (
                    <div key={c.name} className="flex justify-between items-center py-1 text-[0.75rem]">
                      <span className="text-[#c8b8a8]">{c.name}</span>
                      <span className="font-semibold">${c.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-blue">{month}</span>
              <div className="text-[2rem] font-bold text-[#f0e5d8] mt-1">${summary.total}</div>
              <div className="flex gap-3 mt-2 text-[0.75rem] text-[#a0907e]">
                <span>{summary.tickets} tickets</span>
                <span>${summary.daily_avg}/día</span>
              </div>
              {summary.top_categories?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[rgba(232,184,75,0.06)]">
                  <span className="text-[0.65rem] text-[#a0907e] uppercase tracking-wider font-semibold">Top categorías</span>
                  {summary.top_categories.slice(0, 4).map(c => (
                    <div key={c.name} className="flex justify-between items-center py-1 text-[0.75rem]">
                      <span className="text-[#c8b8a8]">{c.name}</span>
                      <span className="font-semibold">${c.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-[rgba(232,184,75,0.06)] flex justify-between items-center">
            <span className="text-[0.75rem] text-[#a0907e]">Diferencia</span>
            <span className={`text-sm font-bold ${summary.change_percent > 0 ? 'text-kbl-red' : 'text-kbl-green'}`}>
              {summary.change_percent > 0 ? '↑' : '↓'} ${Math.abs(summary.total - prevSummary.total)} ({Math.abs(summary.change_percent)}%)
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        {/* Categories */}
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Gastos por categoría</h3>
            <span className="text-[0.6rem] font-semibold px-[0.5rem] py-[0.15rem] rounded-full bg-[rgba(232,184,75,0.08)] text-kbl-blue">{summary.top_categories.length}</span>
          </div>
          <div className="flex flex-col gap-3">
            {summary.top_categories.map((cat, i) => (
              <div key={cat.name} className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[0.65rem] font-bold text-[rgba(240,229,216,0.6)]" style={{ background: i === 0 ? 'linear-gradient(135deg, #7ec8e3, #8fcaa0)' : 'rgba(240,229,216,0.08)' }}>{i + 1}</span>
                    {cat.name}
                  </span>
                  <span className="text-sm font-semibold [font-variant-numeric:tabular-nums]">${cat.total}</span>
                </div>
                <div className="h-[6px] bg-[rgba(232,184,75,0.06)] rounded-[3px] overflow-hidden">
                  <div className="h-full rounded-[3px] bg-gradient-to-r from-kbl-blue to-kbl-blue-dark shadow-[0_0_8px_rgba(232,184,75,0.15)]" style={{ width: `${cat.percent}%` }} />
                </div>
                <div className="text-[0.65rem] text-[#a0907e] text-right">{cat.percent}% del gasto</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stores */}
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Dónde comprás</h3>
            <span className="text-[0.6rem] font-semibold px-[0.5rem] py-[0.15rem] rounded-full bg-[rgba(232,184,75,0.08)] text-kbl-blue">{summary.store_stats.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            {summary.store_stats.map((s, i) => (
              <div key={s.name} className="flex justify-between items-center py-2 border-b border-[rgba(232,184,75,0.04)] last:border-b-0">
                <div className="flex items-center gap-[0.6rem]">
                  <span className="text-[0.65rem] font-bold text-[#a0907e] w-5">#{i + 1}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="text-[0.65rem] text-[#a0907e]">{s.visits} visitas</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold block">${s.total}</span>
                  <span className="text-[0.65rem] text-[#a0907e]">${Math.round(s.total / s.visits)}/visita</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        {/* Hormiga */}
        {insights?.hormiga?.length > 0 && (
          <div className="bg-card p-5 border-[rgba(224,138,122,0.15)] hover:border-[rgba(224,138,122,0.25)] hover:bg-[rgba(42,30,42,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">🐜 Gastos chicos que suman</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-3 pb-3 border-b border-[rgba(224,138,122,0.08)]">
              <span className="text-[1.3rem] font-bold text-kbl-red">${hormigaTotal}/mes</span>
              <span className="text-[0.75rem] text-[#a0907e]">${hormigaTotal * 12}/año</span>
            </div>
            {insights.hormiga.map((h, i) => (
              <div key={i} className="flex justify-between items-center py-[0.4rem] border-b border-[rgba(224,138,122,0.06)] last:border-b-0">
                <div className="flex flex-col">
                  <span className="text-[0.8rem] font-medium">{h.producto}</span>
                  <span className="text-[0.65rem] text-[#a0907e]">{h.veces}x este mes</span>
                </div>
                <span className="text-sm font-semibold text-kbl-red">${h.total_mes}</span>
              </div>
            ))}
          </div>
        )}

        {/* Top expensive */}
        {insights?.top_expensive?.length > 0 && (
          <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Productos más caros</h3>
              <span className="text-[0.6rem] font-semibold px-[0.5rem] py-[0.15rem] rounded-full bg-[rgba(232,184,75,0.08)] text-kbl-blue">{insights.top_expensive.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {insights.top_expensive.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-[rgba(232,184,75,0.04)] last:border-b-0">
                  <span className="w-[26px] h-[26px] rounded-[8px] bg-[rgba(232,184,75,0.06)] flex items-center justify-center text-[0.7rem] font-bold text-[#a0907e]">{i + 1}</span>
                  <div className="flex-1 flex flex-col">
                    <span className="text-sm font-medium">{item.producto}</span>
                    <span className="text-[0.65rem] text-[#a0907e]">{item.comercio} · {item.fecha}</span>
                  </div>
                  <span className="text-base font-bold text-kbl-blue [font-variant-numeric:tabular-nums]">${item.precio}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Insights */}
      {insights?.preocupaciones?.length > 0 && (
        <div className="bg-[rgba(143,202,160,0.06)] border border-[rgba(143,202,160,0.15)] rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">💡 Observaciones</h3>
          </div>
          {insights.preocupaciones.map((p, i) => (
            <p key={i} className="text-sm text-[#c8b8a8] leading-relaxed py-[0.3rem] pl-3 border-l-2 border-kbl-green mb-[0.3rem] last:mb-0">{p}</p>
          ))}
        </div>
      )}

      {/* Recurrencias */}
      {insights?.recurrencias?.length > 0 && (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">🔄 Compras frecuentes</h3>
          </div>
          <div className="flex flex-col gap-[0.4rem]">
            {insights.recurrencias.map((r, i) => (
              <div key={i} className="flex items-center gap-3 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] last:border-b-0">
                <span className="flex-1 text-sm font-medium">{r.producto}</span>
                <span className="text-[0.65rem] text-[#a0907e]">{r.categoria} · {r.frecuencia}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">🔍 Buscar productos</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-[#a0907e] opacity-50 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="w-full px-[0.85rem] py-[0.6rem] pl-[2.2rem] border border-[rgba(232,184,75,0.08)] rounded-[10px] bg-[rgba(15,11,15,0.5)] text-[#f0e5d8] text-sm outline-none transition-all focus:border-kbl-blue focus:shadow-[0_0_0_3px_rgba(232,184,75,0.06),0_0_20px_rgba(232,184,75,0.04)] focus:bg-[rgba(15,11,15,0.7)] placeholder:text-[#a0907e]"
              placeholder="Producto, categoría, comercio…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
          </div>
          <select className="px-[0.85rem] py-[0.6rem] border border-[rgba(232,184,75,0.08)] rounded-[10px] bg-[rgba(15,11,15,0.5)] text-[#f0e5d8] text-sm outline-none cursor-pointer focus:border-kbl-blue focus:shadow-[0_0_0_3px_rgba(232,184,75,0.06)]" value={storeFilter} onChange={e => setStoreFilter(e.target.value)}>
            <option value="">Todos</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {searchResults && (
          <div className="overflow-x-auto border border-[rgba(232,184,75,0.08)] rounded-[10px]">
            <table className="w-full border-collapse text-[0.8rem]">
              <thead>
                <tr><th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Fecha</th><th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Comercio</th><th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Producto</th><th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Precio</th><th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Historial</th></tr>
              </thead>
              <tbody>
                {searchResults.results.length === 0 ? (
                  <tr><td colSpan={5}><div className="flex flex-col items-center gap-2 py-8 text-[#a0907e]"><span className="text-sm">Sin resultados</span></div></td></tr>
                ) : (searchResults.results.map((item, i) => (
                  <tr key={i} className="even:bg-[rgba(240,229,216,0.03)] hover:bg-[rgba(232,184,75,0.03)]">
                    <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8]"><span className="text-[0.75rem] text-[#a0907e] whitespace-nowrap">{item.fecha}</span></td>
                    <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8]"><span className="inline-block px-[0.5rem] py-[0.15rem] rounded-[4px] text-[0.7rem] font-medium bg-[rgba(232,184,75,0.08)] text-kbl-blue">{item.comercio}</span></td>
                    <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8] font-medium">{item.producto}</td>
                    <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8]"><span className="font-semibold text-kbl-blue [font-variant-numeric:tabular-nums]">${item.precio_total}</span></td>
                    <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8]">
                      {item.historial.length > 0 ? (
                        <div className="flex gap-[0.3rem] flex-wrap">
                          {item.historial.map((h, j) => (
                            <span key={j} className={`text-[0.65rem] px-[0.35rem] py-[0.1rem] rounded-[3px] bg-[rgba(240,229,216,0.05)] [font-variant-numeric:tabular-nums] ${h.precio < item.precio_total ? 'text-kbl-red' : h.precio > item.precio_total ? 'text-kbl-green' : ''}`}>
                              ${h.precio}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-[0.75rem] text-[#a0907e]">—</span>}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compare */}
      <CompareView />
    </div>
  )
}
