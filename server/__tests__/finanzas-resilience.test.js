/**
 * Finanzas resilience — Phase 0 hardening (TDD RED → GREEN)
 *
 * The audit (2026-10-20) proved the finanzas layer is "robust against
 * absence, fragile against garbage":
 *   - loadWallet ran a bare JSON.parse inside initDb's catch-all: ONE
 *     malformed _wallet.json latched dbInitFailed=true forever and killed
 *     summary + compras + food-sora + patrimonio together.
 *   - parseAceptarPrecio ignored European comma decimals ("19,99" → 19).
 *   - calculateFinanzas read presupuesto-state.json with bare JSON.parse
 *     and no numeric validation — a corrupt file cascaded NaN into runway.
 * These tests pin the isolation contract per data source + tolerant
 * number parsing + guarded state reads.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'

const originalEnv = process.env.KBL_VAULT_ROOT
afterAll(() => {
  if (originalEnv === undefined) delete process.env.KBL_VAULT_ROOT
  else process.env.KBL_VAULT_ROOT = originalEnv
})

const mkVault = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-fin-vault-'))
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true })
const writeWallet = (vault, content) => {
  const walletDir = path.join(vault, '01 - PROYECTOS', 'AlToquePanama-Pau', 'pau-agent')
  fs.mkdirSync(walletDir, { recursive: true })
  fs.writeFileSync(path.join(walletDir, '_wallet.json'), content)
}

function seedCompras(vault, comercio, producto, precio) {
  const comprasDir = path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
  fs.mkdirSync(comprasDir, { recursive: true })
  fs.writeFileSync(
    path.join(comprasDir, '2026-10-15_mercadona.md'),
    `entity_type:: compra\nfecha:: 2026-10-15\ncomercio:: ${comercio}\nproducto:: ${producto}\ncantidad:: 1\nprecio_total:: ${precio}\ncategoria:: despensa\n`,
  )
}

async function freshDb(vault) {
  process.env.KBL_VAULT_ROOT = vault
  vi.resetModules()
  return import('../lib/finanzas-db.mjs')
}

describe('parsePrecio / parseCantidad tolerate European formats', () => {
  it('treats comma as decimal separator (European notation)', async () => {
    const db = await freshDb(mkVault())
    // "19,99" used to become 19 — cents silently dropped
    expect(db.parsePrecio('19,99')).toBe(20)
    expect(db.parsePrecio('€3,40')).toBe(3)
    expect(db.parseCantidad('1,5')).toBe(1.5)
  })
  it('handles thousands separators in either convention', async () => {
    const db = await freshDb(mkVault())
    expect(db.parsePrecio('1.234,56')).toBe(1235)
    expect(db.parsePrecio('1,234.56')).toBe(1235)
  })
  it('keeps plain numbers and degrades garbage to 0', async () => {
    const db = await freshDb(mkVault())
    expect(db.parsePrecio('5000')).toBe(5000)
    expect(db.parsePrecio('9€')).toBe(9)
    expect(db.parsePrecio('')).toBe(0)
    expect(db.parsePrecio('abc')).toBe(0)
  })
})

describe('one malformed source never kills the other sources', () => {
  it('corrupt _wallet.json leaves compras, food and assets fully functional', async () => {
    const vault = mkVault()
    seedCompras(vault, 'Mercadona', 'Aceite de oliva', '9€')
    writeWallet(vault, '{CORRUPTED JSON {{{')
    const db = await freshDb(vault)
    // previously: dbInitFailed latched forever → ensureDb() returned false
    expect(await db.ensureDb()).toBe(true)
    const items = db.query("SELECT producto, precio_total FROM items WHERE comercio = 'Mercadona'", [])
    expect(items).toHaveLength(1)
    const income = db.query('SELECT COUNT(*) FROM income_sources', [])
    expect(income[0][0]).toBe(0)
    rm(vault)
  })

  it('wallet with a non-array entries field degrades to zero entries, not a crash', async () => {
    const vault = mkVault()
    writeWallet(vault, '{"entries": "not-a-list"}')
    const db = await freshDb(vault)
    expect(await db.ensureDb()).toBe(true)
    const income = db.query('SELECT COUNT(*) FROM income_sources', [])
    expect(income[0][0]).toBe(0)
    rm(vault)
  })

  it('wallet entries with malformed fields are skipped individually', async () => {
    const vault = mkVault()
    writeWallet(vault, JSON.stringify({ entries: [
      { concept: 'freelance', amount: 1200, date: '2026-10-01' },
      { concept: null, amount: 'NaN-ish', date: 'no-date' },
      { concept: 'bonus', amount: 300, date: '2026-10-02' },
    ] }))
    const db = await freshDb(vault)
    expect(await db.ensureDb()).toBe(true)
    const rows = db.query('SELECT fuente, monto FROM income_sources ORDER BY monto', [])
    expect(rows).toHaveLength(2)
    rm(vault)
  })

  it('exposes per-source init diagnostics instead of a single opaque bool', async () => {
    const vault = mkVault()
    seedCompras(vault, 'Carrefour', 'Yerba', '500')
    writeWallet(vault, 'NOT JSON AT ALL')
    const db = await freshDb(vault)
    await db.ensureDb()
    const diag = db.getInitDiagnostics()
    expect(diag.sources.compras).toContain('ok')
    expect(diag.sources.wallet).toContain('error')
    expect(diag.initialized).toBe(true)
    expect(diag.initFailed).toBe(false)
    rm(vault)
  })
})

describe('presupuesto-state reads are guarded (finanzas-core)', () => {
  it('returns parsed object for a valid state file', async () => {
    const vault = mkVault()
    const stateDir = path.join(vault, '07 - SCRIPTS', '_capture')
    fs.mkdirSync(stateDir, { recursive: true })
    const validPath = path.join(stateDir, 'presupuesto-state.json')
    fs.writeFileSync(validPath, JSON.stringify({ saldo: 42000, saldo_anterior: 40000, fecha_saldo: '2026-10-01' }))
    process.env.KBL_VAULT_ROOT = vault
    vi.resetModules()
    const core = await import('../lib/finanzas-core.mjs')
    expect(core.readPresupuestoState(validPath)).toEqual({ saldo: 42000, saldo_anterior: 40000, fecha_saldo: '2026-10-01' })
    rm(vault)
  })
  it('returns null for corrupt JSON or non-finite saldo instead of NaN-cascading', async () => {
    const vault = mkVault()
    const stateDir = path.join(vault, '07 - SCRIPTS', '_capture')
    fs.mkdirSync(stateDir, { recursive: true })
    const corrupt = path.join(stateDir, 'presupuesto-bad.json')
    fs.writeFileSync(corrupt, '{"saldo": 42000, "trunc')
    const badType = path.join(stateDir, 'presupuesto-bad2.json')
    fs.writeFileSync(badType, JSON.stringify({ saldo: 'un millón' }))
    const missing = path.join(stateDir, 'does-not-exist.json')
    process.env.KBL_VAULT_ROOT = vault
    vi.resetModules()
    const core = await import('../lib/finanzas-core.mjs')
    expect(core.readPresupuestoState(corrupt)).toBeNull()
    expect(core.readPresupuestoState(badType)).toBeNull()
    expect(core.readPresupuestoState(missing)).toBeNull()
    rm(vault)
  })
})

describe('calculateFinanzas survives a corrupt presupuesto-state.json', () => {
  it('falls back to perfil saldo, skips reconciliation, finite runway', async () => {
    const vault = mkVault()
    const stateDir = path.join(vault, '07 - SCRIPTS', '_capture')
    fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(path.join(stateDir, 'presupuesto-state.json'), 'CORRUPTED{{{{')
    const db = await freshDb(vault)
    vi.resetModules()
    const runwayMod = await import('../lib/finanzas-runway.mjs')
    expect(await db.ensureDb()).toBe(true)
    const result = runwayMod.calculateFinanzas()
    expect(Number.isFinite(result.saldo)).toBe(true)
    expect(result.reconciliacion).toBeNull()
    expect(Number.isFinite(result.gasto_variable_mensual)).toBe(true)
    expect(Number.isFinite(result.flujo_neto)).toBe(true)
    rm(vault)
  })
  it('uses a valid state saldo override', async () => {
    const vault = mkVault()
    const stateDir = path.join(vault, '07 - SCRIPTS', '_capture')
    fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(path.join(stateDir, 'presupuesto-state.json'), JSON.stringify({ saldo: 42000 }))
    await freshDb(vault)
    vi.resetModules()
    const runwayMod = await import('../lib/finanzas-runway.mjs')
    const result = runwayMod.calculateFinanzas()
    expect(result.saldo).toBe(42000)
    expect(result.reconciliacion).not.toBeNull()
    rm(vault)
  })
})
