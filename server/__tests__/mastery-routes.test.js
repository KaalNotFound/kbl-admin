/**
 * Mastery Routes — Integration Tests
 *
 * Tests all 7 HTTP endpoints in mastery.mjs plus helper functions.
 * Uses supertest against the Express app with mocked dependencies.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'

// Mock CDP
vi.mock('../infrastructure/brave-cdp-adapter.js', () => ({
BraveCdpAdapter: vi.fn().mockImplementation(function BraveCdpAdapterMock() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    scanUnreadChats: vi.fn(() => Promise.resolve([])),
    extractConversation: vi.fn(() => Promise.resolve([])),
  }
})
}))

// Mock fetch for external calls
vi.stubGlobal('fetch', vi.fn((url) => {
  if (typeof url === 'string' && url.includes('localhost:8765')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
}))

let app

beforeAll(async () => {
  const mod = await import('../index.js')
  app = mod.app
})

// ============================================================
// SECTION 2: Mastery Routes Integration Tests
// ============================================================

describe('GET /api/study/mastery', () => {
  it('returns success with concepts array', async () => {
    const res = await request(app).get('/api/study/mastery')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body).toHaveProperty('concepts')
    expect(Array.isArray(res.body.concepts)).toBe(true)
    expect(res.body).toHaveProperty('count')
  })
})

describe('GET /api/study/skill-tree', () => {
  it('returns success with modules array', async () => {
    const res = await request(app).get('/api/study/skill-tree')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body).toHaveProperty('modules')
    expect(Array.isArray(res.body.modules)).toBe(true)
  })
})

describe('POST /api/study/mastery/validate', () => {
  it('validates a concept and returns mastery data', async () => {
    const res = await request(app)
      .post('/api/study/mastery/validate')
      .send({
        concept: 'HTTP Protocol',
        score: 75,
        scoreType: 'feynman',
        sourceModule: 'M1',
      })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('concept', 'HTTP Protocol')
    expect(res.body.data).toHaveProperty('score')
    expect(res.body.data).toHaveProperty('level')
    expect(res.body.data).toHaveProperty('levelMeta')
  })

  it('returns 400 when concept is missing', async () => {
    const res = await request(app)
      .post('/api/study/mastery/validate')
      .send({ score: 75 })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when score is missing', async () => {
    const res = await request(app)
      .post('/api/study/mastery/validate')
      .send({ concept: 'Something' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/study/mastery/:concept', () => {
  it('returns 404 for unknown concept', async () => {
    const res = await request(app).get('/api/study/mastery/NonExistentConcept123')
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('returns detail for a validated concept', async () => {
    // First validate the concept
    await request(app)
      .post('/api/study/mastery/validate')
      .send({ concept: 'Promises', score: 80, scoreType: 'active_recall' })

    const res = await request(app).get('/api/study/mastery/Promises')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('concept', 'Promises')
    expect(res.body.data).toHaveProperty('scoreHistory')
  })
})

describe('GET /api/study/debt', () => {
  it('returns cognitive debt data with all required fields', async () => {
    const res = await request(app).get('/api/study/debt')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('total_concepts')
    expect(res.body.data).toHaveProperty('validated')
    expect(res.body.data).toHaveProperty('consolidated')
    expect(res.body.data).toHaveProperty('debt_ratio')
    expect(res.body.data).toHaveProperty('by_module')
    expect(res.body.data).toHaveProperty('burn_down_history')
    expect(Array.isArray(res.body.data.burn_down_history)).toBe(true)
    expect(res.body.data.burn_down_history.length).toBe(31) // 30 days + today
  })

  it('burn_down_history entries have date and remaining', async () => {
    const res = await request(app).get('/api/study/debt')
    const entry = res.body.data.burn_down_history[0]
    expect(entry).toHaveProperty('date')
    expect(entry).toHaveProperty('remaining')
    expect(typeof entry.remaining).toBe('number')
  })
})

describe('GET /api/study/bias', () => {
  it('returns bias data with required fields', async () => {
    const res = await request(app).get('/api/study/bias')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('human_vs_ai_ratio')
    expect(res.body.data).toHaveProperty('illusion_of_competence')
    expect(res.body.data).toHaveProperty('staleness_index')
    expect(res.body.data).toHaveProperty('alerts')
    expect(Array.isArray(res.body.data.alerts)).toBe(true)
    expect(res.body.data).toHaveProperty('stale_concepts')
  })

  it('human_vs_ai_ratio is between 0 and 100', async () => {
    const res = await request(app).get('/api/study/bias')
    const ratio = res.body.data.human_vs_ai_ratio
    expect(ratio).toBeGreaterThanOrEqual(0)
    expect(ratio).toBeLessThanOrEqual(100)
  })
})

describe('POST /api/study/socratic', () => {
  it('returns 400 when concept is missing', async () => {
    const res = await request(app)
      .post('/api/study/socratic')
      .send({ operator_explanation: 'something' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when explanation is missing', async () => {
    const res = await request(app)
      .post('/api/study/socratic')
      .send({ concept: 'Something' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('evaluates explanation and returns score + feedback', async () => {
    const res = await request(app)
      .post('/api/study/socratic')
      .send({
        concept: 'HTTP Protocol',
        operator_explanation: 'HTTP es como el protocolo de envío de cartas de internet. Como un sistema de correo que usa solicitudes y respuestas entre cliente y servidor. GET para pedir datos, POST para enviar. Cada request tiene headers que indican qué tipo de contenido queremos.',
        source_note: '1. HTTP.md',
      })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success', true)
    expect(res.body.data).toHaveProperty('score')
    expect(typeof res.body.data.score).toBe('number')
    expect(res.body.data).toHaveProperty('feedback')
    expect(typeof res.body.data.feedback).toBe('string')
    expect(res.body.data).toHaveProperty('strengths')
    expect(Array.isArray(res.body.data.strengths)).toBe(true)
    expect(res.body.data).toHaveProperty('gaps')
    expect(Array.isArray(res.body.data.gaps)).toBe(true)
    expect(res.body.data).toHaveProperty('mastery')
    expect(res.body.data.mastery).toHaveProperty('concept', 'HTTP Protocol')
  })

  it('returns low score for empty explanation', async () => {
    const res = await request(app)
      .post('/api/study/socratic')
      .send({
        concept: 'DNS',
        operator_explanation: 'no se',
      })
    expect(res.status).toBe(200)
    expect(res.body.data.score).toBeLessThan(60)
  })

  it('returns higher score for detailed explanation with analogies', async () => {
    const res = await request(app)
      .post('/api/study/socratic')
      .send({
        concept: 'Event Loop',
        operator_explanation: 'El event loop es como un conductor de orquesta que coordina todas las tareas asincrónicas. Imaginate que tenés una pila de tareas (call stack) y una cola de callbacks. El event loop toma callbacks de la cola cuando la pila está vacía y los ejecuta. Los setTimeout function son como mandar una carta con retardo. El event loop siempre pregunta: ¿la pila está vacía? Si sí, tomo el siguiente callback. Esto permite que JavaScript sea single-threaded pero pueda manejar miles de conexiones simultáneas.',
      })
    expect(res.status).toBe(200)
    expect(res.body.data.score).toBeGreaterThanOrEqual(60)
  })
})
