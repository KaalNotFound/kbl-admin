import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/entity-types — scan vault for entity_type:: inline fields
router.get('/entity-types', async (req, res) => {
  try {
    res.json(await req.useCases.entityTypes.getEntityTypes())
  } catch (e) {
    res.status(500).json(logAndRespond('entity-types', 'GET', '/api/entity-types', e, 'Error al escanear tipos de entidad'))
  }
})

// GET /api/entity-catalog — reads ENTITY_CATALOG.json
router.get('/entity-catalog', async (req, res) => {
  try {
    res.json(await req.useCases.entityTypes.getEntityCatalog())
  } catch (e) {
    res.status(500).json(logAndRespond('entity-types', 'GET', '/api/entity-catalog', e, 'Error al leer catálogo de entidades'))
  }
})

export default router
