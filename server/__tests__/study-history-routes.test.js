/**
 * Study History Route — Integration Tests (TDD RED → GREEN)
 *
 * GET /api/study/history must return the StudyHistoryResponse contract
 * consumed by src/components/StudyHashmap.tsx and typed in src/types.ts:
 *   { history: Record<string, HistoryItem[]>, items: HistoryItem[], stats: StudyStats }
 *
 * The ADR-025 DI refactor left the route returning the bare array from
 * getStudyHistory(); `items` came back undefined and the Mapa sub-tab
 * crashed the React tree with "items is not iterable" on click.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolate persisted stores in a temp dir so tests never touch real data.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-study-history-test-'))
process.env.ACTIVE_RECALL_STORE_PATH = path.join(tmpDir, 'active-recall-store.json')
process.env.MASTERY_STORE_PATH = path.join(tmpDir, 'mastery-store.json')

let app

beforeAll(async () => {
  const mod = await import('../index.js')
  app = mod.app
})

describe('GET /api/study/history', () => {
  it('returns 200 with items, history and stats (StudyHistoryResponse)', async () => {
    const res = await request(app).get('/api/study/history')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    for (const field of ['total', 'correct', 'partial', 'incorrect', 'streak', 'today']) {
      expect(res.body.stats).toHaveProperty(field)
    }
    // history: Record<fecha, HistoryItem[]> — every key maps to an array
    for (const [date, dayItems] of Object.entries(res.body.history)) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Array.isArray(dayItems)).toBe(true)
    }
    // every item is grouped under its own fecha
    for (const item of res.body.items) {
      expect(res.body.history[item.fecha]).toContainEqual(item)
    }
  })

  it('computes stats totals from the items', async () => {
    const res = await request(app).get('/api/study/history')
    expect(res.status).toBe(200)
    expect(res.body.stats.total).toBe(res.body.items.length)
    const scored = res.body.items.filter((i) => i.score)
    const sum = (k) => res.body.items.filter((i) => i.score === k).length
    if (scored.length > 0) {
      expect(res.body.stats.correct + res.body.stats.partial + res.body.stats.incorrect).toBe(scored.length)
    }
    expect(sum('correct')).toBe(res.body.stats.correct)
    expect(sum('partial')).toBe(res.body.stats.partial)
    expect(sum('incorrect')).toBe(res.body.stats.incorrect)
  })
})
