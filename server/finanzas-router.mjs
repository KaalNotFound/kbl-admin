// finanzas-router.mjs — Thin router delegating to FinanzasUseCases via DI (Torre finanzas, ADR-025)
// Router → req.useCases.finanzas — NO imports de lib/ de dominio (boundary §2.1):
// el único helper de infra permitido es error-handler.mjs, igual que el resto
// de los routers (logAndRespond: log server-side + mensaje genérico al cliente).
import { Router } from 'express'
import { logAndRespond } from './lib/error-handler.mjs'

const router = Router()

// --- /api/summary ---
router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    res.json(await req.useCases.finanzas.getSummary(month))
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/summary', e, 'Error al obtener el resumen financiero')) }
})

// --- /api/insights ---
router.get('/insights', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    res.json(await req.useCases.finanzas.getInsights(month))
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/insights', e, 'Error al obtener insights')) }
})

// --- /api/search ---
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim()
    const store = req.query.store || ''
    res.json(await req.useCases.finanzas.search(q, store))
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/search', e, 'Error al buscar compras')) }
})

// --- /api/compare ---
router.get('/compare', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim()
    if (!q) return res.json({ query: '', comparison: [], stores: [], summary: null })
    res.json(await req.useCases.finanzas.compare(q))
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/compare', e, 'Error al comparar precios')) }
})

// --- /api/food-sora/stats ---
router.get('/food-sora/stats', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getFoodSoraStats())
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/food-sora/stats', e, 'Error al obtener estadísticas de FoodSora')) }
})

// --- /api/food-sora ---
router.get('/food-sora', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getFoodSoraData())
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/food-sora', e, 'Error al obtener datos FoodSora')) }
})

// --- /api/finanzas (runway + mercado + presupuesto) ---
router.get('/finanzas', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getFinanzas())
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/finanzas', e, 'Error al obtener finanzas')) }
})

// --- /api/patrimonio ---
router.get('/patrimonio', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getPatrimonio())
  } catch (e) { res.status(500).json(logAndRespond('finanzas', 'GET', '/api/patrimonio', e, 'Error al obtener patrimonio')) }
})

export default router
