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

// ------------------------------------------------------------------
// HTTP surface consumed by src/api/active-recall.ts — restored after the
// ADR-025 refactor dropped it (every Active Recall panel 404'd).
// ------------------------------------------------------------------

// GET /active-recall/all → { questions: ActiveRecallDueItem[] }
router.get('/active-recall/all', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.getAll()
    res.json(result.value)
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'GET', '/api/active-recall/all', e, 'Error al cargar preguntas'))
  }
})

// GET /active-recall/due → ActiveRecallDueResponse { questions, stats }
router.get('/active-recall/due', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.getDueWithStats(req.query || {})
    res.json(result.value)
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'GET', '/api/active-recall/due', e, 'Error al cargar preguntas pendientes'))
  }
})

// GET /active-recall/question/:id → ActiveRecallQuestion | 404
router.get('/active-recall/question/:id', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.getQuestionById(req.params.id)
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result.value)
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'GET', '/api/active-recall/question/:id', e, 'Error al cargar la pregunta'))
  }
})

// POST /active-recall/submit → ActiveRecallSubmitResponse
router.post('/active-recall/submit', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.submit(req.body || {})
    if (result.status) return res.status(result.status).json({ success: false, error: result.error })
    res.json({ success: true, ...result.value })
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'POST', '/api/active-recall/submit', e, 'Error al guardar la respuesta'))
  }
})

// POST /active-recall/ingest → { success, imported, stats }
router.post('/active-recall/ingest', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.ingest(req.body?.dir)
    const stats = await req.useCases.activeRecall.getStats()
    res.json({ success: true, imported: result.value, stats })
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'POST', '/api/active-recall/ingest', e, 'Error al importar desde el vault'))
  }
})

// POST /active-recall/inject → { success, seeded, stats }
router.post('/active-recall/inject', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.inject(req.body || {})
    if (result.status) return res.status(result.status).json({ success: false, error: result.error })
    const stats = await req.useCases.activeRecall.getStats()
    res.json({ success: true, seeded: result.value.seeded, stats })
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'POST', '/api/active-recall/inject', e, 'Error al inyectar la pregunta'))
  }
})

// POST /active-recall/seed → { success, seeded, stats }
router.post('/active-recall/seed', async (req, res) => {
  try {
    const result = await req.useCases.activeRecall.seed(req.body || {})
    if (result.status) return res.status(result.status).json({ success: false, error: result.error })
    const stats = await req.useCases.activeRecall.getStats()
    res.json({ success: true, seeded: result.value.seeded, stats })
  } catch (e) {
    res.status(500).json(logAndRespond('active-recall', 'POST', '/api/active-recall/seed', e, 'Error al sembrar preguntas'))
  }
})

export default router
