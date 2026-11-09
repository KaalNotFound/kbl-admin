/**
 * POST /api/active-recall/review — contract realignment (A2) and
 * GET /api/active-recall/due — single store read per request (B7-4).
 * TDD RED → GREEN.
 *
 * A2: the use-case validated {conceptHash, correct} but the store port
 * expects {question, score} → hashQuestion(undefined) threw → /review
 * answered 500 on every call. The endpoint now validates the store
 * contract (like POST /active-recall/submit) and answers 400 with a
 * Spanish message on invalid bodies. Keep the route path; no conceptHash
 * support is invented (no consumer sends it — src/api uses /submit).
 *
 * B7-4: GET /due used to parse the store file 3x per request
 * (getDueQuestions + getStats + the getDueQuestions nested inside
 * getStats). The store now exposes getDueWithStats(limit), computed from
 * ONE readStore() snapshot (request-scoped, no module cache) and the
 * read count is pinned by a fs spy.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-active-recall-review-'))
const tmpStore = path.join(tmpDir, 'active-recall-store.json')
process.env.ACTIVE_RECALL_STORE_PATH = tmpStore

let app

beforeAll(async () => {
  // Import AFTER the env override so the store resolves the temp path.
  const store = await import('../infrastructure/active-recall-store.js')
  store.seedQuestions([{ question: '¿Qué es el event loop?', type: 'question' }])
  const mod = await import('../index.js')
  app = mod.app
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/active-recall/review — A2 contract realignment', () => {
  it('returns 400 (not 500) for the old {conceptHash, correct} body shape', async () => {
    const res = await request(app)
      .post('/api/active-recall/review')
      .send({ conceptHash: 'abc123', correct: true })
    expect(res.status).toBe(400)
    expect(typeof res.body.error).toBe('string')
  })

  it('returns 200 and records a valid {question, score} review', async () => {
    const res = await request(app)
      .post('/api/active-recall/review')
      .send({ question: '¿Qué es el event loop?', score: 'correct' })
    expect(res.status).toBe(200)
    expect(res.body.id).toBeDefined()
    expect(res.body.review.score).toBe('correct')
  })

  it('returns 400 with a Spanish error when question is missing', async () => {
    const res = await request(app)
      .post('/api/active-recall/review')
      .send({ score: 'correct' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('La pregunta es obligatoria.')
  })

  it('returns 400 with a Spanish error when score is invalid', async () => {
    const res = await request(app)
      .post('/api/active-recall/review')
      .send({ question: 'pregunta suelta' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('El resultado debe ser correct, partial o incorrect.')
  })
})

describe('GET /api/active-recall/due — B7-4 single store read per request', () => {
  it('reads the store file exactly once (due + stats share one snapshot)', async () => {
    const originalRead = fs.readFileSync.bind(fs)
    let storeReads = 0
    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((p, enc) => {
      if (String(p).includes('active-recall-store.json')) storeReads++
      return originalRead(p, enc)
    })
    try {
      const res = await request(app).get('/api/active-recall/due')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.questions)).toBe(true)
      expect(res.body.stats).toHaveProperty('totalQuestions')
      // RED baseline: 3 reads (getDueQuestions + getStats + nested due).
      expect(storeReads).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })
})
