// finanzas-patrimonio.mjs — Patrimonio: activos, ingresos pasivos, income sources, net worth
// (Split ADR-024)
import { query } from './finanzas-db.mjs'
import { getPerfil } from './finanzas-core.mjs'
import { obsidianUrl } from './obsidian-url.mjs'

// --- Patrimonio ---

export function calculatePatrimonio() {
  const perfil = getPerfil()
  const assetRows = query('SELECT tipo, nombre, valor, ingreso_generado, fecha, archivo FROM assets ORDER BY tipo', [])
  // Data provenance (Phase 1): each asset row exposes its source note as obsidian_url
  const assets = assetRows.map(r => ({ tipo: r[0], nombre: r[1], valor: r[2], ingreso_generado: r[3], fecha: r[4], archivo: r[5], obsidian_url: r[5] ? obsidianUrl(r[5]) : null }))
  const totalActivos = assets.reduce((s, a) => s + a.valor, 0)
  const ingresosPasivos = assets.reduce((s, a) => s + a.ingreso_generado, 0)
  const allocation = {}
  for (const a of assets) allocation[a.tipo] = (allocation[a.tipo] || 0) + a.valor
  const assetAllocation = Object.entries(allocation).map(([tipo, total]) => ({ tipo, total, pct: totalActivos > 0 ? Math.round((total / totalActivos) * 100) : 0 }))
  const incomeRows = query('SELECT fuente, monto, tipo, fecha FROM income_sources ORDER BY fecha DESC', [])
  const incomeSources = incomeRows.map(r => ({ fuente: r[0], monto: r[1], tipo: r[2], fecha: r[3] }))
  const totalIncome = incomeSources.reduce((s, i) => s + i.monto, 0)
  const incomeBreakdown = {}
  for (const i of incomeSources) { const key = i.tipo === 'fijo' ? 'fijos' : 'variables'; incomeBreakdown[key] = (incomeBreakdown[key] || 0) + i.monto }
  const perfilIngresos = [{ fuente: 'mujer_sueldo', monto: perfil.ingresos_mensuales.mujer_sueldo, tipo: 'fijo' }, { fuente: 'mujer_extra', monto: perfil.ingresos_mensuales.mujer_extra, tipo: 'variable' }, { fuente: 'operador', monto: perfil.ingresos_mensuales.operador, tipo: 'variable' }]
  const gastosFijos = Object.values(perfil.gastos_fijos_mensuales).reduce((s, v) => s + v, 0)
  return { assets, total_activos: totalActivos, ingresos_pasivos: ingresosPasivos, asset_allocation: assetAllocation, income_sources: incomeSources, total_income_extra: totalIncome, income_breakdown: incomeBreakdown, perfil_ingresos: perfilIngresos, pasivos_mensuales: gastosFijos, net_worth: totalActivos - gastosFijos }
}
