/**
 * DATA PROVENANCE — Phase 1 (TDD RED → GREEN)
 *
 * Every vault-sourced row must carry its source file as `obsidian_url` so the
 * UI can render a clickable "↗" chip that opens the note in Obsidian
 * (obsidian://open?path=<absolute fs path>, per https://obsidian.md/help/uri).
 *
 * Contract pinned here:
 *   - /api/search      → rows: archivo = vault-relative path + obsidian_url
 *   - /api/compare     → precio entries carry archivo + obsidian_url
 *   - /api/patrimonio  → assets rows carry archivo + obsidian_url
 *   - /api/food-sora   → data rows carry archivo + obsidian_url
 *   - /api/todos       → envelope carries sources: [{file, obsidian_url}]
 *   - /api/context     → envelope carries sources for _PENDIENTES.md/_ROADMAP.md
 *
 * Harness: seeded temp vault (same pattern as finanzas-resilience.test.js)
 * driving the REAL app via /api routes (same mechanics as food-sora-routes.test.js).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

const originalEnv = process.env.KBL_VAULT_ROOT

// --- Seeded temp vault ---
const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-provenance-vault-'))

const comprasDir = path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
const patrimonioDir = path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Patrimonio')
const dailyDir = path.join(vault, '05 - JOURNAL', 'Daily')
fs.mkdirSync(comprasDir, { recursive: true })
fs.mkdirSync(patrimonioDir, { recursive: true })
fs.mkdirSync(dailyDir, { recursive: true })

// Two tickets with the SAME product in DIFFERENT stores → /api/compare hits
fs.writeFileSync(
  path.join(comprasDir, '2026-10-15_mercadona.md'),
  'entity_type:: compra\nfecha:: 2026-10-15\ncomercio:: Mercadona\nproducto:: Queso manchego test\ncantidad:: 1\nprecio_total:: 700\ncategoria:: frescos\n',
)
fs.writeFileSync(
  path.join(comprasDir, '2026-10-16_carrefour.md'),
  'entity_type:: compra\nfecha:: 2026-10-16\ncomercio:: Carrefour\nproducto:: Queso manchego test\ncantidad:: 1\nprecio_total:: 650\ncategoria:: frescos\n',
)
// Patrimonio asset with the ticket-file pattern (inline fields)
fs.writeFileSync(
  path.join(patrimonioDir, 'caja-ahorro-test.md'),
  'tipo:: banco\nnombre:: Caja de ahorro test\nvalor:: 1000\ningreso_generado:: 25\nfecha:: 2026-10-15\n',
)
// Daily note with a food_sora slot
fs.writeFileSync(
  path.join(dailyDir, '2026-10-20.md'),
  '# Daily 2026-10-20\n\n- madrugada_food_sora:: 05:45\n',
)
// Session context SSOT files
fs.writeFileSync(
  path.join(vault, '_PENDING.md'),
  '# PENDING\n\n## Seed todos section (2026-10-20)\n\n**Estado:** Pendiente\n**Prioridad:** Alta\n**Última actualización:** 2026-10-20\n',
)
fs.writeFileSync(
  path.join(vault, '_PENDIENTES.md'),
  '# Pendientes del sistema\n\n## Seed pendientes section\n\n**Estado:** Pendiente\n**Proyecto:** KBL_Admin\n**Qué falta:** verify provenance\n',
)
fs.writeFileSync(
  path.join(vault, '_ROADMAP.md'),
  '# Roadmap\n\n## Current\n\n1. Data provenance phase 1\n\n- [ ] pending item\n- [x] completed item\n',
)

process.env.KBL_VAULT_ROOT = vault

const OBSIDIAN_URL_RE = /^obsidian:\/\/open\?path=/

let app
beforeAll(async () => {
  vi.resetModules()
  const mod = await import('../index.js')
  app = mod.app
})

afterAll(() => {
  if (originalEnv === undefined) delete process.env.KBL_VAULT_ROOT
  else process.env.KBL_VAULT_ROOT = originalEnv
  fs.rmSync(vault, { recursive: true, force: true })
})

// --- obsidianUrl() unit contract ---

describe('obsidianUrl()', () => {
  it('encodes a vault-relative path onto the absolute fs path', async () => {
    const { obsidianUrl } = await import('../lib/obsidian-url.mjs')
    const url = obsidianUrl('05 - JOURNAL/Daily/2026-10-20.md')
    expect(url.startsWith('obsidian://open?path=')).toBe(true)
    // single encoding: decode once and you land on the real fs path
    const decoded = decodeURIComponent(url.replace('obsidian://open?path=', ''))
    expect(decoded).toBe(path.join(vault, '05 - JOURNAL', 'Daily', '2026-10-20.md'))
  })

  it('leaves an already-absolute path unchanged in encoding', async () => {
    const { obsidianUrl } = await import('../lib/obsidian-url.mjs')
    const abs = path.join(vault, '_PENDING.md')
    const url = obsidianUrl(abs)
    expect(url.startsWith('obsidian://open?path=')).toBe(true)
    expect(decodeURIComponent(url.replace('obsidian://open?path=', ''))).toBe(abs)
  })

  it('is encoded-safe: spaces and unicode survive exactly one decode', async () => {
    const { obsidianUrl } = await import('../lib/obsidian-url.mjs')
    const url = obsidianUrl('02 - AREAS/008 - Trazabilidad Compras/Compras/2026-10-15_mercadona.md')
    // no raw spaces in the URL — everything percent-encoded
    expect(url.includes(' ')).toBe(false)
    const decoded = decodeURIComponent(url.replace('obsidian://open?path=', ''))
    expect(decoded).toBe(
      path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras', '2026-10-15_mercadona.md'),
    )
  })
})

// --- HTTP provenance contract (real app, seeded vault) ---

describe('GET /api/search', () => {
  it('rows carry archivo as a vault-relative path + obsidian_url', async () => {
    const res = await request(app).get('/api/search?q=queso')
    expect(res.status).toBe(200)
    expect(res.body.results.length).toBeGreaterThan(0)
    for (const row of res.body.results) {
      expect(row.archivo).toContain('Compras')
      expect(row.archivo).toMatch(/2026-10-1[56]_(mercadona|carrefour)\.md/)
      // vault-relative: must NOT contain the tmpdir absolute root
      expect(row.archivo.startsWith(os.tmpdir())).toBe(false)
      expect(row.obsidian_url).toMatch(OBSIDIAN_URL_RE)
      expect(decodeURIComponent(row.obsidian_url.replace('obsidian://open?path=', '')))
        .toBe(path.join(vault, row.archivo))
    }
  })
})

describe('GET /api/compare', () => {
  it('price entries carry archivo + obsidian_url', async () => {
    const res = await request(app).get('/api/compare?q=queso')
    expect(res.status).toBe(200)
    expect(res.body.comparison.length).toBeGreaterThan(0)
    const entries = res.body.comparison.flatMap(c => c.precios)
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      expect(entry.archivo).toContain('Compras')
      expect(entry.obsidian_url).toMatch(OBSIDIAN_URL_RE)
      expect(decodeURIComponent(entry.obsidian_url.replace('obsidian://open?path=', '')))
        .toBe(path.join(vault, entry.archivo))
    }
  })
})

describe('GET /api/patrimonio', () => {
  it('asset rows carry archivo (vault-relative) + obsidian_url', async () => {
    const res = await request(app).get('/api/patrimonio')
    expect(res.status).toBe(200)
    expect(res.body.assets.length).toBeGreaterThan(0)
    for (const asset of res.body.assets) {
      expect(asset.archivo).toContain('Patrimonio')
      expect(asset.archivo).toContain('caja-ahorro-test.md')
      expect(asset.archivo.startsWith(os.tmpdir())).toBe(false)
      expect(asset.obsidian_url).toMatch(OBSIDIAN_URL_RE)
      expect(decodeURIComponent(asset.obsidian_url.replace('obsidian://open?path=', '')))
        .toBe(path.join(vault, asset.archivo))
    }
  })
})

describe('GET /api/food-sora', () => {
  it('data rows carry archivo (Daily vault path) + obsidian_url', async () => {
    const res = await request(app).get('/api/food-sora')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const seeded = res.body.find(d => d.fecha === '2026-10-20')
    expect(seeded).toBeDefined()
    expect(seeded.archivo).toContain('Daily')
    expect(seeded.archivo).toContain('2026-10-20.md')
    expect(seeded.archivo.startsWith(os.tmpdir())).toBe(false)
    expect(seeded.obsidian_url).toMatch(OBSIDIAN_URL_RE)
    expect(decodeURIComponent(seeded.obsidian_url.replace('obsidian://open?path=', '')))
      .toBe(path.join(vault, seeded.archivo))
  })
})

describe('GET /api/todos', () => {
  it('envelope carries sources pointing at _PENDING.md', async () => {
    const res = await request(app).get('/api/todos')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.sources)).toBe(true)
    expect(res.body.sources).toHaveLength(1)
    const src = res.body.sources[0]
    expect(src.file).toBe('_PENDING.md')
    expect(src.obsidian_url).toMatch(OBSIDIAN_URL_RE)
    expect(decodeURIComponent(src.obsidian_url.replace('obsidian://open?path=', '')))
      .toBe(path.join(vault, '_PENDING.md'))
  })
})

describe('GET /api/context', () => {
  it('envelope carries sources for _PENDIENTES.md and _ROADMAP.md', async () => {
    const res = await request(app).get('/api/context')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.sources)).toBe(true)
    expect(res.body.sources).toHaveLength(2)
    const files = res.body.sources.map(s => s.file)
    expect(files).toContain('_PENDIENTES.md')
    expect(files).toContain('_ROADMAP.md')
    for (const src of res.body.sources) {
      expect(src.obsidian_url).toMatch(OBSIDIAN_URL_RE)
      expect(decodeURIComponent(src.obsidian_url.replace('obsidian://open?path=', '')))
        .toBe(path.join(vault, src.file))
    }
  })
})
