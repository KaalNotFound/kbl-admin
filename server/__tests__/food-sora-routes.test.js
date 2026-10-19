/**
 * Food Sora routes — contract tests
 *
 * GET /api/food-sora and /api/food-sora/stats back the FoodSoraDashboard
 * (Finanzas → Food Sora). The dashboard crashed the whole React tree
 * ("Reduce of empty array with no initial value") when by_slot/calender
 * shapes were empty or partial — these tests pin the envelope contract the
 * dashboard relies on: every documented key present even when data exists.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'

let app

beforeAll(async () => {
  const mod = await import('../index.js')
  app = mod.app
})

describe('GET /api/food-sora/stats', () => {
  it('returns the full FoodSoraStats envelope', async () => {
    const res = await request(app).get('/api/food-sora/stats')
    expect(res.status).toBe(200)
    for (const field of ['total_days', 'total_slots', 'filled_slots', 'rate', 'streak', 'by_slot', 'calendar']) {
      expect(res.body).toHaveProperty(field)
    }
    // by_slot items carry the shape the dashboard aggregates on
    for (const slot of res.body.by_slot || []) {
      expect(slot).toHaveProperty('name')
      expect(slot).toHaveProperty('count')
      expect(slot).toHaveProperty('pct')
    }
    // calendar days carry slots map + filled counter
    for (const day of res.body.calendar || []) {
      expect(day).toHaveProperty('fecha')
      expect(day).toHaveProperty('slots')
      expect(day).toHaveProperty('filled')
    }
  })

  it('has more than zero registered days with the bundled demo-vault seeds', async () => {
    const res = await request(app).get('/api/food-sora/stats')
    expect(res.body.total_days).toBeGreaterThan(0)
    expect(res.body.calendar.length).toBeGreaterThan(0)
    expect(res.body.by_slot.length).toBe(5)
  })
})

describe('GET /api/food-sora', () => {
  it('returns an array of per-day detail rows', async () => {
    const res = await request(app).get('/api/food-sora')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    for (const day of res.body) {
      expect(day).toHaveProperty('fecha')
      expect(day).toHaveProperty('slots')
      expect(day).toHaveProperty('filled_slots')
      expect(day).toHaveProperty('total_slots', 5)
    }
  })
})
