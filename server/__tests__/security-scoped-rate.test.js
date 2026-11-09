/**
 * Per-route quotas for LLM and vault-scan endpoints (LLM04 / resource abuse).
 *
 * Issue KaalNotFound/kbl-admin#3: the global limiter (500/min) is generous
 * enough for dashboard polling but too generous for expensive NLM proxy
 * calls, recursive vault ingest scans and the full vault-doctor scan. These
 * tests pin the scoped limiter behavior, the free-text size caps, and the
 * actual limiter wiring on the live routers.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createScopedRateLimiter } from '../middleware/security.mjs'
import { guardQuestion, guardTextField } from '../lib/nlm-guard.mjs'
import activeRecallRouter from '../routes/active-recall.mjs'
import vaultDoctorRouter from '../routes/vault-doctor.mjs'

const QUOTA_MESSAGE = 'Demasiadas solicitudes a este endpoint. Intentá de nuevo en un instante.'
const QUESTION_MESSAGE = 'La pregunta excede el máximo de 8000 caracteres.'

describe('createScopedRateLimiter', () => {
  it('returns 429 with the Spanish message and standard headers after max hits', async () => {
    const app = express()
    app.use(express.json())
    app.post('/hit', createScopedRateLimiter({ windowMs: 1000, max: 2, message: QUOTA_MESSAGE }), (_req, res) => res.json({ ok: true }))

    expect((await request(app).post('/hit')).status).toBe(200)
    expect((await request(app).post('/hit')).status).toBe(200)
    const third = await request(app).post('/hit')
    expect(third.status).toBe(429)
    expect(third.body.error).toBe(QUOTA_MESSAGE)
    // standardHeaders: true → draft-6 RateLimit-* (X-RateLimit-* are legacy).
    expect(third.headers['ratelimit-limit']).toBe('2')
    expect(third.headers['ratelimit-remaining']).toBe('0')
    expect(third.headers['retry-after']).toBeDefined()
  })
})

describe('free-text size guards (nlm-guard)', () => {
  it('accepts questions up to 8000 chars and rejects anything bigger or non-string', () => {
    expect(guardQuestion({ question: 'x'.repeat(8000) })).toBeNull()
    const rejected = guardQuestion({ question: 'x'.repeat(8001) })
    expect(rejected.status).toBe(400)
    expect(rejected.error).toBe(QUESTION_MESSAGE)
    expect(guardQuestion({ question: 42 }).status).toBe(400)
  })

  it('guards optional free-text fields (name, prompt) without touching missing ones', () => {
    expect(guardTextField({}, 'name', 'msg')).toBeNull()
    const rejected = guardTextField({ prompt: 'y'.repeat(8001) }, 'prompt', 'msg')
    expect(rejected.status).toBe(400)
    expect(rejected.error).toBe('msg')
  })
})

describe('scoped limiter wiring on the live routers', () => {
  // The quota stores are module-scoped (one limiter per router instance);
  // re-import the router per test so each starts with a clean store.
  let notebooklmRouter
  beforeEach(async () => {
    vi.resetModules()
    notebooklmRouter = (await import('../routes/notebooklm.mjs')).default
  })

  function buildNlmApp() {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
      req.useCases = { notebooklm: { ask: async () => ({ success: true }) } }
      next()
    })
    app.use(notebooklmRouter)
    return app
  }

  it('rejects /ask with an oversized question through the real router', async () => {
    const res = await request(buildNlmApp())
      .post('/notebooklm/ask')
      .send({ question: 'z'.repeat(8001) })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe(QUESTION_MESSAGE)
  })

  it('applies the /ask quota on the real router (21st call within a minute → 429)', async () => {
    const app = buildNlmApp()
    for (let i = 0; i < 20; i += 1) {
      const ok = await request(app).post('/notebooklm/ask').send({ question: 'hola' })
      expect(ok.status).toBe(200)
    }
    const last = await request(app).post('/notebooklm/ask').send({ question: 'hola' })
    expect(last.status).toBe(429)
    expect(last.body.error).toBe(QUOTA_MESSAGE)
  })

  it('mounts a limiter before the handler on every expensive route', () => {
    const expensive = [
      [notebooklmRouter, 'post', '/notebooklm/notebooks/create'],
      [notebooklmRouter, 'post', '/notebooklm/content/generate'],
      [activeRecallRouter, 'post', '/active-recall/ingest'],
      [vaultDoctorRouter, 'get', '/vault-doctor'],
    ]
    for (const [router, method, routePath] of expensive) {
      const layer = router.stack.find(
        (l) => l.route && l.route.path === routePath && l.route.methods[method],
      )
      expect(layer, `${method.toUpperCase()} ${routePath} registered`).toBeDefined()
      expect(layer.route.stack.length, `${routePath} has limiter before handler`).toBeGreaterThan(1)
    }
  })
})
