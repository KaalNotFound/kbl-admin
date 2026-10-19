// finanzas-busqueda.mjs — Búsqueda con historial + precios mercado, comparación de precios
// (Split ADR-024)
import { query } from './finanzas-db.mjs'
import { getAliasIndex, loadMercadoDb } from './finanzas-core.mjs'

// --- Search ---

export function searchItems(q, store) {
  const aliasIdx = getAliasIndex()
  function runSearch(searchTerm) {
    let sql = 'SELECT fecha, comercio, producto, cantidad, precio_total, categoria, archivo FROM items WHERE 1=1'
    const params = []
    if (searchTerm) {
      sql += ' AND (LOWER(producto) LIKE ? OR LOWER(categoria) LIKE ? OR LOWER(comercio) LIKE ?)'
      const like = `%${searchTerm}%`
      params.push(like, like, like)
    }
    if (store) { sql += ' AND comercio = ?'; params.push(store) }
    sql += ' ORDER BY fecha DESC'
    return query(sql, params)
  }
  let rows = runSearch(q)
  if (!rows.length && q && aliasIdx) {
    const canonical = aliasIdx[q]
    if (canonical && canonical.toLowerCase() !== q) rows = runSearch(canonical.toLowerCase())
  }
  const mercadoDb = loadMercadoDb()
  const results = rows.map(r => {
    const histRows = query(`SELECT fecha, precio_total FROM items WHERE producto = ? AND fecha < ? ORDER BY fecha DESC LIMIT 3`, [r[2], r[0]])
    const prodMercado = mercadoDb?.productos?.[r[2]]
    const mercadoPrices = {}
    if (prodMercado && mercadoDb) {
      for (const s of mercadoDb.stores) {
        if (s !== 'desconocido') mercadoPrices[s] = prodMercado.precios[s] || null
      }
    }
    return { fecha: r[0], comercio: r[1], producto: r[2], cantidad: r[3], precio_total: r[4], categoria: r[5], archivo: r[6], historial: histRows.map(h => ({ fecha: h[0], precio: h[1] })), precios_mercado: Object.keys(mercadoPrices).length > 0 ? mercadoPrices : null }
  })
  const storeRows = query(`SELECT DISTINCT comercio FROM items WHERE comercio != '' ORDER BY comercio`, [])
  const stores = storeRows.map(r => r[0])
  return { results, stores }
}

// --- Compare ---

export function compareItems(q) {
  const aliasIdx = getAliasIndex()
  let sql = `SELECT producto, precio_total, comercio, fecha, categoria FROM items WHERE LOWER(producto) LIKE ? ORDER BY producto, fecha DESC`
  let params = [`%${q}%`]
  let rows = query(sql, params)
  if (!rows.length && aliasIdx) {
    const canonical = aliasIdx[q]
    if (canonical && canonical.toLowerCase() !== q) rows = query(sql, [`%${canonical.toLowerCase()}%`])
  }
  if (!rows.length) return { query: q, comparison: [], stores: [], summary: null }
  const productMap = {}
  const storeSet = new Set()
  for (const r of rows) {
    storeSet.add(r[2])
    if (!productMap[r[0]]) productMap[r[0]] = []
    if (productMap[r[0]].length < 5) productMap[r[0]].push({ comercio: r[2], precio: r[1], fecha: r[3], categoria: r[4] })
  }
  const mercadoDb = loadMercadoDb()
  const comparison = Object.entries(productMap).map(([producto, precios]) => {
    const prices = precios.map(p => p.precio)
    const prodMercado = mercadoDb?.productos?.[producto]
    const mercadoPrices = {}
    if (prodMercado && mercadoDb) {
      for (const s of mercadoDb.stores) if (s !== 'desconocido') mercadoPrices[s] = prodMercado.precios[s] || null
    }
    return { producto, categoria: precios[0]?.categoria || '', precios, precios_mercado: Object.keys(mercadoPrices).length > 0 ? mercadoPrices : null, min_price: Math.min(...prices), max_price: Math.max(...prices), avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) }
  }).sort((a, b) => a.avg_price - b.avg_price)
  const allPrices = comparison.flatMap(c => c.precios.map(p => p.precio))
  const stores = [...storeSet].sort()
  return { query: q, comparison, stores, summary: { total_products: comparison.length, total_entries: allPrices.length, avg_price_all: Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length), min_price_all: Math.min(...allPrices), max_price_all: Math.max(...allPrices) } }
}
