// finanzas-runway.mjs — Runway financiero, reconciliación, gastos por categoría, mercado (ahorro/sobreprecio)
// (Split ADR-024)
import fs from 'fs'
import { query } from './finanzas-db.mjs'
import { getPerfil, parseBudget, loadMercadoDb, readPresupuestoState } from './finanzas-core.mjs'

// --- Finanzas (runway + mercado + presupuesto) ---
// presupuesto-state.json is read through the guarded core reader: corrupt
// JSON or non-numeric saldo degrades to null and the calculation falls
// back to perfil defaults instead of cascading NaN (Phase 0 hardening).

export function calculateFinanzas() {
  const perfil = getPerfil()
  const state = readPresupuestoState()
  let saldo = perfil.saldo_default || 0
  if (state) saldo = state.saldo
  const gastosFijos = Object.values(perfil.gastos_fijos_mensuales).reduce((s, v) => s + v, 0)
  const ingresos = Object.values(perfil.ingresos_mensuales).reduce((s, v) => s + v, 0)
  const tresMesesAtras = new Date()
  tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3)
  const fechaCorte = tresMesesAtras.toISOString().slice(0, 10)
  const varRows = query(`SELECT SUM(precio_total), COUNT(*) FROM items WHERE fecha >= ?`, [fechaCorte])
  const varTotal = varRows[0]?.[0] || 0
  const varCount = varRows[0]?.[1] || 0
  const gastoVariableMensual = Math.round(varTotal / 3)
  const gastoTotalMensual = gastosFijos + gastoVariableMensual
  const flujoNeto = ingresos - gastoTotalMensual
  let runway = { meses: '∞', dias: '∞', fecha_fin: null }
  if (flujoNeto < 0) {
    const deficitMensual = Math.abs(flujoNeto)
    const meses = saldo / deficitMensual
    const fechaFin = new Date(Date.now() + meses * 30 * 86400000)
    runway = { meses: Math.round(meses * 10) / 10, dias: Math.round(meses * 30), fecha_fin: fechaFin.toISOString().slice(0, 10) }
  }
  let reconciliacion = null
  if (state) {
    const saldoActual = state.saldo
    const saldoAnterior = Number.isFinite(Number(state.saldo_anterior)) ? Number(state.saldo_anterior) : saldoActual
    const fechaAnteriorOk = state.fecha_saldo && !Number.isNaN(new Date(state.fecha_saldo).getTime())
    const fechaAnterior = fechaAnteriorOk ? state.fecha_saldo : new Date().toISOString().slice(0, 10)
    const gastoRows = query(`SELECT COALESCE(SUM(precio_total), 0) FROM items WHERE fecha >= ?`, [fechaAnterior])
    const gastosRegistrados = gastoRows[0]?.[0] || 0
    const diasDesde = Math.max(1, Math.floor((Date.now() - new Date(fechaAnterior).getTime()) / 86400000))
    const ingresosEstimados = Math.round(ingresos * (diasDesde / 30))
    const esperado = saldoAnterior + ingresosEstimados - gastosRegistrados
    const diferencial = esperado - saldoActual
    reconciliacion = { saldo_anterior: saldoAnterior, saldo_actual: saldoActual, esperado, diferencial: Math.abs(diferencial), gastos_registrados: gastosRegistrados, ingresos_estimados: ingresosEstimados, desde_fecha: fechaAnterior, tiene_diferencial: Math.abs(diferencial) > 100, interpretacion: diferencial > 0 ? `Gastaste ~$${Math.abs(diferencial)} sin registrar desde ${fechaAnterior}` : diferencial < 0 ? `Tenes ~$${Math.abs(diferencial)} extra no registrados` : 'Saldo reconciliado' }
  }
  const catRows = query(`SELECT categoria, SUM(precio_total), COUNT(*) FROM items WHERE fecha >= ? AND categoria != '' GROUP BY categoria ORDER BY SUM(precio_total) DESC`, [fechaCorte])
  const gastosPorCategoria = catRows.map(r => ({ categoria: r[0], total: r[1], items: r[2] }))
  let mercadoData = null
  const dbMercado = loadMercadoDb()
  if (dbMercado) mercadoData = calculateMercadoData(fechaCorte, dbMercado)
  return { saldo, reconciliacion, ingresos, gastos_fijos: gastosFijos, gasto_variable_mensual: gastoVariableMensual, gasto_total_mensual: gastoTotalMensual, flujo_neto: flujoNeto, deficit: flujoNeto < 0, runway, gastos_por_categoria: gastosPorCategoria, items_variables: varCount, mercado: mercadoData, presupuesto: parseBudget(), version: '1.1.0' }
}

