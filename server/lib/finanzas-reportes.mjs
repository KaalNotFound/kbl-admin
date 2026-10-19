// finanzas-reportes.mjs — Resumen mensual + insights (gastos hormiga, recurrencias, top, preocupaciones)
// (Split ADR-024)
import { query } from './finanzas-db.mjs'

// --- Summary calculation ---

export function calculateSummary(month) {
  const like = `${month}%`
  const totalRow = query(`SELECT COALESCE(SUM(precio_total), 0), COUNT(DISTINCT fecha || comercio), COUNT(*) FROM items WHERE fecha LIKE ?`, [like])
  const total = totalRow[0]?.[0] || 0
  const tickets = totalRow[0]?.[1] || 0
  const items = totalRow[0]?.[2] || 0
  const prevMonth = `${+month.slice(0, 4)}-${String(+month.slice(5) - 1 || 12).padStart(2, '0')}`
  const prevRow = query(`SELECT COALESCE(SUM(precio_total), 0) FROM items WHERE fecha LIKE ?`, [`${prevMonth}%`])
  const prevTotal = prevRow[0]?.[0] || 0
  const catRows = query(`SELECT categoria, SUM(precio_total), ROUND(CAST(SUM(precio_total) AS REAL) / ? * 100, 1) FROM items WHERE fecha LIKE ? AND categoria != '' GROUP BY categoria ORDER BY SUM(precio_total) DESC LIMIT 8`, [total || 1, like])
  const topCategories = catRows.map(r => ({ name: r[0], total: r[1], percent: r[2] }))
  const dailyRows = query(`SELECT fecha, SUM(precio_total) FROM items WHERE fecha LIKE ? GROUP BY fecha ORDER BY fecha`, [like])
  const dailySpending = dailyRows.map(r => ({ fecha: r[0], total: r[1] }))
  const storeRows = query(`SELECT comercio, SUM(precio_total), COUNT(DISTINCT fecha) FROM items WHERE fecha LIKE ? AND comercio != '' GROUP BY comercio ORDER BY SUM(precio_total) DESC`, [like])
  const storeStats = storeRows.map(r => ({ name: r[0], total: r[1], visits: r[2] }))
  const daysInMonth = new Date(+month.slice(0, 4), +month.slice(5), 0).getDate()
  const dailyAvg = daysInMonth > 0 ? Math.round(total / daysInMonth) : 0
  return { month, total, tickets, items, daily_avg: dailyAvg, last_month_total: prevTotal, change_percent: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null, top_categories: topCategories, daily_spending: dailySpending, store_stats: storeStats }
}

// --- Insights calculation ---

export function calculateInsights(month) {
  const like = `${month}%`
  const hormigaRows = query(`SELECT producto, COUNT(*), SUM(precio_total), ROUND(AVG(precio_total), 0) FROM items WHERE fecha LIKE ? GROUP BY producto HAVING COUNT(*) >= 2 AND AVG(precio_total) <= 300 ORDER BY COUNT(*) DESC LIMIT 10`, [like])
  const hormiga = hormigaRows.map(r => ({ producto: r[0], veces: r[1], total_mes: r[2], ahorro_anual: (r[2] || 0) * 12 }))
  const recurrenciasRows = query(`SELECT producto, categoria, COUNT(DISTINCT strftime('%W', fecha)) FROM items WHERE fecha LIKE ? GROUP BY producto HAVING COUNT(DISTINCT strftime('%W', fecha)) >= 2 ORDER BY COUNT(DISTINCT strftime('%W', fecha)) DESC LIMIT 10`, [like])
  const recurrencias = recurrenciasRows.map(r => ({ producto: r[0], categoria: r[1], frecuencia: `~${r[2]} semanas` }))
  const topRows = query(`SELECT producto, precio_total, comercio, fecha FROM items WHERE fecha LIKE ? ORDER BY precio_total DESC LIMIT 5`, [like])
  const topExpensive = topRows.map(r => ({ producto: r[0], precio: r[1], comercio: r[2], fecha: r[3] }))
  const preocupaciones = []
  const topCat = query(`SELECT categoria, SUM(precio_total) FROM items WHERE fecha LIKE ? AND categoria != '' GROUP BY categoria ORDER BY SUM(precio_total) DESC LIMIT 1`, [like])
  if (topCat.length) preocupaciones.push(`Esta categoría lidera tu gasto del mes: ${topCat[0][0]} ($${topCat[0][1]})`)
  if (hormiga.length) {
    const hormigaTotal = hormiga.reduce((s, h) => s + h.total_mes, 0)
    preocupaciones.push(`Tus gastos hormiga suman $${hormigaTotal}/mes — $${hormigaTotal * 12}/año. Pequeños, pero pesan.`)
  }
  const topProd = query(`SELECT producto, COUNT(*) FROM items WHERE fecha LIKE ? GROUP BY producto ORDER BY COUNT(*) DESC LIMIT 1`, [like])
  if (topProd.length && topProd[0][1] >= 3) {
    preocupaciones.push(`"${topProd[0][0]}" lidera en frecuencia: ${topProd[0][1]} veces en el mes.`)
  }
  return { hormiga, recurrencias, price_changes: [], top_expensive: topExpensive, preocupaciones }
}
