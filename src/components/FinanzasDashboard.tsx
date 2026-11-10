import { useEffect, useState } from 'react'
import { fetchFinanzas } from '../api'
import type { FinanzasData } from '../types'
import AnimatedNumber from './AnimatedNumber'
import { CardSkeleton, HeroSkeleton } from './SkeletonFin'
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'

export default function FinanzasDashboard() {
  const [data, setData] = useState<FinanzasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFinanzas(controller.signal)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { if (controller.signal.aborted) return; setError(e.message); setLoading(false) })
    return () => controller.abort()
  }, [])

  const deficitPct = data ? Math.round(Math.abs(data.flujo_neto) / data.gasto_total_mensual * 100) : 0
  const ahorroPct = data?.mercado?.ahorro_total && data.mercado.ahorro_total > 0 ? data.mercado.ahorro_total : 0
  const sobreprecio = data?.mercado?.detalles?.filter(d => d.tipo === 'sobreprecio').reduce((s, d) => s + d.diferencia, 0) || 0

  if (loading) return (
    <div className="flex flex-col gap-5">
      <HeroSkeleton />
      <CardSkeleton />
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1"><CardSkeleton /><CardSkeleton /></div>
    </div>
  )
  if (error) return <div className="fin-dark flex items-center gap-[0.6rem] px-5 py-[0.9rem] bg-page/95 border border-danger/20 rounded-[10px] text-danger text-sm"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-danger/20 text-danger font-bold text-[0.75rem]">!</span>{error}</div>
  if (!data) return null

  return (
    <div className="fin-dark flex flex-col gap-6 [&>*]:animate-card-enter [&>*:nth-child(1)]:[animation-delay:0s] [&>*:nth-child(2)]:[animation-delay:0.06s] [&>*:nth-child(3)]:[animation-delay:0.12s] [&>*:nth-child(4)]:[animation-delay:0.18s] [&>*:nth-child(5)]:[animation-delay:0.24s]">

      {/* Hero — Runway */}
      <div className="relative bg-card p-7 hover:border-[rgba(232,184,75,0.2)]">
        <div className="absolute -top-2/5 -right-1/5 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(143,202,160,0.08),transparent_70%)] pointer-events-none animate-glow-pulse" />
        <div className="flex items-center gap-[0.6rem] mb-2">
          <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-green bg-[rgba(143,202,160,0.1)] px-[0.6rem] py-[0.2rem] rounded-[4px]">Runway financiero</span>
        </div>
        <div className="text-[2.8rem] font-bold leading-tight mb-2 text-gradient-green animate-hero-shimmer max-lg:text-[2rem]">
          {typeof data.runway.meses === 'number' ? `${data.runway.meses} meses` : '∞ · flujo positivo'}
        </div>
        {typeof data.runway.meses === 'number' && (
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-sm text-text-secondary">{data.runway.dias} días · se agota {data.runway.fecha_fin}</span>
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap text-[0.85rem] text-text-secondary">
          <span>Saldo: ${data.saldo}</span>
          <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
          <span>Ingresos: ${data.ingresos}/mes</span>
          <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
          <span>Gasto: ${data.gasto_total_mensual}/mes</span>
        </div>
        <div className={`mt-3 text-sm font-semibold ${data.deficit ? 'text-kbl-red' : 'text-kbl-green'}`}>
          {data.deficit
            ? `Déficit: −$${Math.abs(data.flujo_neto)}/mes (${deficitPct}% del gasto)`
            : `Excedente: +$${data.flujo_neto}/mes`}
        </div>
      </div>

      {/* Reconciliacion — diferencial no anotado */}
      {data.reconciliacion && data.reconciliacion.tiene_diferencial && (
        <div className="bg-card p-5 hover:border-[rgba(233,150,120,0.25)] hover:bg-[rgba(42,30,42,0.8)] border-l-4 border-kbl-red">
          <div className="flex items-center gap-[0.6rem] mb-2">
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-red bg-[rgba(224,138,122,0.1)] px-[0.6rem] py-[0.2rem] rounded-[4px]">Diferencial no anotado</span>
          </div>
          <div className="text-[1.6rem] font-bold leading-tight text-kbl-red mb-1">
            ~${data.reconciliacion.diferencial}
          </div>
          <div className="text-sm text-text-secondary">{data.reconciliacion.interpretacion}</div>
          <div className="flex items-center gap-4 flex-wrap text-[0.75rem] text-text-tertiary mt-2 pt-2 border-t border-[rgba(232,184,75,0.06)]">
            <span>Saldo anterior: ${data.reconciliacion.saldo_anterior}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
            <span>Esperado: ~${data.reconciliacion.esperado}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
            <span>Actual: ${data.reconciliacion.saldo_actual}</span>
            <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
            <span>Gastos registrados: ${data.reconciliacion.gastos_registrados}</span>
          </div>
        </div>
      )}

      {/* Reconciliacion — sin diferencial (check verde) */}
      {data.reconciliacion && !data.reconciliacion.tiene_diferencial && (
        <div className="bg-card p-5 border-l-4 border-kbl-green">
          <div className="flex items-center gap-[0.6rem] mb-1">
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-green bg-[rgba(143,202,160,0.1)] px-[0.6rem] py-[0.2rem] rounded-[4px]">Reconciliado</span>
          </div>
          <div className="text-sm text-text-secondary">{data.reconciliacion.interpretacion}</div>
          <div className="flex items-center gap-4 flex-wrap text-[0.7rem] text-text-tertiary mt-1">
            <span>Desde {data.reconciliacion.desde_fecha}</span>
          </div>
        </div>
      )}

      {/* Cashflow bar chart */}
      <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
        <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider mb-4">Cashflow mensual</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[
            { name: 'Ingreso', monto: data.ingresos, fill: '#8fcab0' },
            { name: 'Fijos', monto: -data.gastos_fijos, fill: '#e8b84b' },
            { name: 'Variables', monto: -data.gasto_variable_mensual, fill: '#e08a7a' },
            { name: 'Neto', monto: data.flujo_neto, fill: data.deficit ? '#e08a7a' : '#8fcab0' },
          ]} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a0907e', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a0907e', fontSize: 11 }} tickFormatter={(v: number) => `$${Math.abs(v)}`} />
            <Tooltip contentStyle={{ background: '#1e1420', border: '1px solid rgba(232,184,75,0.15)', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#c8b8a8' }} formatter={(v) => `$${Math.abs(Number(v))}`} />
            <Bar dataKey="monto" radius={[4, 4, 0, 0]} maxBarSize={50} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Presupuesto — Budget vs Actual */}
      {data.presupuesto && (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider mb-4">Presupuesto vs Real</h3>
          <div className="grid grid-cols-2 gap-4 mb-4 max-lg:grid-cols-1">
            <div>
              <div className="flex justify-between text-xs text-text-tertiary mb-1">
                <span>Ingreso esperado</span>
                <span>${data.presupuesto.ingreso_esperado}/mes</span>
              </div>
              <div className="h-2 bg-[rgba(240,229,216,0.06)] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-kbl-green transition-all duration-700" style={{ width: `${Math.min(100, (data.ingresos / data.presupuesto.ingreso_esperado) * 100)}%` }} />
              </div>
              <span className="text-[0.6rem] text-text-tertiary mt-1 block">
                {data.ingresos >= data.presupuesto.ingreso_esperado ? '✅ Meta cumplida' : `$${data.presupuesto.ingreso_esperado - data.ingresos} por debajo`}
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-text-tertiary mb-1">
                <span>Presupuesto total</span>
                <span>${data.presupuesto.presupuesto_fijo}/mes</span>
              </div>
              <div className="h-2 bg-[rgba(240,229,216,0.06)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${data.gasto_total_mensual <= data.presupuesto.presupuesto_fijo ? 'bg-kbl-green' : 'bg-kbl-red'}`}
                  style={{ width: `${Math.min(100, (data.gasto_total_mensual / data.presupuesto.presupuesto_fijo) * 100)}%` }} />
              </div>
              <span className="text-[0.6rem] text-text-tertiary mt-1 block">
                {data.gasto_total_mensual <= data.presupuesto.presupuesto_fijo
                  ? `✅ Dentro de presupuesto`
                  : `⚠️ ${data.gasto_total_mensual - data.presupuesto.presupuesto_fijo} sobre presupuesto`}
              </span>
            </div>
          </div>
          <div className="border-t border-[rgba(232,184,75,0.06)] pt-3">
            <div className="flex justify-between text-xs text-text-tertiary mb-2">
              <span>Límites por categoría</span>
              <span>Gasto ${data.gasto_total_mensual} / $${data.presupuesto.presupuesto_fijo}</span>
            </div>
            {Object.entries(data.presupuesto.limites).map(([cat, limite]) => {
              const gastoCat = data.gastos_por_categoria.find(g => g.categoria.toLowerCase() === cat)?.total || 0
              const pct = Math.min(100, (gastoCat / limite) * 100)
              return (
                <div key={cat} className="mb-2">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-text-secondary capitalize">{cat.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-text-tertiary">{gastoCat > 0 ? `$${gastoCat} / $${limite}` : `$${limite}`}</span>
                  </div>
                  <div className="h-1.5 bg-[rgba(240,229,216,0.06)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${pct > 90 ? 'bg-kbl-red' : pct > 70 ? 'bg-warning' : 'bg-kbl-green'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grid: Gastos fijos + Variables */}
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider mb-4">Gastos fijos (mes)</h3>
          <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-[rgba(232,184,75,0.06)]">
            <span className="text-[1.8rem] font-bold">$<AnimatedNumber value={data.gastos_fijos} /></span>
            <span className="text-[0.75rem] text-text-tertiary">{Math.round(data.gastos_fijos / data.gasto_total_mensual * 100)}% del total</span>
          </div>
          {/* TODO(issue #4 A4): the per-category breakdown shown here was fabricated
              (hardcoded demo rows next to the real API total) and was removed.
              Restore it only when the backend exposes a real gastos_fijos_detalle. */}
        </div>

        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider mb-4">Gastos variables</h3>
          <div className="flex items-baseline gap-3 mb-4 pb-3 border-b border-[rgba(232,184,75,0.06)]">
            <span className="text-[1.8rem] font-bold">$<AnimatedNumber value={data.gasto_variable_mensual} /></span>
            <span className="text-[0.75rem] text-text-tertiary">{data.items_variables} items en 3 meses</span>
          </div>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={data.gastos_por_categoria.slice(0, 5)} dataKey="total" nameKey="categoria" cx="50%" cy="50%" innerRadius={32} outerRadius={60} stroke="none">
                    {data.gastos_por_categoria.slice(0, 5).map((_, i) => (
                      <Cell key={i} fill={['#8fcab0', '#e8b84b', '#5b9bd5', '#e08a7a', '#b8a0d8'][i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e1420', border: '1px solid rgba(232,184,75,0.15)', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#c8b8a8' }} formatter={(v) => `$${Number(v)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-1.5">
                {data.gastos_por_categoria.slice(0, 5).map((c, i) => {
                  const colors = ['#8fcab0', '#e8b84b', '#5b9bd5', '#e08a7a', '#b8a0d8']
                  return (
                    <div key={c.categoria} className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[i % 5] }} />
                        <span className="text-text-secondary truncate">{c.categoria}</span>
                      </div>
                      <span className="font-semibold font-mono flex-shrink-0 ml-2">${c.total}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mercado — Ahorro vs sobreprecio */}
      {data.mercado && (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">Mercado · Ahorro vs Sobreprecio</h3>
            <span className="text-[0.6rem] text-text-tertiary">actualizado {data.mercado.ultima_actualizacion}</span>
          </div>

          <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
            <div className="bg-[rgba(143,202,160,0.06)] border border-[rgba(143,202,160,0.12)] rounded-[12px] p-4">
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Base de datos</span>
              <div className="text-lg font-bold mt-1">{data.mercado.total_productos} productos</div>
              <div className="text-xs text-text-tertiary">{data.mercado.productos_con_precio} con precio</div>
            </div>

            <div className="bg-[rgba(143,202,160,0.06)] border border-[rgba(143,202,160,0.12)] rounded-[12px] p-4">
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Ahorro total</span>
              <div className="text-lg font-bold mt-1 text-kbl-green">${ahorroPct}</div>
              <div className="text-xs text-text-tertiary">comprando inteligente</div>
            </div>

            <div className="bg-[rgba(224,138,122,0.06)] border border-[rgba(224,138,122,0.12)] rounded-[12px] p-4">
              <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Sobreprecio</span>
              <div className="text-lg font-bold mt-1 text-kbl-red">${sobreprecio}</div>
              <div className="text-xs text-text-tertiary">pagado de más vs mercado</div>
            </div>
          </div>

          {data.mercado.detalles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[rgba(232,184,75,0.06)]">
              <h4 className="text-[0.7rem] font-semibold text-text-tertiary uppercase tracking-wider mb-3">Detalles</h4>
              <div className="flex flex-col gap-1">
                {data.mercado.detalles.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-[0.3rem] text-sm border-b border-[rgba(232,184,75,0.04)] last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className={d.tipo === 'ahorro' ? 'text-kbl-green' : 'text-kbl-red'}>{d.tipo === 'ahorro' ? '💰' : '📈'}</span>
                      <span className="text-text-secondary">{d.producto}</span>
                    </div>
                    <span className={`font-mono text-sm ${d.tipo === 'ahorro' ? 'text-kbl-green' : 'text-kbl-red'}`}>
                      {d.tipo === 'ahorro' ? '-$' : '+$'}{d.diferencia}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla comparativa real */}
      {data.mercado?.tabla_comparativa && data.mercado.tabla_comparativa.length > 0 && (
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">Comparativa real · precios de tienda vs compra</h3>
            <span className="text-[0.6rem] text-text-tertiary">{data.mercado.tabla_comparativa.length} productos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.75rem]">
              <thead>
                <tr>
                  <th className="text-left px-2 py-[0.5rem] bg-[rgba(15,11,15,0.4)] text-text-tertiary font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)] sticky left-0 z-10">Producto</th>
                  <th className="text-left px-2 py-[0.5rem] bg-[rgba(15,11,15,0.4)] text-text-tertiary font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Pagaste</th>
                  <th className="text-left px-2 py-[0.5rem] bg-[rgba(15,11,15,0.4)] text-text-tertiary font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Tienda</th>
                  {data.mercado.mercados_disponibles.map(s => (
                    <th key={s} className="text-right px-2 py-[0.5rem] bg-[rgba(15,11,15,0.4)] text-text-tertiary font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">{s}</th>
                  ))}
                  <th className="text-right px-2 py-[0.5rem] bg-[rgba(15,11,15,0.4)] text-text-tertiary font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Mejor</th>
                  <th className="text-right px-2 py-[0.5rem] bg-[rgba(15,11,15,0.4)] text-text-tertiary font-semibold uppercase tracking-wider text-[0.6rem] border-b border-[rgba(232,184,75,0.08)]">Diff</th>
                </tr>
              </thead>
              <tbody>
                {data.mercado.tabla_comparativa.map((item, i) => {
                  const stores = data.mercado?.mercados_disponibles || []
                  return (
                    <tr key={i} className="even:bg-[rgba(240,229,216,0.03)] hover:bg-[rgba(232,184,75,0.03)]">
                      <td className="px-2 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] text-text-primary font-medium sticky left-0 z-10 bg-[rgba(15,11,15,0.95)] whitespace-nowrap">
                        {item.producto}
                        <span className="block text-[0.6rem] text-text-tertiary">{item.categoria}</span>
                      </td>
                      <td className="px-2 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] font-mono font-semibold">${item.ultimo_precio}</td>
                      <td className="px-2 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] text-text-tertiary text-[0.65rem]">{item.ultimo_comercio}</td>
                      {stores.map(s => {
                        const precioM = item.precios_mercado[s]
                        const precioValido = precioM != null
                        const isCheaper = precioValido && precioM < item.ultimo_precio
                        const isEqual = precioValido && precioM === item.ultimo_precio
                        return (
                          <td key={s} className={`px-2 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] text-right font-mono ${
                            isCheaper ? 'text-kbl-green font-semibold' : isEqual ? 'text-text-tertiary' : !precioValido ? 'text-[rgba(240,229,216,0.2)]' : ''
                          }`}>
                            {precioValido ? `$${precioM}` : '—'}
                          </td>
                        )
                      })}
                      <td className="px-2 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] text-right font-mono font-bold">
                        {item.mejor_precio !== null ? `$${item.mejor_precio}` : '—'}
                      </td>
                      <td className={`px-2 py-[0.45rem] border-b border-[rgba(232,184,75,0.04)] text-right font-mono font-semibold ${
                        item.tipo === 'ahorro' ? 'text-kbl-green' : item.tipo === 'sobreprecio' ? 'text-kbl-red' : ''
                      }`}>
                        {item.diferencia !== null
                          ? `${item.diferencia <= 0 ? '' : '+'}$${Math.abs(item.diferencia)}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div className="bg-[rgba(143,202,160,0.06)] border border-[rgba(143,202,160,0.15)] rounded-[16px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">Resumen financiero</h3>
        </div>
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-lg:gap-3">
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Saldo</span>
            <div className="text-lg font-bold mt-1">${data.saldo}</div>
          </div>
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Ingreso / mes</span>
            <div className="text-lg font-bold mt-1 text-kbl-green">+${data.ingresos}</div>
          </div>
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Gasto / mes</span>
            <div className="text-lg font-bold mt-1 text-kbl-red">−${data.gasto_total_mensual}</div>
          </div>
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Flujo neto</span>
            <div className={`text-lg font-bold mt-1 ${data.deficit ? 'text-kbl-red' : 'text-kbl-green'}`}>
              ${data.flujo_neto > 0 ? '+' : ''}{data.flujo_neto}
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[rgba(143,202,160,0.1)] text-xs text-text-tertiary">
          Datos del pipeline KBL · {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>
    </div>
  )
}
