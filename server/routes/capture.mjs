import { Router } from 'express'

const router = Router()

/**
 * POST /capture — Save a single note via DI use case
 * Contrato (SPEC api.test.js:195-220): body { content, source, entityType?, title?, ... }
 * → 200 { success: true, path }. title es opcional: se deriva del content.
 */
router.post('/capture', async (req, res) => {
  try {
    const body = req.body || {}
    const { content, title, tags, source, conceptos_clave, entityType, priority, energy, focus } = body

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' })
    }

    if (req.useCases && req.useCases.captureNote) {
      const result = await req.useCases.captureNote({
        title: title || content.trim().slice(0, 60),
        content,
        entityType,
        sourceUrl: source,
        tags,
        conceptos_clave,
        priority,
        energy,
        focus,
      })
      if (result.isFailure) {
        return res.status(result.error.statusCode || 500).json({ error: result.error.message })
      }
      return res.status(200).json({ success: true, path: result.value.filePath })
    }

    // Fallback: return error if DI not wired (should never happen)
    return res.status(503).json({ error: 'captureNote use case not available' })
  } catch (err) {
    console.error('[capture] Error:', err.message)
    return res.status(500).json({ error: 'Internal capture error' })
  }
})

/**
 * POST /capture/batch — Save multiple notes via DI use case
 */
router.post('/capture/batch', async (req, res) => {
  try {
    const { captures } = req.body || {}

    if (!Array.isArray(captures) || captures.length === 0) {
      return res.status(400).json({ error: 'captures array is required' })
    }

    if (req.useCases && req.useCases.captureNote) {
      const results = []
      for (const cap of captures) {
        const { content, title, tags, source, conceptos_clave, entityType, priority, energy, focus } = cap
        if (!content || !content.trim()) {
          results.push({ title: title || '(untitled)', status: 'skipped', reason: 'missing content' })
          continue
        }
        const result = await req.useCases.captureNote({
          title: title || content.trim().slice(0, 60),
          content,
          entityType,
          sourceUrl: source,
          tags,
          conceptos_clave,
          priority,
          energy,
          focus,
        })
        if (result.isFailure) {
          results.push({ title, status: 'failed', error: result.error.message })
        } else {
          results.push({ title, status: 'saved', ...result.value })
        }
      }
      return res.status(201).json({ results })
    }

    return res.status(503).json({ error: 'captureNote use case not available' })
  } catch (err) {
    console.error('[capture/batch] Error:', err.message)
    return res.status(500).json({ error: 'Internal batch capture error' })
  }
})

export default router
