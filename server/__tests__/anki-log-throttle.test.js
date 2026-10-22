/**
 * anki-log-throttle.test.js (TDD RED → GREEN)
 *
 * Problem: GET /api/anki/stats is dashboard-polled every few seconds. The
 * route does its own raw console.error on failure (not the throttled
 * pattern from commit a5a9d8f), so with AnkiConnect (:8765) down every poll
 * floods the console with an identical full log.
 *
 * Fix: same signature-keyed throttling as logAndRespond
 * (route|method|path|message): first occurrence logs fully, every 10th
 * identical repeat logs ONE compact summary line, nothing in between.
 * The HTTP contract (200 + connected:false shape) must not change.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'

import { _resetLogThrottle } from '../lib/error-handler.mjs'

let app
let fetchSpy
let errorLogSpy

// Rejected with the SAME Error instance on every call → identical signature
const SAME_ERROR = new Error('connect ECONNREFUSED 127.0.0.1:8765')

const CONTRACT_BODY = {
  reviewed: 0, due: 0, total: 0, streak: 0,
  connected: false, decks: [], history: [],
}

beforeAll(async () => {
  const mod = await import('../index.js')
  app = mod.app
})

beforeEach(() => {
  _resetLogThrottle()
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(SAME_ERROR)
  errorLogSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  fetchSpy.mockRestore()
  errorLogSpy.mockRestore()
})

function ankiLines() {
  return errorLogSpy.mock.calls
    .filter((c) => c.some((a) => String(a).includes('[anki]')))
    .map((c) => c.map((a) => String(a)).join(' '))
}

/** Count anki console lines containing a substring. */
const countAnkiLines = (needle, lines) => lines.filter((l) => l.includes(needle)).length

describe('GET /api/anki/stats throttles identical server-side errors', () => {
  it('keeps the connected:false response contract on error', async () => {
    const res = await request(app).get('/api/anki/stats')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(CONTRACT_BODY)
  })

  it('first failure logs full message + stack', async () => {
    await request(app).get('/api/anki/stats')
    const lines = ankiLines()
    expect(lines).toHaveLength(2)
    expect(countAnkiLines('failed: connect ECONNREFUSED 127.0.0.1:8765', lines)).toBe(1)
    expect(countAnkiLines('Stack:', lines)).toBe(1)
  })

  it('10 identical failures → ONE full log + ONE compact summary (a5a9d8f: fires on the 10th repeat, count = repeats)', async () => {
    for (let i = 0; i < 10; i++) await request(app).get('/api/anki/stats')
    const lines = ankiLines()
    expect(countAnkiLines('failed: connect ECONNREFUSED', lines)).toBe(1)
    expect(countAnkiLines('Stack:', lines)).toBe(1)
    const summaries = lines.filter((l) => l.includes('repeated'))
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toContain('[anki] GET /api/anki/stats failed 9 repeated times (connect ECONNREFUSED 127.0.0.1:8765) - logs suppressed')
  })

  it('11th and 12th identical failures → nothing beyond the 3 established lines', async () => {
    for (let i = 0; i < 12; i++) await request(app).get('/api/anki/stats')
    expect(ankiLines()).toHaveLength(3)
  })
})
