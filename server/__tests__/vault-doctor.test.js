/**
 * VAULT DOCTOR — Phase 5 (TDD RED → GREEN)
 *
 * The finanzas parsers are deliberately TOLERANT: garbage content never
 * throws, rows are silently skipped, and the operator gets no feedback
 * about WHICH file went wrong or WHY. Vault Doctor (audit "robust against
 * absence, fragile against garbage") closes that gap:
 *
 *   - server/lib/vault-doctor.mjs  — scanVault({vaultRoot, obsidianUrl?})
 *     schema lint per directory (Compras / Patrimonio / Daily / _wallet.json)
 *     + runtime per-source diagnostics (getInitDiagnostics).
 *   - GET /api/vault-doctor        — fresh scan per request + {ok:true}.
 *
 * Findings contract (severity: 'error' | 'warn'):
 *   file: vault-relative path ('/'-separated), line?: 1-based line index,
 *   kind: missing_field | bad_date | suspicious_price | bad_quantity |
 *         bad_slot_format | suspicious_value | bad_entry | unreadable_file |
 *         duplicate_day
 *   field?, value?, message, obsidian_url (Phase 1 provenance deep-link)
 *
 * Harness: seeded temp vaults (same pattern as provenance.test.js /
 * finanzas-resilience.test.js) — unit scans go through scanVault directly
 * with an explicit vaultRoot (fresh read, no module state), HTTP contract
 * drives the REAL app via supertest.
 */

import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'

const originalEnv = process.env.KBL_VAULT_ROOT

// --- dir layout helpers (mirrors finanzas-db.mjs constants) ---
const mkDirs = (vault) => ({
  compras: path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras'),
  patrimonio: path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Patrimonio'),
  daily: path.join(vault, '05 - JOURNAL', 'Daily'),
  walletDir: path.join(vault, '01 - PROYECTOS', 'AlToquePanama-Pau', 'pau-agent'),
})

const write = (dir, name, content) => {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), content)
}

// --- HTTP-contract vault: valid sources + corrupt wallet (seeded BEFORE app import) ---
const routeVault = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-doctor-route-vault-'))
const routeDirs = mkDirs(routeVault)

write(routeDirs.compras, '2026-10-15_mercadona.md',
  'fecha:: 2026-10-15\ncomercio:: Mercadona\nproducto:: Queso manchego\ncantidad:: 1\nprecio_total:: 700\ncategoria:: frescos\n')
write(routeDirs.compras, '2026-10-16_carrefour.md',
  'fecha:: 2026-10-16\ncomercio:: Carrefour\nproducto:: Aceite oliva\ncantidad:: 2\nprecio_total:: 900\n')
write(routeDirs.patrimonio, 'caja-ahorro.md',
  'tipo:: banco\nnombre:: Caja de ahorro\nvalor:: 1000\ningreso_generado:: 25\nfecha:: 2026-10-15\n')
write(routeDirs.daily, '2026-10-20.md', '# Daily\n\n- manana_food_sora:: 07:30\n- noche_food_sora:: 22:15\n')
write(routeDirs.daily, '2026-10-21.md', '# Daily\n\n- mediodia_food_sora:: 13:00\n')
// Corrupt wallet: JSON.parse always throws → loadWallet degrades the source
write(routeDirs.walletDir, '_wallet.json', '{ not valid json ][')

process.env.KBL_VAULT_ROOT = routeVault

// --- unit-only vault factories (fresh read per scan, no module state) ---
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-doctor-unit-'))
let unitVaults = []
afterEach(() => {
  for (const v of unitVaults) fs.rmSync(v, { recursive: true, force: true })
  unitVaults = []
})
const newVault = () => {
  const v = tmp()
  unitVaults.push(v)
  return v
}

let scanVault
let app

beforeAll(async () => {
  vi.resetModules()
  const doctor = await import('../lib/vault-doctor.mjs')
  scanVault = doctor.scanVault
  const serverMod = await import('../index.js')
  app = serverMod.app
})

afterAll(async () => {
  if (originalEnv === undefined) delete process.env.KBL_VAULT_ROOT
  else process.env.KBL_VAULT_ROOT = originalEnv
  fs.rmSync(routeVault, { recursive: true, force: true })
})

