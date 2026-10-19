import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/overview — system health, vault stats
router.get('/overview', async (req, res) => {
  try {
    res.json(await req.useCases.overview.getOverview())
  } catch (e) {
    res.status(500).json(logAndRespond('overview', 'GET', '/api/overview', e, 'Error al cargar datos del sistema'))
  }
})

// GET /api/health — uptime, memory, pipeline
router.get('/health', async (req, res) => {
  try {
    res.json(await req.useCases.overview.getHealth())
  } catch (e) {
    res.status(500).json(logAndRespond('overview', 'GET', '/api/health', e, 'Error al obtener health del sistema'))
  }
})

export default router
