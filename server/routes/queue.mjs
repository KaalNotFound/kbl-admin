/**
 * Queue routes — thin (Torre vault-helpers, ADR-025).
 * Lógica movida a application/use-cases/vault-queue.js (createQueueUseCases,
 * deps inyectadas por DI). Este router solo delega a req.useCases.queue.
 */
import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/queue — pending/done/failed files
router.get('/queue', async (req, res) => {
  try {
    const data = await req.useCases.queue.getQueue()
    res.json(data)
  } catch (e) {
    res.status(500).json(logAndRespond('queue', 'GET', '/api/queue', e, 'Error al cargar la cola de procesamiento'))
  }
})

// GET /api/seen — pipeline seen hashes
router.get('/seen', async (req, res) => {
  try {
    const data = await req.useCases.queue.getSeen()
    res.json(data)
  } catch (e) {
    res.status(500).json(logAndRespond('queue', 'GET', '/api/seen', e, 'Error al cargar hashes vistos'))
  }
})

export default router
