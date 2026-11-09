/**
 * Slice 4 (issue KaalNotFound/kbl-admin#3) — OWASP A09/A10 + LLM05 residual:
 * generic client error bodies (A09), bounded outbound calls (A10/LLM05),
 * requestLogger before routers, env-gated crash policy, throttled 401 logs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Fake DI container with a real StructuredLogger (observable NDJSON to stdout).
vi.mock('../di-container.js', async () => {
  const { StructuredLogger } = await import('../infrastructure/structured-logger.js')
  return {
    createContainer: () => ({
      useCases: {},
      logger: new StructuredLogger({ service: 'kbl-admin' }),
    }),
  }
})

// Stub http.request with a fast-failing fake socket capturing reqOpts.
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal()
  const { EventEmitter } = await import('node:events')
  return {
    ...actual,
    default: {
      ...actual.default,
      request: vi.fn((opts) => {
        const fake = new EventEmitter()
        fake.write = () => {}
        fake.end = () => process.nextTick(() => {
          const err = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })
          fake.emit('error', err)
        })
        return fake
      }),
    },
  }
})

import masteryRouter from '../routes/mastery.mjs'
import studyRouter from '../routes/study.mjs'
import captureRouter from '../routes/capture.mjs'
import { _resetLogThrottle } from '../lib/error-handler.mjs'
import { createBraveUseCases } from '../application/use-cases/brave.js'
import { createSecurityMiddleware } from '../middleware/security.mjs'

const SECRET = 'secret path /tmp/kbl-redaction-probe/vault.db'
const GENERIC = 'Error interno del servidor'

let consoleErrorSpy
let stdoutSpy
let stderrSpy

beforeEach(() => {
  _resetLogThrottle()
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  consoleErrorSpy.mockRestore()
  stdoutSpy.mockRestore()
  stderrSpy.mockRestore()
  vi.unstubAllGlobals()
})

function buildRouteApp({ mastery, captureNote } = {}) {
  const app = express()
  app.use(express.json())
  app.use('/api', (req, _res, next) => {
    req.useCases = {
      ...(mastery ? { mastery } : {}),
      ...(captureNote ? { captureNote } : {}),
    }
    req.log = { info: () => {}, error: () => {} }
    next()
  })
  app.use('/api', masteryRouter)
  app.use('/api', studyRouter)
  app.use('/api', captureRouter)
  return app
}

function capturedConsole() {
  return consoleErrorSpy.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
}

// Use-case stub whose call always throws the leaky probe error.
const throwing = () => vi.fn(() => { throw new Error(SECRET) })

describe('A09 — client error leaks', () => {
  it('GET /api/mastery returns a generic 5xx body and logs the context server-side', async () => {
    const app = buildRouteApp({ mastery: { getMastery: throwing() } })
    const res = await request(app).get('/api/mastery')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe(GENERIC)
    expect(res.body.error).not.toContain('secret')
    const logged = capturedConsole()
    expect(logged).toContain('[mastery]')
    expect(logged).toContain('/mastery')
    expect(logged).toContain('secret path')
  })

  it('GET /api/study/mastery does not leak the use-case error message', async () => {
    const app = buildRouteApp({ mastery: { getAllMastery: throwing() } })
    const res = await request(app).get('/api/study/mastery')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe(GENERIC)
    expect(capturedConsole()).toContain('[mastery]')
  })

  it('POST /api/study/start-session does not leak (study routes covered)', async () => {
    const app = buildRouteApp({ mastery: { getMastery: throwing() } })
    const res = await request(app)
      .post('/api/study/start-session')
      .send({ moduleId: 'algo' })
    expect(res.status).toBe(500)
    expect(res.body.error).toBe(GENERIC)
    expect(capturedConsole()).toContain('[study]')
  })

  it('POST /api/capture keeps the use-case status but returns a generic body', async () => {
    const app = buildRouteApp({
      captureNote: vi.fn(async () => ({
        isFailure: true,
        error: { message: SECRET, code: 'FILE_NOT_IN_VAULT', statusCode: 503 },
      })),
    })
    const res = await request(app).post('/api/capture').send({ content: 'jot' })
    expect(res.status).toBe(503)
    expect(res.body.error).not.toContain('secret')
  })

  it('POST /api/capture keeps curated 4xx triage copy (contract) and sanitizes 5xx', async () => {
    const app = buildRouteApp({
      captureNote: vi.fn(async () => ({
        isFailure: true,
        error: { message: 'Indicá al menos el comercio.', code: 'VALIDATION_ERROR', statusCode: 400 },
      })),
    })
    const ok = await request(app).post('/api/capture').send({ content: 'Algo' })
    expect(ok.status).toBe(400)
    expect(ok.body.error).toContain('comercio')
  })

  it('POST /api/capture/batch sanitizes per-item failure details', async () => {
    const app = buildRouteApp({
      captureNote: vi.fn(async () => ({
        isFailure: true,
        error: { message: SECRET, code: 'FILE_NOT_IN_VAULT' },
      })),
    })
    const res = await request(app)
      .post('/api/capture/batch')
      .send({ captures: [{ content: 'a' }, { content: 'b' }] })
    expect(res.status).toBe(201)
    for (const item of res.body.results) {
      expect(item.status).toBe('failed')
      expect(item.error).toBeDefined()
      expect(JSON.stringify(item)).not.toContain('secret')
    }
  })
})

describe('A10/LLM05 — outbound calls are bounded', () => {
  it('brave getTabs passes an AbortSignal to fetch', async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([]) }))
    vi.stubGlobal('fetch', fetchSpy)
    const uc = createBraveUseCases({ brave: {} })
    await uc.getTabs()
    const init = fetchSpy.mock.calls[0][1]
    expect(init).toBeDefined()
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('brave activateTab passes an AbortSignal to fetch', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetchSpy)
    const uc = createBraveUseCases({ brave: {} })
    await uc.activateTab('tab-1')
    const init = fetchSpy.mock.calls[0][1]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('CDP adapter resolves the WS endpoint with a bounded fetch', async () => {
    const { resolveCdpEndpoint } = await import('../infrastructure/brave-cdp-adapter.js')
    const fetchSpy = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222/x' }),
      }))
    vi.stubGlobal('fetch', fetchSpy)
    const ws = await resolveCdpEndpoint('http://127.0.0.1:9222')
    expect(ws).toBe('ws://127.0.0.1:9222/x')
    const init = fetchSpy.mock.calls[0][1]
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('NLM proxy requests carry a bounded AbortSignal in reqOpts', async () => {
    const { request: requestMock } = (await import('node:http')).default
    const { nlmRequest } = await import('../lib/notebooklm-proxy.mjs')
    await expect(nlmRequest('GET', '/health')).rejects.toThrow()
    expect(requestMock).toHaveBeenCalled()
    const opts = requestMock.mock.calls[requestMock.mock.calls.length - 1][0]
    expect(opts.signal).toBeInstanceOf(AbortSignal)
    expect(typeof opts.timeout).toBe('number')
  })
})

describe('logger mount order', () => {
  it('logs request.start/end for a matched /api route (requestLogger before routers)', async () => {
    const mod = await import('../index.js')
    await request(mod.app).get('/api/overview')
    // request.end logs at 'error' level (5xx) → stderr, not stdout.
    const lines = [...stdoutSpy.mock.calls, ...stderrSpy.mock.calls]
      .map((c) => String(c[0])).join('\n')
    expect(lines).toContain('request.start')
    expect(lines).toContain('request.end')
  })
})

describe('crash policy', () => {
  it('shouldExitOnUncaught defaults to keep-serving', async () => {
    const { shouldExitOnUncaught } = await import('../lib/crash-policy.mjs')
    expect(shouldExitOnUncaught({})).toBe(false)
  })

  it('shouldExitOnUncaught exits under KBL_EXIT_ON_UNCAUGHT=1', async () => {
    const { shouldExitOnUncaught } = await import('../lib/crash-policy.mjs')
    expect(shouldExitOnUncaught({ KBL_EXIT_ON_UNCAUGHT: '1' })).toBe(true)
    expect(shouldExitOnUncaught({ KBL_EXIT_ON_UNCAUGHT: '0' })).toBe(false)
  })
})

describe('A09 — rejected auth logs are throttled server-side', () => {
  it('401 attempts produce [security] throttled log lines', async () => {
    const app = express()
    app.use(...createSecurityMiddleware({ apiKey: 'secret-key' }))
    app.get('/api/anything', (_req, res) => res.json({ ok: true }))

    for (let i = 0; i < 3; i++) {
      await request(app).get('/api/anything')
    }
    const logged = capturedConsole()
    expect(logged.split('[security]').length - 1).toBeGreaterThanOrEqual(2)
  })
})
