// behavioral.mjs — Thin routes delegating to the behavioral use-case (Torre ADR-025).
// El router NO importa lib/ (violación R1 ca-boundaries resuelta): la lógica
// vive en application/use-cases/behavioral.js, inyectada vía req.useCases.
import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// POST /api/behavioral/session/start
router.post('/behavioral/session/start', (req, res) => {
  try {
    res.json({ success: true, ...req.useCases.behavioral.startSession() })
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'POST', '/behavioral/session/start', e, 'Error al iniciar sesión'))
  }
})

// POST /api/behavioral/session/end
router.post('/behavioral/session/end', (req, res) => {
  try {
    const { session_id } = req.body
    if (!session_id) return res.status(400).json({ success: false, error: 'Falta session_id' })
    const result = req.useCases.behavioral.endSession(session_id)
    if (!result) return res.status(404).json({ success: false, error: 'Sesión no encontrada o ya cerrada' })
    res.json({ success: true, ...result })
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'POST', '/behavioral/session/end', e, 'Error al cerrar sesión'))
  }
})

// POST /api/behavioral/activity
router.post('/behavioral/activity', (req, res) => {
  try {
    const { session_id, type, target, tool_calls } = req.body
    if (!session_id) return res.status(400).json({ success: false, error: 'Falta session_id' })
    const result = req.useCases.behavioral.logActivity(session_id, { type, target, tool_calls })
    if (!result) return res.status(404).json({ success: false, error: 'Sesión no encontrada o ya cerrada' })
    res.json({ success: true, ...result })
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'POST', '/behavioral/activity', e, 'Error al registrar actividad'))
  }
})

// GET /api/behavioral/summary/daily?date=YYYY-MM-DD
router.get('/behavioral/summary/daily', (req, res) => {
  try {
    res.json(req.useCases.behavioral.getDailySummary(req.query.date))
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'GET', '/behavioral/summary/daily', e, 'Error al obtener resumen diario'))
  }
})

// GET /api/behavioral/summary/weekly
router.get('/behavioral/summary/weekly', (req, res) => {
  try {
    res.json(req.useCases.behavioral.getWeeklySummary())
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'GET', '/behavioral/summary/weekly', e, 'Error al obtener resumen semanal'))
  }
})

// GET /api/behavioral/blocks?date=YYYY-MM-DD
router.get('/behavioral/blocks', (req, res) => {
  try {
    res.json(req.useCases.behavioral.getBlockAdherence(req.query.date))
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'GET', '/behavioral/blocks', e, 'Error al obtener adherencia de bloques'))
  }
})

// GET /api/behavioral/streaks
router.get('/behavioral/streaks', (req, res) => {
  try {
    res.json(req.useCases.behavioral.getStreaks())
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'GET', '/behavioral/streaks', e, 'Error al obtener rachas'))
  }
})

// GET /api/behavioral/timeline?date=YYYY-MM-DD
router.get('/behavioral/timeline', (req, res) => {
  try {
    res.json(req.useCases.behavioral.getTimeline(req.query.date))
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'GET', '/behavioral/timeline', e, 'Error al obtener timeline'))
  }
})

// GET /api/behavioral/current-block
router.get('/behavioral/current-block', (req, res) => {
  try {
    const block = req.useCases.behavioral.getCurrentBlock()
    res.json({ block, hour: new Date().getHours() })
  } catch (e) {
    res.status(500).json(logAndRespond('behavioral', 'GET', '/behavioral/current-block', e, 'Error al obtener bloque actual'))
  }
})

export default router
