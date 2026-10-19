/**
 * Finanzas DB — resilience tests (TDD RED → GREEN)
 *
 * The finanzas SQL layer must initialize cleanly on a fresh clone where the
 * vault has NO Compras/Daily/Patrimonio directories yet (demo-vault or a
 * brand-new vault). Previously loadCompras()/loadFoodSora() called
 * readdirSync() without an existsSync guard, initDb() threw ENOENT, the
 * dbInitFailed latch set in, and every search/summary request degraded to
 * empty results forever ("El sistema de búsqueda falla").
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Point the vault at an EMPTY temp vault BEFORE importing the module under
// test — VAULT_ROOT is resolved from KBL_VAULT_ROOT at import time.
const emptyVault = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-empty-vault-'))
process.env.KBL_VAULT_ROOT = emptyVault

let db

beforeAll(async () => {
  db = await import('../lib/finanzas-db.mjs')
})

afterAll(() => {
  fs.rmSync(emptyVault, { recursive: true, force: true })
})

describe('finanzas-db on a vault without finanzas directories', () => {
  it('initializes successfully instead of latching dbInitFailed', async () => {
    const ok = await db.ensureDb()
    expect(ok).toBe(true)
  })

  it('still serves search queries returning empty results', () => {
    const rows = db.query('SELECT COUNT(*) FROM items', [])
    expect(Array.isArray(rows)).toBe(true)
    expect(rows[0][0]).toBe(0)
  })
})

describe('finanzas-db loads from a partially seeded vault', () => {
  it('loads only the data sources that exist', async () => {
    const vault2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-partial-vault-'))
    const comprasDir = path.join(vault2, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
    fs.mkdirSync(comprasDir, { recursive: true })
    fs.writeFileSync(
      path.join(comprasDir, '2026-10-15_mercadona.md'),
      [
        'entity_type:: compra',
        'fecha:: 2026-10-15',
        'comercio:: Mercadona',
        'producto:: Aceite de oliva',
        'cantidad:: 1',
        'precio_total:: 9€',
        'categoria:: despensa',
      ].join('\n'),
    )
    process.env.KBL_VAULT_ROOT = vault2
    // Fresh module instance for the new vault root
    const vi = await import('vitest')
    vi.vi.resetModules()
    const db2 = await import('../lib/finanzas-db.mjs')
    const ok = await db2.ensureDb()
    expect(ok).toBe(true)
    const rows = db2.query('SELECT producto, precio_total FROM items', [])
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe('Aceite de oliva')
    expect(rows[0][1]).toBe(9)
    fs.rmSync(vault2, { recursive: true, force: true })
  })
})
