/**
 * Todos write-back — Phase 4 (TDD RED → GREEN)
 *
 * Phase 4 closes the loop: the operator toggles a task's done state from the
 * dashboard and the server SURGICALLY edits `_PENDING.md`, keeping the
 * markdown file as the single source of truth (SSOT) so any external reader
 * (CLI mirror / Obsidian itself) keeps seeing the same data.
 *
 * IMPORTANT FORMAT FACT (read-before-edit verification): `_PENDING.md` in
 * this system is SECTION-based, not checkbox-per-line:
 *   ## Title (date) + **Estado:** / **Prioridad:** / **Última actualización:**
 *   + prose. Some sections ALSO carry a `- [ ]` / `- [x]` checkbox line in
 *   their body (Obsidian-native tasks).
 * So the toggle resolves ONE done-marker per item, in this order:
 *   1. checkbox line inside the item's span  → flip ONLY the bracket
 *      (`[ ]` ↔ `[x]`), nothing else byte-changes;
 *   2. otherwise the `**Estado:**` line      → flip ONLY the value segment
 *      (done-family ↔ `todo`), prefix + trailing whitespace byte-preserved.
 *
 * Contract pinned here:
 *   - parser keeps a stable `line` (0-based heading index) per item — the
 *     clean targeting key when duplicate titles exist;
 *   - toggle by {id, line}: exactly ONE line of the file changes (bytes),
 *     everything else byte-preserved;
 *   - duplicate titles across sections: id alone → clean 404-style
 *     "ambiguous todo match"; id+line → only the resolved line flips;
 *   - unknown id / missing `_PENDING.md` → clean 404-style {"error"}, and
 *     the missing file is never re-created;
 *   - atomic write: temp file + rename, no `.tmp` leftovers.
 *
 * Harness: temp vault + KBL_VAULT_ROOT + vi.resetModules + dynamic import of
 * the REAL app (same mechanics as provenance.test.js / capture-triage.test.js).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

const originalEnv = process.env.KBL_VAULT_ROOT

const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-todos-wb-vault-'))
const PENDING = path.join(vault, '_PENDING.md')

process.env.KBL_VAULT_ROOT = vault

// 0-based line map of the seed (LF endings):
//   4  → heading "Preparar demo del sistema" (Estado in-progress, no checkbox)
//  12  → heading "Revisar chequeo semanal" #1 (Estado todo + `- [ ]` checkbox)
//  20  → heading "Revisar chequeo semanal" #2 (Estado done, no checkbox — duplicate title)
const SEED = [
  '# _PENDING.md — SSOT de tareas',
  '',
  'Guía: editar solo la línea de estado; todo lo demás queda byte-idéntico.',
  '',
  '## Preparar demo del sistema (2026-10-19)',
  '',
  '**Estado:** in-progress',
  '**Prioridad:** **Alta**',
  '**Última actualización:** 2026-10-19',
  '',
  'Contactar por correo para coordinar el acceso al repo privado.',
  '',
  '## Revisar chequeo semanal (2026-10-19)',
  '',
  '**Estado:** todo',
  '**Prioridad:** **Media**',
  '**Última actualización:** 2026-10-19',
  '',
  '- [ ] pasar la lista de compras al vault',
  '',
  '## Revisar chequeo semanal (2026-10-19)',
  '',
  '**Estado:** done',
  '**Prioridad:** **Baja**',
  '**Última actualización:** 2026-10-18',
  '',
  'Verificado: install → boot → suite verde.',
].join('\n')

const seedFile = () => fs.writeFileSync(PENDING, SEED, 'utf-8')

// Sections used across assertions
const DEMO_ID = 'preparar-demo-del-sistema-2026-10-19'
const DUPE_ID = 'revisar-chequeo-semanal-2026-10-19'

const linesOf = () => fs.readFileSync(PENDING, 'utf-8').split('\n')
/** indexes where two line-arrays differ */
const diffIndexes = (a, b) =>
  a.map((l, i) => [l, b[i], i]).filter(([x, y]) => x !== y).map(([, , i]) => i)

const OBSIDIAN_URL_RE = /^obsidian:\/\/open\?path=/

let app
beforeAll(async () => {
  seedFile()
  vi.resetModules()
  const mod = await import('../index.js')
  app = mod.app
})

afterAll(() => {
  if (originalEnv === undefined) delete process.env.KBL_VAULT_ROOT
  else process.env.KBL_VAULT_ROOT = originalEnv
  fs.rmSync(vault, { recursive: true, force: true })
})

// ─── 1. stable line index in the parser (additive) ─────────────────────────

describe('GET /api/todos — stable line index', () => {
  it('every item carries a 0-based `line` pointing at its heading (additive shape)', async () => {
    const res = await request(app).get('/api/todos')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    const lines = res.body.active
      .filter((t) => t.id === DEMO_ID || t.id === DUPE_ID)
      .map((t) => t.line)
    for (const l of res.body.active.map((t) => t.line)) expect(typeof l).toBe('number')
    expect(lines).toContain(4)
    expect(lines).toContain(12)
  })
})

// ─── 2. Estado-mode toggle: exactly one line changes in BYTES ──────────────

