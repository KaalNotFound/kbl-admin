import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

/**
 * Torre active-recall (ADR-025, 2026-08-04): router thin — toda la lógica
 * vive en req.useCases.activeRecall (store legacy inyectado por DI desde el
 * container). Ya no importa #infra/active-recall-store.js directo (violación
 * R1 resuelta).
 *
 * Nota: POST /active-recall/review usa activeRecall.submitReview (comporta-
 * miento legacy real). El antiguo path DI condicional hacia submitActiveRecallReview
 * (use-case de mastery) tenía contrato desalineado → 500 siempre con container;
 * se eliminó en la torre (bug fix documentado en el use-case).
 */

// POST /active-recall/review — { conceptHash, correct, timeSpentMs, mode }
router.post('/active-recall/review', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.submitReview(req.body || {})
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result.value)
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'POST', '/api/active-recall/review', e, 'Error al guardar la review'))
  }
})

// POST /active-recall/due — { limit?, moduleFilter? }
router.post('/active-recall/due', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.getDue(req.body || {})
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'POST', '/api/active-recall/due', e, 'Error al cargar preguntas pendientes'))
  }
})

// GET /active-recall/stats
router.get('/active-recall/stats', async (req, res) => {
  try {
    const stats = await req.useCases.activeRecall.getStats()
    res.json(stats)
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'GET', '/api/active-recall/stats', e, 'Error al cargar estadísticas'))
  }
})

export default router
