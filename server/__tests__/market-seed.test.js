import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SEED_PATH = path.join(REPO_ROOT, 'server', 'seed', 'market-data.json')
const ROUTE_PATH = path.join(REPO_ROOT, 'server', 'routes', 'market.mjs')

describe('market seed dataset', () => {
  it('exists and is valid JSON', () => {
    expect(fs.existsSync(SEED_PATH)).toBe(true)
    expect(() => JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))).not.toThrow()
  })

  it('exposes the MarketData schema used by the dashboard', () => {
    const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
    expect(Array.isArray(data.trends)).toBe(true)
    expect(Array.isArray(data.ceo_quotes)).toBe(true)
    expect(Array.isArray(data.recommendations)).toBe(true)
    expect(Array.isArray(data.motivational_phrases)).toBe(true)
    expect(typeof data.last_updated).toBe('string')
    for (const t of data.trends) {
      expect(typeof t.title).toBe('string')
      expect(typeof t.detail).toBe('string')
      expect(typeof t.source).toBe('string')
      expect(['alta', 'media', 'baja']).toContain(t.priority)
    }
    for (const q of data.ceo_quotes) {
      expect(typeof q.quote).toBe('string')
      expect(typeof q.person).toBe('string')
      expect(typeof q.date).toBe('string')
    }
    for (const r of data.recommendations) {
      expect(typeof r.skill).toBe('string')
      expect(typeof r.focus).toBe('string')
      expect(typeof r.porque).toBe('string')
    }
  })

  it('carries a verifiable dataset worth showing: >=10 trends, >=5 CEO quotes, >=5 recommendations', () => {
    const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
    expect(data.trends.length).toBeGreaterThanOrEqual(10)
    expect(data.ceo_quotes.length).toBeGreaterThanOrEqual(5)
    expect(data.recommendations.length).toBeGreaterThanOrEqual(5)
    expect(data.motivational_phrases.length).toBeGreaterThanOrEqual(6)
  })

  it('is dated 2026 (fresh dataset, not stale seeded content)', () => {
    const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
    expect(data.last_updated).toBe('2026-11-10')
  })

  it('route falls back to the tracked seed when personal data is absent', () => {
    const source = fs.readFileSync(ROUTE_PATH, 'utf8')
    // Personal artifacts remain untracked; the seed is the tracked default.
    expect(source).not.toContain('_MARKET_DATA.json')
    expect(source).toContain('seed')
    expect(source).toContain('KBL_DATA_DIR')
  })
})
