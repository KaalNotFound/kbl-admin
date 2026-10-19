import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

router.get('/pomodoro/status', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.getStatus()
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'GET', '/api/pomodoro/status', e, 'Error al obtener estado del pomodoro')) }
})

router.post('/pomodoro/start', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.start(req.body)
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/start', e, 'Error al iniciar pomodoro')) }
})

router.post('/pomodoro/stop', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.stop()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/stop', e, 'Error al detener pomodoro')) }
})

router.post('/pomodoro/skip', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.skip()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/skip', e, 'Error al saltar fase')) }
})

router.post('/pomodoro/pause', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.pause()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/pause', e, 'Error al pausar pomodoro')) }
})

router.post('/pomodoro/resume', async (req, res) => {
  try {
    const result = await req.useCases.pomodoro.resume()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) { res.status(500).json(logAndRespond('pomodoro', 'POST', '/api/pomodoro/resume', e, 'Error al reanudar pomodoro')) }
})

export default router