function calculateMercadoData(fechaCorte, dbMercado) {
  const purchaseRows = query(`SELECT producto, precio_total, comercio, fecha FROM items WHERE fecha >= ? ORDER BY fecha DESC`, [fechaCorte])
  let ahorroTotal = 0
  const detalles = []
  for (const p of purchaseRows) {
    const prod = dbMercado.productos?.[p[0]]
    if (!prod) continue
    const precios = Object.entries(prod.precios).filter(([s, v]) => v !== null && s !== p[2])
    if (precios.length === 0) continue
    const mejorMercado = Math.min(...precios.map(([_, v]) => v))
    const diff = p[1] - mejorMercado
    if (diff !== 0) {
      ahorroTotal += diff < 0 ? Math.abs(diff) : -diff
      detalles.push({ producto: p[0], pagado: p[1], mejor_mercado: mejorMercado, tienda_mejor: diff < 0 ? p[2] : precios.find(([_, v]) => v === mejorMercado)?.[0], tienda_compra: p[2], tipo: diff < 0 ? 'ahorro' : 'sobreprecio', diferencia: Math.abs(diff) })
    }
  }
  const uniqueProducts = {}
  for (const p of purchaseRows) {
    if (!uniqueProducts[p[0]]) uniqueProducts[p[0]] = { producto: p[0], ultimo_precio: p[1], ultimo_comercio: p[2], ultima_fecha: p[3], categoria: '' }
  }
  const tablaComparativa = Object.values(uniqueProducts).map(up => {
    const prod = dbMercado.productos?.[up.producto]
    const preciosMercado = {}
    up.categoria = prod?.categoria || ''
    for (const store of dbMercado.stores) {
      if (store === 'desconocido') continue
      preciosMercado[store] = prod?.precios?.[store] ?? null
    }
    const preciosValidos = Object.values(preciosMercado).filter(v => v !== null)
    const mejorMercado = preciosValidos.length > 0 ? Math.min(...preciosValidos) : null
    const diff = mejorMercado !== null ? up.ultimo_precio - mejorMercado : null
    return { producto: up.producto, categoria: up.categoria, ultimo_precio: up.ultimo_precio, ultimo_comercio: up.ultimo_comercio, ultima_fecha: up.ultima_fecha, precios_mercado: preciosMercado, mejor_precio: mejorMercado, diferencia: diff, tipo: diff !== null ? (diff <= 0 ? 'ahorro' : 'sobreprecio') : null }
  }).sort((a, b) => { if (a.tipo === 'sobreprecio' && b.tipo !== 'sobreprecio') return -1; if (a.tipo !== 'sobreprecio' && b.tipo === 'sobreprecio') return 1; return Math.abs(b.diferencia || 0) - Math.abs(a.diferencia || 0) })
  return { total_productos: Object.keys(dbMercado.productos).length, productos_con_precio: Object.values(dbMercado.productos).filter(p => Object.values(p.precios).some(v => v !== null)).length, ahorro_total: ahorroTotal, detalles: detalles.slice(0, 10), tabla_comparativa: tablaComparativa, mercados_disponibles: dbMercado.stores.filter(s => s !== 'desconocido'), ultima_actualizacion: dbMercado.ultima_actualizacion }
}
