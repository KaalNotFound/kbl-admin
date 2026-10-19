import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/inventory — scan vault for entity_type:: inventory_item
router.get('/inventory', async (req, res) => {
  try {
    const data = await req.useCases.inventory.getInventory()
    res.json(data)
  } catch (e) {
    res.status(500).json(logAndRespond('inventory', 'GET', '/api/inventory', e, 'Error al escanear inventario'))
  }
})

// POST /api/inventory/item — create inventory note
router.post('/inventory/item', async (req, res) => {
  try {
    const result = await req.useCases.inventory.createItem(req.body)
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('inventory', 'POST', '/api/inventory/item', e, 'Error al crear item de inventario'))
  }
})

export default router
