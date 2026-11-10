import { Router } from 'express'
import { logAndRespond, throttledErrorLog } from '../lib/error-handler.mjs'
import { createScopedRateLimiter } from '../middleware/security.mjs'

const router = Router()

// Vault writes are state-creating; the batch path multiplies writes by the
// batch payload. Scoped quotas cap runaway automation (real usage: single
// manual captures and small batches, far below these ceilings).
const captureLimiter = createScopedRateLimiter({ max: 20 })
const captureBatchLimiter = createScopedRateLimiter({ max: 5 })

export const MAX_BATCH_SIZE = 100

/**
 * Route-level guard for POST /capture/batch. Kept as a pure helper so the cap
 * can be unit-tested without wiring the DI container.
 */
export function assertBatchSize(body) {
  const captures = body && body.captures
  if (Array.isArray(captures) && captures.length > MAX_BATCH_SIZE) {
    return { ok: false, error: 'Máximo 100 capturas por lote.' }
  }
  return { ok: true }
}

/**
 * POST /capture — Save a single note via DI use case
 * Contrato (SPEC api.test.js:195-220): body { content, source, entityType?, title?, ... }
 * → 200 { success: true, path, obsidian_url }. title es opcional: se deriva del content.
 *
 * Phase 3 capture triage: body gains optional `fields` (structured per-type
 * data, e.g. compra {comercio, precio_total, categoria}, food {slot, hora})
 * and `date` (YYYY-MM-DD). Validation failures of the triage (missing
 * comercio/producto, bad slot) come back as 400 with a clear message.
 */
router.post('/capture', captureLimiter, async (req, res) => {
  try {
    const body = req.body || {}
    const { content, title, tags, source, conceptos_clave, entityType, priority, energy, focus, fields, date } = body

    // Route-level guard: with no structured fields the legacy content
    // requirement holds (existing api.test contract). When structured
    // fields ARE present the use case owns validation (400 on bad triage).
    const hasFields = fields && typeof fields === 'object' && Object.keys(fields).length > 0
    if (!hasFields && (!content || !content.trim())) {
      return res.status(400).json({ error: 'content is required' })
    }

    if (req.useCases && req.useCases.captureNote) {
      const result = await req.useCases.captureNote({
        title: title || (content || '').trim().slice(0, 60),
        content,
        entityType,
        sourceUrl: source,
        tags,
        conceptos_clave,
        priority,
        energy,
        focus,
        fields,
        date,
      })
      if (result.isFailure) {
        const error = result.error
        const status = error.statusCode
          || (error.code === 'VALIDATION_ERROR' ? 400 : 500)
        // Validation-class failures carry curated UX copy (HTTP contract:
        // capture-triage.test.js asserts it) and never raw exception
        // internals, so they pass through. 5xx details stay server-side.
        const userMessage = status < 500 ? error.message : undefined
        return res.status(status).json(logAndRespond('capture', 'POST', '/capture', error, userMessage))
      }
      return res.status(200).json({
        success: true,
        path: result.value.filePath,
        obsidian_url: result.value.obsidianUrl || null,
      })
    }

    // Fallback: return error if DI not wired (should never happen)
    return res.status(503).json({ error: 'captureNote use case not available' })
  } catch (err) {
    console.error('[capture] Error:', err.message)
    return res.status(500).json({ error: 'Internal capture error' })
  }
})

/**
 * POST /capture/batch — Save multiple notes via DI use case.
 * Phase 3: each item supports the same triage (fields/date passthrough).
 */
router.post('/capture/batch', captureBatchLimiter, async (req, res) => {
  try {
    const { captures } = req.body || {}

    const size = assertBatchSize(req.body || {})
    if (!size.ok) {
      return res.status(400).json({ error: size.error })
    }

    if (!Array.isArray(captures) || captures.length === 0) {
      return res.status(400).json({ error: 'captures array is required' })
    }

    if (req.useCases && req.useCases.captureNote) {
      const results = []
      for (const cap of captures) {
        const { content, title, tags, source, conceptos_clave, entityType, priority, energy, focus, fields, date } = cap
        if (!fields && (!content || !content.trim())) {
          results.push({ title: title || '(untitled)', status: 'skipped', reason: 'missing content' })
          continue
        }
        const result = await req.useCases.captureNote({
          title: title || (content || '').trim().slice(0, 60),
          content,
          entityType,
          sourceUrl: source,
          tags,
          conceptos_clave,
          priority,
          energy,
          focus,
          fields,
          date,
        })
        if (result.isFailure) {
          throttledErrorLog('capture', 'POST', '/capture/batch', result.error)
          // Sanitized: the raw use-case message stays server-side only.
          results.push({ title, status: 'failed', error: 'No se pudo guardar la captura.' })
        } else {
          results.push({
            title,
            status: 'saved',
            path: result.value.filePath,
            obsidian_url: result.value.obsidianUrl || null,
          })
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
