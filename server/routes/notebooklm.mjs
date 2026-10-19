// --- NotebookLM Routes ---
// Proxy routes to notebooklm-mcp running on localhost:3000.
// Torre notebooklm (ADR-025): router thin — delega en req.useCases.notebooklm
// (use-cases vía DI), ya no importa lib/notebooklm-proxy.mjs directo.

import { Router } from 'express'
import { logAndRespond } from '../lib/error-handler.mjs'

const router = Router()

// --- Health check ---
router.get('/notebooklm/health', async (_req, res) => {
  try {
    const health = await _req.useCases.notebooklm.getHealth()
    res.json({ success: true, data: health })
  } catch (e) {
    res.status(503).json({ success: false, error: e.message })
  }
})

// --- Ask a question to NotebookLM ---
router.post('/notebooklm/ask', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.ask(req.body)
    if (result.status) return res.status(result.status).json({ success: false, error: result.error })
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'POST', '/api/notebooklm/ask', e, e.message))
  }
})

// --- List notebooks ---
router.get('/notebooklm/notebooks', async (_req, res) => {
  try {
    const result = await _req.useCases.notebooklm.listNotebooks()
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'GET', '/api/notebooklm/notebooks', e, e.message))
  }
})

// --- Create notebook ---
router.post('/notebooklm/notebooks', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.createNotebook(req.body)
    if (result.status) return res.status(result.status).json({ success: false, error: result.error })
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'POST', '/api/notebooklm/notebooks', e, e.message))
  }
})

// --- Create notebook directly in NotebookLM ---
router.post('/notebooklm/notebooks/create', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.createNotebookDirect(req.body)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'POST', '/api/notebooklm/notebooks/create', e, e.message))
  }
})

// --- Get notebook details ---
router.get('/notebooklm/notebooks/:id', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.getNotebook(req.params.id)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'GET', `/api/notebooklm/notebooks/${req.params.id}`, e, e.message))
  }
})

// --- Delete notebook ---
router.delete('/notebooklm/notebooks/:id', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.deleteNotebook(req.params.id)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'DELETE', `/api/notebooklm/notebooks/${req.params.id}`, e, e.message))
  }
})

// --- Activate notebook ---
router.put('/notebooklm/notebooks/:id/activate', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.activateNotebook(req.params.id)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'PUT', `/api/notebooklm/notebooks/${req.params.id}/activate`, e, e.message))
  }
})

// --- Search notebooks ---
router.get('/notebooklm/notebooks/search', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.searchNotebooks(req.query.query)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'GET', '/api/notebooklm/notebooks/search', e, e.message))
  }
})

// --- Library stats ---
router.get('/notebooklm/notebooks/stats', async (_req, res) => {
  try {
    const result = await _req.useCases.notebooklm.getNotebookStats()
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'GET', '/api/notebooklm/notebooks/stats', e, e.message))
  }
})

// --- Add source to notebook ---
router.post('/notebooklm/content/sources', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.addContentSource(req.body)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'POST', '/api/notebooklm/content/sources', e, e.message))
  }
})

// --- Generate content (audio, video, quiz, report) ---
router.post('/notebooklm/content/generate', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.generateContent(req.body)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'POST', '/api/notebooklm/content/generate', e, e.message))
  }
})

// --- List content in notebook ---
router.get('/notebooklm/content', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.listContent(req.query.notebook_url)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'GET', '/api/notebooklm/content', e, e.message))
  }
})

// --- Create note in notebook ---
router.post('/notebooklm/content/notes', async (req, res) => {
  try {
    const result = await req.useCases.notebooklm.createNote(req.body)
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'POST', '/api/notebooklm/content/notes', e, e.message))
  }
})

// --- List sessions ---
router.get('/notebooklm/sessions', async (_req, res) => {
  try {
    const result = await _req.useCases.notebooklm.listSessions()
    res.json(result)
  } catch (e) {
    res.status(500).json(logAndRespond('notebooklm', 'GET', '/api/notebooklm/sessions', e, e.message))
  }
})

export default router
