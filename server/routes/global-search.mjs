import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

// Global Search router (TopBar palette, "Buscar... Ctrl+K").
// Thin: all logic lives in req.useCases.globalSearch (DI-wired).
const router = Router()

// GET /api/global-search?q=...
router.get('/global-search', async (req, res) => {
  try {
    res.json(await req.useCases.globalSearch.search(req.query.q))
  } catch (e) {
    res.status(500).json(logAndRespond('global-search', 'GET', '/api/global-search', e, 'Error en la búsqueda global'))
  }
})

export default router
