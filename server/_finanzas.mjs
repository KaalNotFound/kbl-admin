// _finanzas.mjs — Thin router delegating to FinanzasUseCases via DI (Torre finanzas, ADR-025)
// Router → req.useCases.finanzas — NO imports de lib/ (boundary §2.1, excepción ca-boundary-debt SACA)
import { Router } from 'express'

const router = Router()

// --- /api/summary ---
router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    res.json(await req.useCases.finanzas.getSummary(month))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/insights ---
router.get('/insights', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7)
    res.json(await req.useCases.finanzas.getInsights(month))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/search ---
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim()
    const store = req.query.store || ''
    res.json(await req.useCases.finanzas.search(q, store))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/compare ---
router.get('/compare', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim()
    if (!q) return res.json({ query: '', comparison: [], stores: [], summary: null })
    res.json(await req.useCases.finanzas.compare(q))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/food-sora/stats ---
router.get('/food-sora/stats', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getFoodSoraStats())
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/food-sora ---
router.get('/food-sora', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getFoodSoraData())
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/finanzas (runway + mercado + presupuesto) ---
router.get('/finanzas', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getFinanzas())
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- /api/patrimonio ---
router.get('/patrimonio', async (req, res) => {
  try {
    res.json(await req.useCases.finanzas.getPatrimonio())
  } catch (e) { res.status(500).json({ error: e.message }) }
})

export default router
