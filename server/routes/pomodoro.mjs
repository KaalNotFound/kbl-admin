import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'
import { createScopedRateLimiter } from '../middleware/security.mjs'

const router = Router()

// Control endpoints mutate server-side timer state; a scoped quota keeps
// misbehaving automation from churning unbounded state transitions
// (dashboard UI usage stays far below 30/min).
const controlLimiter = createScopedRateLimiter({ max: 30 })

router.get('/pomodoro/status', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.getStatus()
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'GET', '/api/pomodoro/status', e, 'Error al obtener estado del pomodoro')) }
})

router.post('/pomodoro/start', controlLimiter, async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.start(req.body)
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/start', e, 'Error al iniciar pomodoro')) }
})

router.post('/pomodoro/stop', controlLimiter, async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.stop()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/stop', e, 'Error al detener pomodoro')) }
})

router.post('/pomodoro/skip', controlLimiter, async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.skip()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/skip', e, 'Error al saltar fase')) }
})

router.post('/pomodoro/pause', controlLimiter, async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.pause()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/pause', e, 'Error al pausar pomodoro')) }
})

router.post('/pomodoro/resume', controlLimiter, async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.resume()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/resume', e, 'Error al reanudar pomodoro')) }
})

export default router