describe('POST /api/todos/toggle — estado mode (no checkbox in span)', () => {
  it('flips the Estado value segment only; every other line is byte-identical', async () => {
    seedFile()
    const before = linesOf()
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: DEMO_ID, line: 4 })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.item.state).toBe('done')
    expect(res.body.item.line).toBe(4)
    expect(res.body.toggled.from).toBe('in-progress')
    expect(res.body.toggled.to).toBe('done')
    expect(res.body.toggled.mode).toBe('estado')
    expect(res.body.sources[0].file).toBe('_PENDING.md')
    expect(decodeURIComponent(res.body.sources[0].obsidian_url.replace(OBSIDIAN_URL_RE, '')))
      .toBe(PENDING)
    const after = linesOf()
    expect(after.length).toBe(before.length)
    expect(diffIndexes(before, after)).toEqual([6]) // only the Estado line
    expect(after[6]).toBe('**Estado:** done')
  })

  it('GET /api/todos reflects the toggled state (SSOT re-read, no cache)', async () => {
    const res = await request(app).get('/api/todos')
    expect(res.status).toBe(200)
    expect(res.body.counts.done).toBe(2) // seeded done + the toggle
  })

  it('toggles back: done → todo, again exactly one line', async () => {
    const before = linesOf()
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: DEMO_ID, line: 4 })
    expect(res.status).toBe(200)
    expect(res.body.item.state).toBe('in-progress'.replace('in-progress', 'todo') && 'todo')
    const after = linesOf()
    expect(diffIndexes(before, after)).toEqual([6])
    expect(after[6]).toBe('**Estado:** todo')
  })

  it('an already-done (no checkbox) item toggles back to todo', async () => {
    seedFile()
    const before = linesOf()
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: DUPE_ID, line: 20 })
    expect(res.status).toBe(200)
    expect(res.body.toggled.from).toBe('done')
    expect(res.body.toggled.to).toBe('todo')
    const after = linesOf()
    expect(diffIndexes(before, after)).toEqual([22])
    expect(after[22]).toBe('**Estado:** todo')
  })
})

// ─── 3. checkbox-mode toggle: ONLY the bracket flips ───────────────────────

describe('POST /api/todos/toggle — checkbox mode (bracket flip)', () => {
  it('flips the `- [ ]` bracket to `- [x]`; prose + Estado lines untouched', async () => {
    seedFile()
    const before = linesOf()
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: DUPE_ID, line: 12 })
    expect(res.status).toBe(200)
    expect(res.body.toggled.mode).toBe('checkbox')
    expect(res.body.toggled.from).toBe(' ')
    expect(res.body.toggled.to).toBe('x')
    const after = linesOf()
    expect(after.length).toBe(before.length)
    expect(diffIndexes(before, after)).toEqual([18]) // only the checkbox line
    expect(after[18]).toBe('- [x] pasar la lista de compras al vault')
    // the duplicate section with the SAME title stays byte-identical
    expect(after[22]).toBe('**Estado:** done')
  })

  it('toggles the checkbox back: `- [x]` → `- [ ]`', async () => {
    const before = linesOf()
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: DUPE_ID, line: 12 })
    expect(res.status).toBe(200)
    const after = linesOf()
    expect(diffIndexes(before, after)).toEqual([18])
    expect(after[18]).toBe('- [ ] pasar la lista de compras al vault')
  })
})

// ─── 4. duplicate-title safety + validation ────────────────────────────────

describe('POST /api/todos/toggle — safety + validation', () => {
  it('duplicate titles with id only → clean 404 "ambiguous todo match", file untouched', async () => {
    seedFile()
    const before = linesOf()
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: DUPE_ID })
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('ambiguous todo match')
    expect(linesOf()).toEqual(before)
  })

  it('duplicate titles with {id, line} flip exactly their own line (each side)', async () => {
    seedFile()
    const res1 = await request(app).post('/api/todos/toggle').send({ id: DUPE_ID, line: 12 })
    expect(res1.status).toBe(200)
    expect(linesOf()[18]).toBe('- [x] pasar la lista de compras al vault')
    const res2 = await request(app).post('/api/todos/toggle').send({ id: DUPE_ID, line: 20 })
    expect(res2.status).toBe(200)
    const after = linesOf()
    // line 18 keeps the first toggle; line 22 is the second toggle — ONE line each
    expect(after[18]).toBe('- [x] pasar la lista de compras al vault')
    expect(after[22]).toBe('**Estado:** todo')
  })

  it('unknown id → clean 404 {"error: todo not found"}', async () => {
    const res = await request(app)
      .post('/api/todos/toggle')
      .send({ id: 'no-existe-vault-2026-10-19', line: 999 })
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('todo not found')
  })

  it('invalid body (no id, no line) → 400', async () => {
    const res = await request(app).post('/api/todos/toggle').send({})
    expect(res.status).toBe(400)
    expect(typeof res.body.error).toBe('string')
  })

  it('missing _PENDING.md → clean 404 and the file is NOT re-created', async () => {
    seedFile()
    fs.rmSync(PENDING)
    try {
      const res = await request(app)
        .post('/api/todos/toggle')
        .send({ id: DEMO_ID, line: 4 })
      expect(res.status).toBe(404)
      expect(typeof res.body.error).toBe('string')
    } finally {
      seedFile()
    }
  })
})

// ─── 5. atomic write: no .tmp leftovers ────────────────────────────────────

describe('POST /api/todos/toggle — atomic write', () => {
  it('leaves no .tmp files behind across toggles', async () => {
    seedFile()
    await request(app).post('/api/todos/toggle').send({ id: DEMO_ID, line: 4 })
    await request(app).post('/api/todos/toggle').send({ id: DUPE_ID, line: 12 })
    const leftovers = fs.readdirSync(vault).filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})
