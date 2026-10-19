/**
 * Global Search Route — Integration Tests (TDD RED → GREEN)
 *
 * GET /api/global-search?q=<term> powers the TopBar palette (Buscar... Ctrl+K),
 * which used to write to a store that no component consumed. The endpoint
 * searches across vault notes, projects, study concepts (mastery), todos and
 * the entity catalog, returning grouped results with a `tab` field so the
 * frontend can navigate to the matching dashboard.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-global-search-test-'))
process.env.ACTIVE_RECALL_STORE_PATH = path.join(tmpDir, 'active-recall-store.json')
process.env.MASTERY_STORE_PATH = path.join(tmpDir, 'mastery-store.json')

let app

beforeAll(async () => {
  // Seed a mastery concept so the concepts group has data
  fs.writeFileSync(
    path.join(tmpDir, 'mastery-store.json'),
    JSON.stringify({
      version: 1,
      lastUpdated: new Date().toISOString(),
      concepts: {
        hash_event_loop: { concept: 'Event Loop', module: 'JavaScript', totalScores: 1 },
      },
      scores: {
        hash_event_loop: [
          { score: 85, scoreType: 'quiz', date: new Date().toISOString(), details: 'seed' },
        ],
      },
    }),
  )
  const mod = await import('../index.js')
  app = mod.app
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ============================================================
// Envelope & validation
// ============================================================
describe('GET /api/global-search', () => {
  it('returns 200 with empty groups for a short query', async () => {
    const res = await request(app).get('/api/global-search').query({ q: '' })
    expect(res.status).toBe(200)
    expect(res.body.groups).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('returns 200 with grouped results and total for a real query', async () => {
    const res = await request(app).get('/api/global-search').query({ q: 'bubble' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('query', 'bubble')
    expect(Array.isArray(res.body.groups)).toBe(true)
    expect(typeof res.body.total).toBe('number')
    expect(res.body.total).toBeGreaterThan(0)
    // every group has the normalized contract shape
    for (const g of res.body.groups) {
      for (const field of ['type', 'label', 'items']) {
        expect(g).toHaveProperty(field)
      }
      expect(Array.isArray(g.items)).toBe(true)
      expect(g.items.length).toBeLessThanOrEqual(6)
      for (const item of g.items) {
        // navigation contract: every result knows its target tab
        expect(item).toHaveProperty('title')
        expect(item).toHaveProperty('tab')
        expect(item).toHaveProperty('kind')
      }
    }
  })

  it('finds vault notes (Bubble Sort demo note)', async () => {
    const res = await request(app).get('/api/global-search').query({ q: 'bubble' })
    const notes = res.body.groups.find((g) => g.type === 'notes')
    expect(notes).toBeDefined()
    expect(notes.items.some((i) => i.title.toLowerCase().replace(/[-_]/g, ' ').includes('bubble sort'))).toBe(true)
  })

  it('finds study concepts seeded in the mastery store', async () => {
    const res = await request(app).get('/api/global-search').query({ q: 'event' })
    const concepts = res.body.groups.find((g) => g.type === 'concepts')
    expect(concepts).toBeDefined()
    expect(concepts.items.some((i) => /event loop/i.test(i.title))).toBe(true)
  })

  it('finds demo projects', async () => {
    const res = await request(app).get('/api/global-search').query({ q: 'proyecto' })
    const projects = res.body.groups.find((g) => g.type === 'projects')
    expect(projects).toBeDefined()
    expect(projects.items.length).toBeGreaterThan(0)
  })

  it('finds todos (demo seed)', async () => {
    const res = await request(app).get('/api/global-search').query({ q: 'evaluador' })
    const todos = res.body.groups.find((g) => g.type === 'todos')
    expect(todos).toBeDefined()
    expect(todos.items.length).toBeGreaterThan(0)
  })

  it('does not crash on unsupported characters (FTS-free path)', async () => {
    const res = await request(app).get('/api/global-search').query({ q: 'a*%Ñ' })
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('groups')
  })
})
