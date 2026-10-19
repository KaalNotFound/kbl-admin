/**
 * Active Recall Routes — Integration Tests (TDD RED → GREEN)
 *
 * Restores the HTTP surface consumed by src/api/active-recall.ts that the
 * ADR-025 DI refactor dropped. Frontend contract (source of truth):
 *   GET  /api/active-recall/all            → { questions: ActiveRecallDueItem[] }
 *   GET  /api/active-recall/due            → ActiveRecallDueResponse { questions, stats }
 *   GET  /api/active-recall/question/:id   → ActiveRecallQuestion | 404
 *   POST /api/active-recall/submit         → ActiveRecallSubmitResponse
 *   POST /api/active-recall/ingest         → { success, imported, stats }
 *   POST /api/active-recall/inject         → { success, seeded, stats }
 *   POST /api/active-recall/seed           → { success, seeded, stats }
 *
 * Uses supertest against the real Express app with the store redirected to a
 * temp file (ACTIVE_RECALL_STORE_PATH) so tests never touch real user data.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-active-recall-test-'))
const tmpStore = path.join(tmpDir, 'active-recall-store.json')
process.env.ACTIVE_RECALL_STORE_PATH = tmpStore

let app
let store

beforeAll(async () => {
  // Import AFTER the env override so the store resolves the temp path.
  store = await import('../infrastructure/active-recall-store.js')
  store.seedQuestions([
    {
      question: '¿Qué es el event loop?',
      type: 'question',
      concept: 'Event Loop',
      definition: 'Mecanismo de concurrencia de Node.js',
      sourceNote: 'demo-note',
      sourceBloque: 3,
    },
  ])
  const mod = await import('../index.js')
  app = mod.app
})

// ============================================================
// GET /api/active-recall/all
// ============================================================
describe('GET /api/active-recall/all', () => {
  it('returns 200 with questions array of due items', async () => {
    const res = await request(app).get('/api/active-recall/all')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.questions)).toBe(true)
    const q = res.body.questions.find((x) => x.question === '¿Qué es el event loop?')
    expect(q).toBeDefined()
    for (const field of ['id', 'due', 'lastReview', 'reviewCount', 'lastScore', 'interval', 'nextReview']) {
      expect(q).toHaveProperty(field)
    }
  })
})

// ============================================================
// GET /api/active-recall/due
// ============================================================
describe('GET /api/active-recall/due', () => {
  it('returns 200 with questions and stats (ActiveRecallDueResponse)', async () => {
    const res = await request(app).get('/api/active-recall/due')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.questions)).toBe(true)
    expect(res.body.questions.some((x) => x.question === '¿Qué es el event loop?')).toBe(true)
    for (const field of ['totalQuestions', 'totalReviews', 'dueCount', 'reviewedToday', 'streak', 'scores', 'lastUpdated']) {
      expect(res.body.stats).toHaveProperty(field)
    }
  })
})

// ============================================================
// GET /api/active-recall/question/:id
// ============================================================
describe('GET /api/active-recall/question/:id', () => {
  it('returns 200 with the full question including reviews', async () => {
    const all = await request(app).get('/api/active-recall/all')
    const seeded = all.body.questions.find((x) => x.question === '¿Qué es el event loop?')
    const res = await request(app).get(`/api/active-recall/question/${encodeURIComponent(seeded.id)}`)
    expect(res.status).toBe(200)
    expect(res.body.question).toBe('¿Qué es el event loop?')
    expect(Array.isArray(res.body.reviews)).toBe(true)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/active-recall/question/no-such-id')
    expect(res.status).toBe(404)
  })
})

// ============================================================
// POST /api/active-recall/submit
// ============================================================
describe('POST /api/active-recall/submit', () => {
  it('records a review and returns ActiveRecallSubmitResponse', async () => {
    const res = await request(app)
      .post('/api/active-recall/submit')
      .send({ question: '¿Qué es el event loop?', type: 'question', answer: 'mi respuesta', score: 'correct' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    for (const field of ['id', 'review', 'interval', 'nextReview', 'due']) {
      expect(res.body).toHaveProperty(field)
    }
    expect(res.body.review.score).toBe('correct')
  })

  it('returns 400 when score is invalid', async () => {
    const res = await request(app)
      .post('/api/active-recall/submit')
      .send({ question: 'pregunta', score: 'meh' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when question is missing', async () => {
    const res = await request(app).post('/api/active-recall/submit').send({ score: 'correct' })
    expect(res.status).toBe(400)
  })
})

// ============================================================
// POST /api/active-recall/ingest
// ============================================================
describe('POST /api/active-recall/ingest', () => {
  it('returns 200 with success, imported count and stats', async () => {
    const res = await request(app).post('/api/active-recall/ingest')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(typeof res.body.imported).toBe('number')
    expect(res.body.stats).toHaveProperty('totalQuestions')
  })
})

// ============================================================
// POST /api/active-recall/inject
// ============================================================
describe('POST /api/active-recall/inject', () => {
  it('seeds one question and returns success, seeded and stats', async () => {
    const res = await request(app).post('/api/active-recall/inject').send({
      question: '¿Qué es un closure?',
      type: 'concept',
      concept: 'Closure',
      definition: 'Función que recuerda su scope léxico',
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.seeded).toBe(1)
    expect(res.body.stats).toHaveProperty('totalQuestions')
  })

  it('returns 400 when question is missing', async () => {
    const res = await request(app).post('/api/active-recall/inject').send({ type: 'question' })
    expect(res.status).toBe(400)
  })
})

// ============================================================
// POST /api/active-recall/seed
// ============================================================
describe('POST /api/active-recall/seed', () => {
  it('seeds multiple questions and returns success, seeded and stats', async () => {
    const res = await request(app).post('/api/active-recall/seed').send({
      questions: [
        { question: '¿Qué es hoisting?', type: 'question' },
        { question: '¿Qué es el prototipo?', type: 'question' },
      ],
    })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.seeded).toBe(2)
    expect(res.body.stats).toHaveProperty('totalQuestions')
  })

  it('returns 400 when questions is not an array', async () => {
    const res = await request(app).post('/api/active-recall/seed').send({ questions: 'nope' })
    expect(res.status).toBe(400)
  })
})
