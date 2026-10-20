/**
 * Capture triage — Phase 3 (TDD RED → GREEN)
 *
 * The audit proved POST /api/capture HARDCODED one target dir
 * (`02 - APRENDIZAJE/MoureDev-Master/_campus/_inbox`) for every entityType:
 * a compra captured from the dashboard never landed next to the watcher's
 * Compras dir, a food slot never touched the Daily notes, and the UI copy
 * claiming "00 - INBOX" was simply a lie.
 *
 * Contract pinned here:
 *   - quick-capture (default)  → <VAULT_ROOT>/00 - INBOX/  (dir auto-created)
 *   - compra (fields)          → <VAULT_ROOT>/02 - AREAS/008 - Trazabilidad
 *                                Compras/Compras/<date>_<slug>.md with the
 *                                EXACT inline-field format the finanzas
 *                                parser expects (prove it end-to-end: DB
 *                                query sees the product, price rounded 43).
 *   - food (slots)             → <VAULT_ROOT>/05 - JOURNAL/Daily/<date>.md
 *                                upsert semantics: replace ALL lines of a
 *                                field with ONE clean `field:: value` line.
 *   - validation               → compra without comercio+producto and an
 *                                invalid food slot return clean 400-class
 *                                errors, never crash / never write.
 *   - return contract          → { path (vault-relative), obsidian_url } on
 *                                every successful capture.
 *
 * Harness: seeded temp vault (same mechanics as provenance.test.js) driving
 * the REAL app via supertest + direct use-case calls.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

const originalEnv = process.env.KBL_VAULT_ROOT

const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-triage-vault-'))
const COMPRAS_DIR = path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
const DAILY_DIR = path.join(vault, '05 - JOURNAL', 'Daily')
const INBOX_DIR = path.join(vault, '00 - INBOX')

process.env.KBL_VAULT_ROOT = vault

const rmrf = (dir) => fs.rmSync(dir, { recursive: true, force: true })

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

// Fresh use-case instance with the same vaultFsApi wiring shape the
// di-container (ADR-025, phase 1) uses — VAULT_ROOT + fs helpers + deep-link.
async function freshUseCase() {
  vi.resetModules()
  const fsMod = await import('../infrastructure/vault-fs-adapter.mjs')
  const urlMod = await import('../lib/obsidian-url.mjs')
  const { createCaptureNote } = await import('../application/use-cases/capture-note.js')
  const vaultFsApi = {
    VAULT_ROOT: fsMod.VAULT_ROOT,
    ensureDir: fsMod.ensureDir,
    writeFile: fsMod.writeFile,
    readFile: fsMod.readFile,
    existsSync: fsMod.existsSync,
    obsidianUrl: urlMod.obsidianUrl,
  }
  return createCaptureNote({ vault: vaultFsApi })
}

async function freshDb() {
  vi.resetModules()
  return import('../lib/finanzas-db.mjs')
}

const OBSIDIAN_URL_RE = /^obsidian:\/\/open\?path=/

// ─── resolveDirectory triage table ──────────────────────────────────────────

describe('capture-note.resolveDirectory', () => {
  it('routes compra to the watcher-owned Compras dir (watcher must see it)', async () => {
    const mod = await import('../application/use-cases/capture-note.js')
    expect(mod.resolveDirectory('compra').dir).toBe('02 - AREAS/008 - Trazabilidad Compras/Compras')
  })

  it('routes food + aliases to the Daily journal dir', async () => {
    const mod = await import('../application/use-cases/capture-note.js')
    for (const alias of ['food', 'comida', 'food-sora']) {
      expect(mod.resolveDirectory(alias).dir).toBe('05 - JOURNAL/Daily')
    }
  })

  it('routes default (incl. quick-capture and unknown entity ids) to 00 - INBOX', async () => {
    const mod = await import('../application/use-cases/capture-note.js')
    for (const id of ['quick-capture', 'lol_log', undefined]) {
      expect(mod.resolveDirectory(id).dir).toBe('00 - INBOX')
    }
  })
})

// ─── quick-capture: UI copy becomes TRUE ────────────────────────────────────

describe('captureNote — quick-capture lands in 00 - INBOX', () => {
  it('writes a fresh vault note in 00 - INBOX (dir auto-created) and returns contract', async () => {
    expect(fs.existsSync(INBOX_DIR)).toBe(false) // fresh vault precondition
    const captureNote = await freshUseCase()
    const result = await captureNote({ content: 'Hello quick note', entityType: 'quick-capture' })
    expect(result.isFailure).not.toBe(true)
    const rel = result.value.filePath
    expect(rel.startsWith('00 - INBOX')).toBe(true)
    expect(rel.endsWith('.md')).toBe(true)
    // file for real, dir auto-created
    expect(fs.existsSync(path.join(vault, rel))).toBe(true)
    expect(fs.statSync(INBOX_DIR).isDirectory()).toBe(true)
    // returned contract: vault-relative + deep link that decodes to the abs fs path
    expect(result.value.obsidianUrl).toMatch(OBSIDIAN_URL_RE)
    expect(decodeURIComponent(result.value.obsidianUrl.replace(OBSIDIAN_URL_RE, '')))
      .toBe(path.join(vault, rel))
    rmrf(INBOX_DIR)
  })
})

// ─── compra: structured ticket the watcher can parse ────────────────────────

describe('captureNote — compra triage writes a watcher-compatible ticket', () => {
  const fields = {
    comercio: 'Mercadona',
    producto: 'Pan lactal',
    cantidad: 2,
    precio_total: '42,75',
    categoria: '_panaderia',
  }

  it('writes EXACT inline-line formatting at Compras/<date>_<comercio-slug>.md', async () => {
    const captureNote = await freshUseCase()
    const result = await captureNote({
      content: 'Pan lactal',
      entityType: 'compra',
      fields,
      date: '2026-10-20',
    })
    expect(result.isFailure).not.toBe(true)
    expect(result.value.filePath).toBe(
      '02 - AREAS/008 - Trazabilidad Compras/Compras/2026-10-20_mercadona.md',
    )
    const file = path.join(vault, result.value.filePath)
    expect(fs.existsSync(file)).toBe(true)
    const content = fs.readFileSync(file, 'utf-8')
    expect(content).toBe(
      '---\n'
      + 'entity_type:: compra\n'
      + 'fecha_captura:: 2026-10-20\n'
      + 'tags:: [capture, finanzas]\n'
      + 'status:: pending\n'
      + '---\n\n'
      + 'fecha:: 2026-10-20\n'
      + 'comercio:: Mercadona\n'
      + 'producto:: Pan lactal\n'
      + 'cantidad:: 2\n'
      + 'precio_total:: 42,75\n'
      + 'categoria:: _panaderia\n\n'
      + '# Pan lactal\n',
    )
    // NO leftovers from the generic template
    expect(content).not.toContain('Quick Note')
  })

  it('falls back to the first content line as producto when fields.producto is absent', async () => {
    const captureNote = await freshUseCase()
    const result = await captureNote({
      content: 'Bolsas de basura',
      entityType: 'compra',
      fields: { comercio: 'Carrefour', precio_total: '3' },
      date: '2026-10-20',
    })
    expect(result.isFailure).not.toBe(true)
    expect(result.value.filePath).toContain('2026-10-20_carrefour.md')
    const content = fs.readFileSync(path.join(vault, result.value.filePath), 'utf-8')
    expect(content).toContain('producto:: Bolsas de basura')
    expect(content).toContain('# Bolsas de basura')
    expect(content).toContain('cantidad:: 1')
  })

  it('the finanzas DB parses the captured ticket (product found, 42,75 → 43)', async () => {
    const db = await freshDb()
    expect(await db.ensureDb()).toBe(true)
    const rows = db.query(
      "SELECT producto, precio_total, cantidad, archivo FROM items WHERE producto = 'Pan lactal'", [],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0][1]).toBe(43) // European comma decimal parsed + rounded
    expect(rows[0][2]).toBe(2)
    expect(String(rows[0][3])).toContain('Compras/') // provenance still present
  })

  it('rejects compra without fields with a clean validation error', async () => {
    const captureNote = await freshUseCase()
    const result = await captureNote({ content: 'Algo compré', entityType: 'compra' })
    expect(result.isFailure).toBe(true)
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message.toLowerCase()).toContain('comercio')
  })

  it('rejects compra with comercio but no producto anywhere (nor content)', async () => {
    const captureNote = await freshUseCase()
    const result = await captureNote({
      content: '',
      entityType: 'compra',
      fields: { comercio: 'Mercadona' },
    })
    expect(result.isFailure).toBe(true)
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message.toLowerCase()).toContain('producto')
  })
})

// ─── food: Daily note upsert ────────────────────────────────────────────────

describe('captureNote — food slot upsert on Daily notes', () => {
  it('creates the missing Daily note with # Diario header + the field line', async () => {
    rmrf(DAILY_DIR)
    const captureNote = await freshUseCase()
    const result = await captureNote({
      content: 'desayuno',
      entityType: 'food',
      fields: { slot: 'manana', hora: '08:30' },
      date: '2026-10-20',
    })
    expect(result.isFailure).not.toBe(true)
    expect(result.value.filePath).toBe(path.join('05 - JOURNAL', 'Daily', '2026-10-20.md'))
    const content = fs.readFileSync(path.join(vault, result.value.filePath), 'utf-8')
    expect(content).toBe('# Diario\n\nmanana_food_sora:: 08:30\n')
  })

  it('REPLACES the slot value and keeps other slots untouched (last-match rule wins)', async () => {
    const captureNote = await freshUseCase()
    const result = await captureNote({
      content: 'hora adicional',
      entityType: 'comida', // alias
      fields: { slot: 'manana', hora: '09:10' },
      date: '2026-10-20',
    })
    expect(result.isFailure).not.toBe(true)
    const content = fs.readFileSync(path.join(vault, result.value.filePath), 'utf-8')
    const mananaLines = content.split('\n').filter(l => l.includes('manana_food_sora::'))
    expect(mananaLines).toEqual(['manana_food_sora:: 09:10']) // exactly ONE clean line

    // other slots recorded in the same note survive
    fs.writeFileSync(
      path.join(vault, result.value.filePath),
      content + 'mediodia_food_sora:: 12:00\n',
    )
    const db = await freshDb()
    expect(await db.ensureDb()).toBe(true)
    const row = db.query("SELECT manana, mediodia FROM food_sora WHERE fecha = '2026-10-20'", [])
    expect(row).toHaveLength(1)
    expect(row[0][0]).toBe('09:10')
    expect(row[0][1]).toBe('12:00')
  })

  it('rejects an invalid slot with a clean validation error and writes nothing', async () => {
    const captureNote = await freshUseCase()
    const before = fs.existsSync(path.join(DAILY_DIR, '2026-10-20.md'))
      ? fs.readFileSync(path.join(DAILY_DIR, '2026-10-20.md'), 'utf-8')
      : null
    const result = await captureNote({
      content: 'x',
      entityType: 'food',
      fields: { slot: 'almuerzo', hora: '13:00' },
      date: '2026-10-20',
    })
    expect(result.isFailure).toBe(true)
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(result.error.message.toLowerCase()).toContain('slot')
    // nothing was written for the bogus slot
    const after = fs.existsSync(path.join(DAILY_DIR, '2026-10-20.md'))
      ? fs.readFileSync(path.join(DAILY_DIR, '2026-10-20.md'), 'utf-8')
      : null
    expect(after).toBe(before)
    expect(after ?? '').not.toContain('almuerzo_food_sora::')
  })
})

// ─── HTTP contract (real app) ───────────────────────────────────────────────

describe('POST /api/capture — HTTP triage contract', () => {
  it('returns 400 with a clear message when a compra has no fields', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({ content: 'Algo compré', source: 'quick-capture', entityType: 'compra' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
    expect(res.body.error.toLowerCase()).toContain('comercio')
  })

  it('returns 400 (not a crash) for a compra with fields but no content at all', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({ content: '', source: 'quick-capture', entityType: 'compra', fields: { comercio: 'Mercadona' } })
    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })

  it('saves a compra from HTTP with path + obsidian_url in the response', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({
        content: 'Yerba Playadito 1kg',
        source: 'quick-capture',
        entityType: 'compra',
        fields: { comercio: 'Coto', precio_total: '2.500,99' },
        date: '2026-10-20',
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.path).toBe(
      '02 - AREAS/008 - Trazabilidad Compras/Compras/2026-10-20_coto.md',
    )
    expect(res.body.obsidian_url).toMatch(OBSIDIAN_URL_RE)
    expect(decodeURIComponent(res.body.obsidian_url.replace(OBSIDIAN_URL_RE, '')))
      .toBe(path.join(vault, res.body.path))
    const file = fs.readFileSync(path.join(vault, res.body.path), 'utf-8')
    expect(file).toContain('producto:: Yerba Playadito 1kg')
    expect(file).toContain('precio_total:: 2.500,99')
  })

  it('saves a food slot from HTTP (contract { path, obsidian_url })', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({
        content: '',
        source: 'quick-capture',
        entityType: 'food',
        fields: { slot: 'tarde', hora: '17:45' },
        date: '2026-10-21',
      })
    expect(res.status).toBe(200)
    expect(res.body.path).toBe(path.join('05 - JOURNAL', 'Daily', '2026-10-21.md'))
    expect(res.body.obsidian_url).toMatch(OBSIDIAN_URL_RE)
    expect(fs.existsSync(path.join(vault, res.body.path))).toBe(true)
    const file = fs.readFileSync(path.join(vault, res.body.path), 'utf-8')
    expect(file).toContain('tarde_food_sora:: 17:45')
  })

  it('still saves a plain unclassified note into 00 - INBOX (backward compat)', async () => {
    const res = await request(app)
      .post('/api/capture')
      .send({ content: 'Idea suelta', source: 'quick-capture' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(String(res.body.path).startsWith('00 - INBOX')).toBe(true)
    expect(res.body.obsidian_url).toMatch(OBSIDIAN_URL_RE)
  })
})

describe('POST /api/capture/batch — per-item triage', () => {
  it('supports structured fields per item and keeps prior behavior for plain items', async () => {
    const res = await request(app)
      .post('/api/capture/batch')
      .send({
        captures: [
          {
            content: 'Café molido',
            entityType: 'compra',
            fields: { comercio: 'Dia', precio_total: '9,10' },
            date: '2026-10-20',
          },
          { content: 'Nota plana sin fields', entityType: 'lol_log' },
        ],
      })
    expect(res.status).toBe(201)
    const results = res.body.results
    const saved = results.filter(r => r.status === 'saved')
    const failed = results.filter(r => r.status === 'failed')
    expect(results).toHaveLength(2)
    expect(saved[0].path).toContain('Compras/2026-10-20_dia.md')
    expect(saved[0].obsidian_url).toMatch(OBSIDIAN_URL_RE)
    expect(saved[1].path).not.toBe(undefined)
    expect(failed).toHaveLength(0)
  })
})
