import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/logs — session logs, thermal logs, capture logs
router.get('/logs', async (req, res) => {
  try {
    const data = await req.useCases.context.getLogs()
    res.json(data)
  } catch (e) {
    res.status(500).json(logAndRespond('context', 'GET', '/api/logs', e, 'Error al cargar logs'))
  }
})

// GET /api/context — pendientes + roadmap + checkpoints
router.get('/context', async (req, res) => {
  try {
    const data = await req.useCases.context.getContext()
    res.json(data)
  } catch (e) {
    res.status(500).json(logAndRespond('context', 'GET', '/api/context', e, 'Error al cargar contexto del sistema'))
  }
})

export default router
