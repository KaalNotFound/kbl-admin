/**
 * Security perimeter hardening (TDD)
 *
 * Issue KaalNotFound/kbl-admin#3, slice 1: fail-closed public bind, read-only
 * demo mode, constant-time auth, rate limit before auth, same-origin CORS and
 * CSP enabled.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import {
  createSecurityMiddleware,
  createDemoModeMiddleware,
  assertSafeBind,
} from '../middleware/security.mjs'

function buildApp({ security = {}, demoMode = false } = {}) {
  const app = express()
  app.use(...createSecurityMiddleware(security))
  app.use(express.json())
  app.use(createDemoModeMiddleware({ demoMode }))
  app.get('/api/x', (req, res) => res.json({ ok: true }))
  app.post('/api/x', (req, res) => res.json({ ok: true }))
  return app
}

let warnSpy
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => warnSpy.mockRestore())

describe('API key auth', () => {
  it('rejects a request without the header and accepts the correct one', async () => {
    const app = buildApp({ security: { apiKey: 'secret' } })

    const denied = await request(app).get('/api/x')
    expect(denied.status).toBe(401)
    expect(denied.body.error).toContain('API key')

    const allowed = await request(app).get('/api/x').set('x-api-key', 'secret')
    expect(allowed.status).toBe(200)
  })

  it('no longer accepts the key as a query parameter', async () => {
    const app = buildApp({ security: { apiKey: 'secret' } })
    const res = await request(app).get('/api/x?api_key=secret')
    expect(res.status).toBe(401)
  })

  it('rejects same-length and different-length wrong keys without crashing', async () => {
    const app = buildApp({ security: { apiKey: 'secret' } })

    const sameLength = await request(app).get('/api/x').set('x-api-key', 'xxxxxx')
    expect(sameLength.status).toBe(401)

    const differentLength = await request(app).get('/api/x').set('x-api-key', 'wrong')
    expect(differentLength.status).toBe(401)
  })

  it('rate limits before auth, so repeated bad keys eventually return 429', async () => {
    const app = buildApp({
      security: { apiKey: 'secret', rateLimitMax: 2, rateLimitWindowMs: 60_000 },
    })

    expect((await request(app).get('/api/x').set('x-api-key', 'bad')).status).toBe(401)
    expect((await request(app).get('/api/x').set('x-api-key', 'bad')).status).toBe(401)
    expect((await request(app).get('/api/x').set('x-api-key', 'bad')).status).toBe(429)
  })
})

describe('demo read-only mode', () => {
  it('allows reads and blocks writes under /api when enabled', async () => {
    const app = buildApp({ demoMode: true })

    expect((await request(app).get('/api/x')).status).toBe(200)

    const blocked = await request(app).post('/api/x')
    expect(blocked.status).toBe(403)
    expect(blocked.body.error).toBe('Demo pública: modo solo lectura.')
  })

  it('passes writes through when disabled', async () => {
    const app = buildApp({ demoMode: false })
    expect((await request(app).post('/api/x')).status).toBe(200)
  })
})

describe('CORS defaults', () => {
  it('does not emit a wildcard origin by default', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/x')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('echoes a configured matching origin and never a wildcard', async () => {
    const app = buildApp({
      security: { corsOrigins: 'http://localhost:5177' },
    })
    const res = await request(app)
      .get('/api/x')
      .set('Origin', 'http://localhost:5177')

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5177')
    expect(res.headers['access-control-allow-origin']).not.toBe('*')
  })
})

describe('content security policy', () => {
  it('is enabled with self-only defaults and no framing', async () => {
    const app = buildApp()
    const res = await request(app).get('/api/x')
    const csp = res.headers['content-security-policy']

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })
})

describe('assertSafeBind', () => {
  it('throws on a public bind with no key and no demo mode', () => {
    expect(() =>
      assertSafeBind({ host: '0.0.0.0', apiKey: '', demoMode: false }),
    ).toThrow(/API_KEY/)
  })

  it('allows loopback binds', () => {
    expect(() =>
      assertSafeBind({ host: '127.0.0.1', apiKey: '', demoMode: false }),
    ).not.toThrow()
  })

  it('allows a public bind when an API key is configured', () => {
    expect(() =>
      assertSafeBind({ host: '0.0.0.0', apiKey: 'secret', demoMode: false }),
    ).not.toThrow()
  })

  it('allows a public bind in demo mode', () => {
    expect(() =>
      assertSafeBind({ host: '0.0.0.0', apiKey: '', demoMode: true }),
    ).not.toThrow()
  })
})