// ---------------------------------------------------------------- clean vault
describe('scanVault — clean seeded vault', () => {
  it('valid sources → zero findings, correct scanned counts, diagnostics present', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, '2026-10-15_mercadona.md',
      'fecha:: 2026-10-15\ncomercio:: Mercadona\nproducto:: Queso manchego\ncantidad:: 1\nprecio_total:: 700\n')
    write(d.compras, '2026-10-16_carrefour.md',
      'fecha:: 2026-10-16\ncomercio:: Carrefour\nproducto:: Aceite oliva\nprecio_total:: 24,90\n')
    write(d.patrimonio, 'fondo-emergencia.md',
      'tipo:: efectivo\nnombre:: Fondo de emergencia\nvalor:: 5000\nfecha:: 2026-10-15\n')
    write(d.daily, '2026-10-20.md', '# Daily\n\n- manana_food_sora:: 07:00\n')
    write(d.walletDir, '_wallet.json',
      JSON.stringify({ entries: [{ concept: 'freelance', amount: 120, date: '2026-10-15' }] }, null, 2))

    const scan = scanVault({ vaultRoot: v })
    expect(scan.findings).toEqual([])
    expect(scan.scanned).toEqual({ compras: 2, food_sora: 1, assets: 1, wallet: 1 })
    expect(scan.diagnostics).toBeDefined()
    expect(scan.diagnostics.sources).toBeTypeOf('object')
  })

  it('unknown zones/files are NOT scanned (invisible to the lint)', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, '2026-10-15_mercadona.md', 'producto:: Yogurt\nprecio_total:: 120\n')
    // garbage in a NON-financias zone — ignored, never counted
    fs.mkdirSync(path.join(v, '00 - INBOX'), { recursive: true })
    fs.writeFileSync(path.join(v, '00 - INBOX', 'trashed-note.md'),
      'producto::\nfecha:: 15/10/2026\nprecio_total:: 0,03\n')
    // non-md inside Compras — ignored
    fs.writeFileSync(path.join(d.compras, 'notes.txt'), 'producto::\n')
    // subfolder inside Compras — not a zone file, ignored
    const scan = scanVault({ vaultRoot: v })
    expect(scan.scanned).toEqual({ compras: 1, food_sora: 0, assets: 0, wallet: 0 })
    expect(scan.findings).toEqual([])
  })

  it('missing source dirs degrade gracefully (fresh clone) — no throw, zero scans', () => {
    const v = newVault()
    expect(() => scanVault({ vaultRoot: v })).not.toThrow()
    const scan = scanVault({ vaultRoot: v })
    expect(scan.scanned).toEqual({ compras: 0, food_sora: 0, assets: 0, wallet: 0 })
    expect(scan.findings).toEqual([])
  })
})

// -------------------------------------------------------------------- compras
describe('scanVault — Compras schema lint', () => {
  it('empty producto:: → missing_field (error) with 1-based line number', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, 'rotto.md',
      'fecha:: 2026-10-18\ncomercio:: Mercadona\nproducto:: \nprecio_total:: 300\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'missing_field')
    expect(f).toMatchObject({
      file: expect.stringMatching(/Compras\/rotto\.md$/),
      kind: 'missing_field',
      severity: 'error',
      field: 'producto',
      line: 3,
    })
  })

  it('ticket-shaped file with NO producto line at all → missing_field (error) with line', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, 'sin-producto.md',
      'fecha:: 2026-10-18\ncomercio:: Carrefour\nprecio_total:: 300\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'missing_field')
    expect(f).toMatchObject({ field: 'producto', severity: 'error' })
    expect(f.line).toBe(1)
  })

  it('missing precio with a producto → suspicious_price (warn) mentioning comma tolerance', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, 'sin-precio.md', 'fecha:: 2026-10-18\nproducto:: Agua\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'suspicious_price')
    expect(f).toMatchObject({ severity: 'warn', field: 'precio_total' })
    expect(f.message.toLowerCase()).toContain('comma')
    expect(f.file).toMatch(/Compras\/sin-precio\.md$/)
  })

  it('price parses to 0 (European comma round-down) → suspicious_price (warn)', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, 'centimos.md',
      'fecha:: 2026-10-18\nproducto:: Chicle\nprecio_total:: 0,40\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'suspicious_price')
    expect(f).toMatchObject({ severity: 'warn', field: 'precio_total' })
    expect(f.line).toBe(3) // the offending precio_total:: line
  })

  it('bad fecha "15/10/2026" → bad_date (warn) with line', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, 'fecha-locura.md',
      'fecha:: 15/10/2026\nproducto:: Pan\nprecio_total:: 100\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'bad_date')
    expect(f).toMatchObject({
      severity: 'warn',
      kind: 'bad_date',
      field: 'fecha',
      value: '15/10/2026',
      line: 1,
    })
  })

  it('non-numeric cantidad ("veinte") → bad_quantity (warn) with line', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.compras, 'cantidad-locura.md',
      'fecha:: 2026-10-18\nproducto:: Manzanas\ncantidad:: veinte\nprecio_total:: 200\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'bad_quantity')
    expect(f).toMatchObject({ severity: 'warn', field: 'cantidad', line: 3, value: 'veinte' })
  })
})

