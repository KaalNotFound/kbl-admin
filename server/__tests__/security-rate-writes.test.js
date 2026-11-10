/**
 * Scoped rate limiters on state-touching write endpoints (audit WU3).
 *
 * The global limiter (500/min) covers polling reads, but POST endpoints that
 * mutate server state or spawn browser processes had no scoped quota: the
 * pomodoro control endpoints, Brave CDP activation, and vault capture
 * (single + batch). This pins both live-router wiring and behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const QUOTA_MESSAGE =
  'Demasiadas solicitudes a este endpoint. Intentá de nuevo en un instante.'

function buildApp(router, useCaseStub = {}) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.useCases = useCaseStub
    next()
  })
  app.use(router)
  return app
}

function layersOf(router, method, routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method],
  )
  return layer ? layer.route.stack : []
}

describe('write-endpoint limiter wiring on the live routers', () => {
  it('pomodoro POST endpoints run behind a limiter before the handler', async () => {
    const pomodoroRouter = (await import('../routes/pomodoro.mjs')).default
    for (const action of ['start', 'stop', 'skip', 'pause', 'resume']) {
      const layers = layersOf(pomodoroRouter, 'post', `/pomodoro/${action}`)
      expect(layers, `POST /pomodoro/${action} registered`).not.toHaveLength(0)
      expect(layers.length, `/pomodoro/${action} has limiter`).toBeGreaterThan(1)
    }
  })

  it('POST /brave/activate and the capture POSTs run behind a limiter', async () => {
    const braveRouter = (await import('../routes/brave.mjs')).default
    expect(layersOf(braveRouter, 'post', '/brave/activate').length).toBeGreaterThan(1)

    const captureRouter = (await import('../routes/capture.mjs')).default
    expect(layersOf(captureRouter, 'post', '/capture').length).toBeGreaterThan(1)
    expect(layersOf(captureRouter, 'post', '/capture/batch').length).toBeGreaterThan(1)
  })
})

describe('capture batch behavioral quota', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('6th batch write within the window → 429 with the quota message', async () => {
    const { default: captureRouter } = await import('../routes/capture.mjs')
    const app = buildApp(captureRouter, {
      captureNote: async () => ({ isFailure: false, value: { filePath: 'x.md', obsidianUrl: null } }),
    })
    for (let i = 0; i < 5; i += 1) {
      const ok = await request(app).post('/capture/batch').send({ captures: [{ content: 'hola' }] })
      expect(ok.status).not.toBe(429)
    }
    const last = await request(app).post('/capture/batch').send({ captures: [{ content: 'hola' }] })
    expect(last.status).toBe(429)
    expect(last.body.error).toBe(QUOTA_MESSAGE)
    expect(last.headers['ratelimit-remaining']).toBe('0')
  })
})
