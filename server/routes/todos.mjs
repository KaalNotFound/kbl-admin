/**
 * Todos + Vault Metrics router — KBL_Admin visibility (TODO seq 1517)
 *
 * Re-capetizado Torre vault-helpers (ADR-025, 2026-08-04): thin router —
 * toda la lógica vive en application/use-cases/vault-todos.js (createTodosUseCases).
 * Exposes the vault SSOT (_PENDING.md) and real-time metrics (logs) to the
 * operator via the KBL_Admin dashboard, plus a Mermaid graph of the vault.
 */
import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// GET /api/todos — TODO list from SSOT (state machine + priority)
router.get('/todos', async (req, res) => {
  try {
    const result = await req.useCases.todos.getTodos()
    if (result.status) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('todos', 'GET', '/api/todos', e, 'Error al cargar TODOs'))
  }
})

// GET /api/todos/metrics — real-time vault metrics from logs
router.get('/todos/metrics', async (req, res) => {
  try {
    res.json(await req.useCases.todos.getMetrics())
  } catch (e) {
    res.status(500).json(logAndRespond('todos-metrics', 'GET', '/api/todos/metrics', e, 'Error al cargar métricas'))
  }
})

// GET /api/todos/graph — Mermaid graph of the vault (areas + orphan snapshot)
router.get('/todos/graph', async (req, res) => {
  try {
    res.json(await req.useCases.todos.getGraph())
  } catch (e) {
    res.status(500).json(logAndRespond('todos-graph', 'GET', '/api/todos/graph', e, 'Error al generar grafo'))
  }
})

export default router
