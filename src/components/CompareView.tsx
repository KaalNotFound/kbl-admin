import { useState, useEffect, useRef } from 'react'
import { fetchCompare } from '../api'
import type { CompareData } from '../types'
import { CardSkeleton } from './SkeletonFin'

export default function CompareView() {
  const [query, setQuery] = useState('')
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!query.trim()) { setData(null); return }
    setLoading(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      fetchCompare(query.trim()).then(r => { setData(r); setLoading(false) })
    }, 400)
    return () => clearTimeout(timer.current)
  }, [query])

  return (
    <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[0.8rem] font-semibold text-[#c8b8a8] uppercase tracking-wider">Comparar precios entre comercios</h3>
        <span className="text-[0.6rem] font-semibold px-[0.5rem] py-[0.15rem] rounded-full bg-[rgba(232,184,75,0.08)] text-kbl-blue">{data?.comparison?.length || 0}</span>
      </div>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-[#a0907e] opacity-50 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="w-full px-[0.85rem] py-[0.6rem] pl-[2.2rem] border border-[rgba(232,184,75,0.08)] rounded-[10px] bg-[rgba(15,11,15,0.5)] text-[#f0e5d8] text-sm outline-none transition-all focus:border-kbl-blue focus:shadow-[0_0_0_3px_rgba(232,184,75,0.06),0_0_20px_rgba(232,184,75,0.04)] focus:bg-[rgba(15,11,15,0.7)] placeholder:text-[#a0907e]"
            placeholder="Ej: fideos, pan, leche, arroz…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>
      {loading && <CardSkeleton />}
      {data && !loading && (
        <>
          {data.comparison.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-[#a0907e]">
              <span className="text-[1.5rem] opacity-30">?</span>
              <span className="text-sm">Sin resultados para "{data.query}"</span>
              <span className="text-[0.7rem] opacity-60">Probá con otro producto</span>
            </div>
          ) : (
            <>
              <div className="flex gap-6 px-3 py-[0.6rem] text-[0.7rem] text-[#a0907e] border-b border-[rgba(232,184,75,0.08)] flex-wrap bg-[rgba(15,11,15,0.3)] rounded-t-[10px]">
                <span className="inline-flex items-center gap-[0.3rem] first:before:hidden before:inline-block before:w-[4px] before:h-[4px] before:rounded-full before:bg-[#a0907e] before:opacity-30">{data.comparison.length} productos</span>
                <span className="inline-flex items-center gap-[0.3rem] before:inline-block before:w-[4px] before:h-[4px] before:rounded-full before:bg-[#a0907e] before:opacity-30">{data.stores.length} comercios</span>
                <span className="inline-flex items-center gap-[0.3rem] before:inline-block before:w-[4px] before:h-[4px] before:rounded-full before:bg-[#a0907e] before:opacity-30">Promedio <strong className="text-[#c8b8a8] font-semibold">${data.summary.avg_price_all}</strong></span>
                <span className="inline-flex items-center gap-[0.3rem] before:inline-block before:w-[4px] before:h-[4px] before:rounded-full before:bg-[#a0907e] before:opacity-30">Rango <strong className="text-[#c8b8a8] font-semibold">${data.summary.min_price_all} – ${data.summary.max_price_all}</strong></span>
              </div>
              <div className="overflow-x-auto border border-[rgba(232,184,75,0.08)] rounded-b-[10px] border-t-0">
                <table className="w-full border-collapse text-[0.78rem]">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Producto</th>
                      {data.stores.map(s => <th key={s} className="text-center px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.55rem] border-b border-[rgba(232,184,75,0.08)] whitespace-nowrap">{s}</th>)}
                      <th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Mín</th>
                      <th className="text-left px-3 py-[0.6rem] bg-[rgba(15,11,15,0.4)] text-[#a0907e] font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Prom</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.comparison.map((item, i) => {
                      const priceMap: Record<string, { comercio: string; precio: number; fecha: string }> = {}
                      item.precios.forEach(p => { priceMap[p.comercio] = p })
                      return (
                        <tr key={i} className="even:bg-[rgba(240,229,216,0.03)]">
                          <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8]">
                            <span className="block font-medium text-[0.82rem]">{item.producto}</span>
                            {item.categoria && <span className="block text-[0.6rem] text-[#a0907e] font-normal">{item.categoria}</span>}
                          </td>
                          {data.stores.map(s => {
                            const p = priceMap[s]
                            const isMin = p && p.precio === item.min_price
                            return (
                              <td key={s} className={`px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-center whitespace-nowrap cursor-default hover:bg-[rgba(240,229,216,0.04)] ${isMin ? 'bg-[rgba(143,202,160,0.10)] shadow-[inset_0_0_0_1px_rgba(143,202,160,0.2)] hover:bg-[rgba(143,202,160,0.15)]' : ''}`} title={p ? `${p.comercio} · ${p.fecha}` : ''}>
                                {p ? (
                                  <span className={`font-semibold [font-variant-numeric:tabular-nums] text-[0.85rem] ${isMin ? 'text-kbl-green relative after:content-["★"] after:absolute after:-top-[0.4rem] after:-right-[0.9rem] after:text-[0.5rem] after:text-kbl-green after:opacity-80' : 'text-[#f0e5d8]'}`}>${p.precio}</span>
                                ) : <span className="text-[0.7rem] text-[#a0907e]">—</span>}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8] font-semibold text-kbl-blue [font-variant-numeric:tabular-nums]">${item.min_price}</td>
                          <td className="px-3 py-2 border-b border-[rgba(232,184,75,0.04)] text-[#f0e5d8] font-semibold text-kbl-blue [font-variant-numeric:tabular-nums]">${item.avg_price}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
