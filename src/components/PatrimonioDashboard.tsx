import { useEffect, useState } from 'react'
import { fetchPatrimonio } from '../api'
import type { PatrimonioData } from '../types'
import AnimatedNumber from './AnimatedNumber'
import { CardSkeleton, HeroSkeleton } from './SkeletonFin'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export default function PatrimonioDashboard() {
  const [data, setData] = useState<PatrimonioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchPatrimonio(controller.signal)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { if (controller.signal.aborted) return; setError(e.message); setLoading(false) })
    return () => controller.abort()
  }, [])

  if (loading) return (
    <div className="flex flex-col gap-5">
      <HeroSkeleton />
      <CardSkeleton />
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1"><CardSkeleton /><CardSkeleton /></div>
    </div>
  )
  if (error) return <div className="fin-dark flex items-center gap-[0.6rem] px-5 py-[0.9rem] bg-page/95 border border-danger/20 rounded-[10px] text-danger text-sm"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-danger/20 text-danger font-bold text-[0.75rem]">!</span>{error}</div>
  if (!data) return null

  const ingresoTotal = (data.perfil_ingresos?.reduce((s, i) => s + i.monto, 0) || 0) + data.total_income_extra

  return (
    <div className="fin-dark flex flex-col gap-6 [&>*]:animate-card-enter [&>*:nth-child(1)]:[animation-delay:0s] [&>*:nth-child(2)]:[animation-delay:0.06s] [&>*:nth-child(3)]:[animation-delay:0.12s] [&>*:nth-child(4)]:[animation-delay:0.18s] [&>*:nth-child(5)]:[animation-delay:0.24s]">

      {/* Hero — Net Worth */}
      <div className="relative bg-card p-7 hover:border-[rgba(232,184,75,0.2)]">
        <div className="absolute -top-2/5 -right-1/5 w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(143,202,160,0.08),transparent_70%)] pointer-events-none animate-glow-pulse" />
        <div className="flex items-center gap-[0.6rem] mb-2">
          <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-kbl-green bg-[rgba(143,202,160,0.1)] px-[0.6rem] py-[0.2rem] rounded-[4px]">Patrimonio neto</span>
        </div>
        <div className="text-[2.8rem] font-bold leading-tight mb-2 text-gradient-green animate-hero-shimmer max-lg:text-[2rem]">
          $<AnimatedNumber value={data.net_worth} />
        </div>
        <div className="flex items-center gap-4 flex-wrap text-[0.85rem] text-text-secondary">
          <span>Activos: ${data.total_activos}</span>
          <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
          <span>Pasivos: −${data.pasivos_mensuales}/mes</span>
          <span className="w-[3px] h-[3px] rounded-full bg-text-tertiary" />
          <span>Ingresos pasivos: +${data.ingresos_pasivos}/mes</span>
        </div>
      </div>

      {/* Grid: Assets table + Allocation */}
      <div className="grid grid-cols-2 gap-5 max-lg:grid-cols-1">
        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider mb-4">Activos</h3>
          {data.assets.length === 0 ? (
            <p className="text-sm text-text-tertiary">Sin activos registrados</p>
          ) : (
            <div className="flex flex-col gap-1">
              {data.assets.map((a, i) => (
                <div key={i} className="flex justify-between items-center py-[0.4rem] text-sm border-b border-[rgba(232,184,75,0.04)] last:border-b-0">
                  <div>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-text-primary font-medium">{a.nombre}</span>
                      {a.obsidian_url && (
                        <a
                          href={a.obsidian_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open source note in Obsidian"
                          className="inline-flex items-center text-[0.65rem] text-text-tertiary border border-[rgba(232,184,75,0.15)] rounded-[4px] px-[0.3rem] py-[0.05rem] hover:text-kbl-blue hover:border-[rgba(232,184,75,0.35)] hover:bg-[rgba(232,184,75,0.06)] transition-colors"
                        >↗</a>
                      )}
                    </span>
                    <span className="block text-[0.6rem] text-text-tertiary uppercase">{a.tipo}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold">${a.valor}</span>
                    {a.ingreso_generado > 0 && (
                      <span className="block text-[0.6rem] text-kbl-green">+${a.ingreso_generado}/mes</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-[rgba(232,184,75,0.06)] flex justify-between text-sm font-semibold">
            <span className="text-text-secondary">Total activos</span>
            <span className="font-mono text-kbl-green">${data.total_activos}</span>
          </div>
        </div>

        <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider mb-4">Distribución</h3>
          {data.asset_allocation.length === 0 ? (
            <p className="text-sm text-text-tertiary">Sin activos para distribuir</p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={data.asset_allocation} dataKey="total" nameKey="tipo" cx="50%" cy="50%" innerRadius={50} outerRadius={80} stroke="none">
                    {data.asset_allocation.map((_, i) => (
                      <Cell key={i} fill={['#8fcab0', '#e8b84b', '#5b9bd5', '#e08a7a', '#b8a0d8'][i % 5]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e1420', border: '1px solid rgba(232,184,75,0.15)', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#c8b8a8' }} formatter={(v: number) => `$${v}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3">
                {data.asset_allocation.map((a, i) => {
                  const colors = ['#8fcab0', '#e8b84b', '#5b9bd5', '#e08a7a', '#b8a0d8']
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-sm">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[i % 5] }} />
                      <span className="text-text-secondary capitalize">{a.tipo}</span>
                      <span className="font-mono font-semibold">${a.total}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Income sources */}
      <div className="bg-card p-5 hover:border-[rgba(232,184,75,0.2)] hover:bg-[rgba(42,30,42,0.8)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">Ingresos</h3>
          <span className="text-[0.7rem] text-kbl-green font-semibold">+${ingresoTotal}/mes</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-[rgba(143,202,160,0.04)] border border-[rgba(143,202,160,0.1)] rounded-[12px] p-4">
            <h4 className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary mb-2">Sueldo fijo</h4>
            {data.perfil_ingresos?.filter(i => i.tipo === 'fijo').map((i, idx) => (
              <div key={idx} className="flex justify-between text-sm py-1">
                <span className="text-text-secondary">{i.fuente}</span>
                <span className="font-mono font-semibold text-kbl-green">+${i.monto}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
            <div className="bg-[rgba(232,184,75,0.04)] border border-[rgba(232,184,75,0.1)] rounded-[12px] p-4">
              <h4 className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary mb-2">Extra / variable</h4>
              {data.perfil_ingresos?.filter(i => i.tipo === 'variable').map((i, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-text-secondary">{i.fuente}</span>
                  <span className="font-mono font-semibold text-kbl-blue">+${i.monto}</span>
                </div>
              ))}
            </div>
            <div className="bg-[rgba(224,138,122,0.04)] border border-[rgba(224,138,122,0.1)] rounded-[12px] p-4">
              <h4 className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary mb-2">Wallet Pau</h4>
              {data.income_sources.length === 0 ? (
                <p className="text-sm text-text-tertiary">Sin ingresos registrados</p>
              ) : (
                data.income_sources.map((s, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-1">
                    <span className="text-text-secondary">{s.fuente}</span>
                    <span className="font-mono font-semibold text-kbl-green">+${s.monto}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-[rgba(143,202,160,0.06)] border border-[rgba(143,202,160,0.15)] rounded-[16px] p-5">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-[0.8rem] font-semibold text-text-secondary uppercase tracking-wider">Resumen patrimonial</h3>
        </div>
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-lg:gap-3">
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Patrimonio neto</span>
            <div className="text-lg font-bold mt-1">$<AnimatedNumber value={data.net_worth} /></div>
          </div>
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Total activos</span>
            <div className="text-lg font-bold mt-1 text-kbl-green">${data.total_activos}</div>
          </div>
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Pasivos / mes</span>
            <div className="text-lg font-bold mt-1 text-kbl-red">−${data.pasivos_mensuales}</div>
          </div>
          <div>
            <span className="text-[0.65rem] uppercase tracking-wider font-semibold text-text-tertiary">Ingreso extra</span>
            <div className="text-lg font-bold mt-1 text-kbl-blue">+${data.total_income_extra}</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[rgba(143,202,160,0.1)] text-xs text-text-tertiary">
          Datos del pipeline KBL · {new Date().toLocaleDateString('es-AR')}
        </div>
      </div>
    </div>
  )
}