// --------------------------------------------------------------------- assets
describe('scanVault — Patrimonio schema lint', () => {
  it('missing tipo or nombre → missing_field (error)', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.patrimonio, 'sin-nombre.md', 'tipo:: banco\nvalor:: 1000\nfecha:: 2026-10-15\n')
    write(d.patrimonio, 'sin-tipo.md', 'nombre:: Colchón\nvalor:: 200\nfecha:: 2026-10-15\n')
    const scan = scanVault({ vaultRoot: v })
    const missing = scan.findings.filter(x => x.kind === 'missing_field')
    expect(missing).toHaveLength(2)
    expect(missing.map(m => m.field).sort()).toEqual(['nombre', 'tipo'])
    for (const m of missing) {
      expect(m.severity).toBe('error')
      expect(m.file).toMatch(/Patrimonio\//)
    }
  })

  it('bad fecha → bad_date (warn); valor 0 → suspicious_value (warn)', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.patrimonio, 'raro.md',
      'tipo:: crypto\nnombre:: Bóveda de garantía\nvalor:: 0\nfecha:: 2026-10-99\n')
    const scan = scanVault({ vaultRoot: v })
    expect(scan.findings.find(x => x.kind === 'bad_date'))
      .toMatchObject({ severity: 'warn', field: 'fecha', value: '2026-10-99' })
    expect(scan.findings.find(x => x.kind === 'suspicious_value'))
      .toMatchObject({ severity: 'warn', field: 'valor' })
  })
})

// ---------------------------------------------------------------- food / daily
describe('scanVault — Daily / food_sora lint', () => {
  it('slot value not HH:MM ("9 Seems") → bad_slot_format (warn) with field + line', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.daily, '2026-10-20.md',
      '# Daily\n\n- manana_food_sora:: 9 Seems\n- noche_food_sora:: 22:00\n')
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'bad_slot_format')
    expect(f).toMatchObject({
      severity: 'warn',
      kind: 'bad_slot_format',
      field: 'manana_food_sora',
      value: '9 Seems',
      line: 3,
    })
    // the valid slot stays un-flagged
    expect(scan.findings.filter(x => x.kind === 'bad_slot_format')).toHaveLength(1)
  })

  it('non-dated files without the marker are invisible; marked ones are linted', () => {
    const v = newVault()
    const d = mkDirs(v)
    // not dated, no food marker → entirely invisible
    write(d.daily, 'random-note.md', 'hello world\n')
    // not dated but carries the marker → linted
    write(d.daily, 'catchup.md', '# Catchup\n- tarde_food_sora:: 9 Seems\n')
    const scan = scanVault({ vaultRoot: v })
    expect(scan.scanned.food_sora).toBe(1)
    const f = scan.findings.find(x => x.kind === 'bad_slot_format')
    expect(f).toMatchObject({ field: 'tarde_food_sora', severity: 'warn' })
  })

  it('duplicate fecha across two Daily files → duplicate_day (warn) per extra file', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.daily, '2026-10-20.md', '# Daily\n\n- manana_food_sora:: 07:00\n')
    write(d.daily, '2026-10-20 reunion.md', '# Daily póstumo\n')
    const scan = scanVault({ vaultRoot: v })
    const dupes = scan.findings.filter(x => x.kind === 'duplicate_day')
    expect(dupes).toHaveLength(1)
    // readdir order is normalized (sort) — the flagged file is whichever
    // sorts second; the message always names both files.
    expect(dupes[0]).toMatchObject({ severity: 'warn' })
    expect(dupes[0].file).toContain('2026-10-20')
    expect(dupes[0].file).toMatch(/Daily\/2026-10-20/)
    expect(scan.findings.length).toBe(1)
  })
})

