import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/projects — scan 01 - PROYECTOS/ (use-case vault-projects via DI)
router.get('/projects', async (req, res) => {
  try {
    const data = await req.useCases.projects.getProjects()
    res.json(data)
  } catch (e) {
    res.status(500).json(logAndRespond('projects', 'GET', '/api/projects', e, 'Error al escanear proyectos'))
  }
})

export default router
