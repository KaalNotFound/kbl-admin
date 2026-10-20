/**
 * logAndRespond throttled logging (TDD)
 *
 * Problem: the dashboard polls /api/anki/stats and /api/whatsapp/chats every
 * few seconds; every poll with the external service down logs a full stack,
 * producing hundreds of identical lines. Fix: identical error signatures
 * (route|method|path|message) log the full stack ONCE, repeats log a compact
 * summary line every SUMMARY_EVERY repeats, and a genuinely different error
 * logs fully again.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let spy
beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../lib/error-handler.mjs')
  mod._resetLogThrottle()
  spy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => spy.mockRestore())

let mod

describe('logAndRespond throttles identical errors', () => {
  beforeEach(async () => {
    vi.resetModules()
    mod = (await import('../lib/error-handler.mjs')).logAndRespond
    ;(await import('../lib/error-handler.mjs'))._resetLogThrottle()
    spy.mockClear()
  })

  it('first failure logs the full message + stack', () => {
    mod('anki', 'GET', '/api/anki/stats', new Error('fetch failed'), 'Anki no disponible')
    const lines = spy.mock.calls.map((c) => String(c[0]))
    expect(lines.some((l) => l.includes('GET /api/anki/stats failed: fetch failed'))).toBe(true)
    expect(lines.some((l) => l.includes('Stack:'))).toBe(true)
  })

  it('an identical repeat does NOT log a full stack', () => {
    for (let i = 0; i < 50; i++) {
      mod('anki', 'GET', '/api/anki/stats', new Error('fetch failed'), 'msg')
    }
    const stacks = spy.mock.calls.filter((c) => String(c[0]).includes('Stack:'))
    expect(stacks).toHaveLength(1) // only the FIRST occurrence
  })

  it('every 10 identical repeats logs one compact summary line with the count', () => {
    for (let i = 0; i < 10; i++) {
      mod('anki', 'GET', '/api/anki/stats', new Error('fetch failed'), 'msg')
    }
    const summaries = spy.mock.calls
      .filter((c) => String(c[0]).includes('repeated'))
      .map((c) => String(c[0]))
    expect(summaries.length).toBeGreaterThanOrEqual(1)
    expect(summaries.at(-1)).toContain('9')
  })

  it('a genuinely different error logs fully again', () => {
    mod('anki', 'GET', '/api/anki/stats', new Error('fetch failed'), 'msg')
    spy.mockClear()
    mod('anki', 'GET', '/api/anki/stats', new Error('ECONNABORTED timeout'), 'msg')
    const lines = spy.mock.calls.map((c) => String(c[0]))
    expect(lines.some((l) => l.includes('Stack:'))).toBe(true)
  })

  it('a different route logs fully (signatures are per route+method+path+message)', () => {
    mod('anki', 'GET', '/api/anki/stats', new Error('fetch failed'), 'msg')
    spy.mockClear()
    mod('whatsapp', 'GET', '/api/whatsapp/chats', new Error('fetch failed'), 'msg')
    expect(spy.mock.calls.some((c) => String(c[0]).includes('Stack:'))).toBe(true)
  })

  it('discards: response body is still the user message', () => {
    const body = mod('anki', 'GET', '/api/anki/stats', new Error('fetch failed'), 'Anki no disponible')
    expect(body).toEqual({ error: 'Anki no disponible' })
  })
})