// --------------------------------------------------------------------- wallet
describe('scanVault — wallet lint', () => {
  it('corrupt JSON → unreadable_file (error) referencing _wallet.json', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.walletDir, '_wallet.json', '{ not valid json ][')
    const scan = scanVault({ vaultRoot: v })
    expect(scan.scanned.wallet).toBe(1)
    const f = scan.findings.find(x => x.kind === 'unreadable_file')
    expect(f).toMatchObject({
      severity: 'error',
      file: '01 - PROYECTOS/AlToquePanama-Pau/pau-agent/_wallet.json',
    })
  })

  it('entries not an array → bad_entry (error)', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.walletDir, '_wallet.json', JSON.stringify({ entries: 'todo de una vez' }))
    const scan = scanVault({ vaultRoot: v })
    const f = scan.findings.find(x => x.kind === 'bad_entry')
    expect(f).toMatchObject({ severity: 'error', file: expect.stringContaining('_wallet.json') })
  })

  it('entry missing concept or finite amount → one bad_entry (error) per bad entry', () => {
    const v = newVault()
    const d = mkDirs(v)
    write(d.walletDir, '_wallet.json', JSON.stringify({
      entries: [
        { concept: 'dia gratis', amount: 30, date: '2026-10-15' },
        { amount: 40 },                      // no concept
        { concept: 'sin monto', amount: 'x' } // non-numeric amount
      ],
    }))
    const scan = scanVault({ vaultRoot: v })
    const bads = scan.findings.filter(x => x.kind === 'bad_entry')
    expect(bads).toHaveLength(2)
    expect(bads.every(b => b.severity === 'error')).toBe(true)
    expect(bads.every(b => b.field === 'concept' || b.field === 'amount')).toBe(true)
  })

  it('missing wallet file → scanned.wallet 0, no finding (absence is fine)', () => {
    const v = newVault()
    const scan = scanVault({ vaultRoot: v })
    expect(scan.scanned.wallet).toBe(0)
    expect(scan.findings).toEqual([])
  })
})

// ----------------------------------------------------------------- HTTP route
describe('GET /api/vault-doctor (supertest, real app)', () => {
  it('returns the envelope: ok:true + scanned + findings + diagnostics', async () => {
    const res = await request(app).get('/api/vault-doctor')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.scanned).toEqual({ compras: 2, food_sora: 2, assets: 1, wallet: 1 })
    expect(Array.isArray(res.body.findings)).toBe(true)
    // corrupt wallet seeded up-front → its finding surfaces
    const f = res.body.findings.find(x => x.kind === 'unreadable_file')
    expect(f).toMatchObject({ severity: 'error', file: '01 - PROYECTOS/AlToquePanama-Pau/pau-agent/_wallet.json' })
    // no md findings on this livest vault
    expect(res.body.findings.filter(x => x.file.endsWith('.md'))).toEqual([])
  })

  it('diagnostics surface the degraded wallet source (error:...) from the DB layer', async () => {
    const res = await request(app).get('/api/vault-doctor')
    expect(res.body.diagnostics).toBeDefined()
    expect(res.body.diagnostics.sources.wallet).toMatch(/^error:/)
  })

  it('findings carry the provenance deep-link: obsidian:// decoded == abs fs path', async () => {
    const res = await request(app).get('/api/vault-doctor')
    for (const f of res.body.findings) {
      expect(f.obsidian_url).toMatch(/^obsidian:\/\/open\?path=/)
      expect(decodeURIComponent(f.obsidian_url.replace('obsidian://open?path=', '')))
        .toBe(path.join(routeVault, f.file))
    }
  })
})
