/**
 * Finanzas live sync (Phase 2) — chokidar incremental re-indexing
 *
 * The SQL.js finanzas DB is built once at boot from a full vault scan
 * (`finanzas-db.mjs`). Edits made in Obsidian are invisible until the
 * server is restarted. These tests pin the live-sync contract:
 *
 *   - Watching happens at DIRECTORY level (never individual files),
 *     ignoring dotfiles, with `ignoreInitial` and `awaitWriteFinish`
 *     (Obsidian autosaves in chunks).
 *   - A changed compras/food_sora/assets file is re-parsed INCREMENTALLY:
 *     rows for that file's `archivo` provenance path are deleted, then
 *     the freshly parsed rows are inserted. No full rescan.
 *   - A deleted file removes its rows from the running DB.
 *   - One unreadable file never crashes the watcher nor corrupts other
 *     sources; its degradation is recorded in sourceStatus.
 *   - The watcher starts exactly once (module-level guard) and can be
 *     disabled vía KBL_WATCH=0 for CI determinism.
 *
 * Real timers only: bounded retry waits (poll every 200ms up to ~6s)
 * keep the events → debounce (~1200ms) → incremental upsert pipeline
 * deterministic on CI without faking time.
 */

import { describe, it, expect, afterEach, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const originalVaultRoot = process.env.KBL_VAULT_ROOT
const originalWatch = process.env.KBL_WATCH
afterAll(() => {
  if (originalVaultRoot === undefined) delete process.env.KBL_VAULT_ROOT
  else process.env.KBL_VAULT_ROOT = originalVaultRoot
  if (originalWatch === undefined) delete process.env.KBL_WATCH
  else process.env.KBL_WATCH = originalWatch
})

const mkVault = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-fin-watch-'))
const comprasDir = (vault) => path.join(vault, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
const dailyDir = (vault) => path.join(vault, '05 - JOURNAL', 'Daily')

let db = null
let watcher = null

function seedCompras(vault, filename, precioTotal) {
  fs.mkdirSync(comprasDir(vault), { recursive: true })
  fs.writeFileSync(
    path.join(comprasDir(vault), filename),
    `entity_type:: compra\nfecha:: 2026-10-15\ncomercio:: Mercadona\nproducto:: Aceite de oliva\ncantidad:: 1\nprecio_total:: ${precioTotal}\ncategoria:: despensa\n`,
  )
}

function writeDailyFood(vault, filename, slotValue) {
  fs.mkdirSync(dailyDir(vault), { recursive: true })
  fs.writeFileSync(
    path.join(dailyDir(vault), filename),
    `# Daily Note\n- manana_food_sora:: ${slotValue}\n- tarde_food_sora::\n`,
  )
}

async function freshModules(vault) {
  process.env.KBL_VAULT_ROOT = vault
  vi.resetModules()
  db = await import('../lib/finanzas-db.mjs')
  watcher = await import('../lib/finanzas-watcher.mjs')
}

/**
 * Bounded retry wait — real timers, no fakes. Polls every 200ms for up
 * to `timeout` ms so the OS event → chokidar (~350ms awaitWriteFinish)
 * → 1200ms debounce pipeline has generous headroom on slow CI runners.
 */
async function waitFor(fn, desc, timeout = 6000) {
  const started = Date.now()
  for (;;) {
    const value = fn()
    if (value) return value
    if (Date.now() - started > timeout) {
      throw new Error(`waitFor timeout (${desc}) after ${Date.now() - started}ms`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}

afterEach(() => {
  if (watcher) {
    watcher.stopFinanzasWatcher?.()
    watcher._resetWatcherForTest?.()
  }
})

describe('finanzas watcher — lifecycle guards', () => {
  it('double-start is rejected with already-started (no duplicate watchers)', async () => {
    const vault = mkVault()
    seedCompras(vault, '2026-10-15_mercadona.md', '1500')
    await freshModules(vault)
    await db.ensureDb()
    const first = await watcher.startFinanzasWatcher()
    expect(first.started).toBe(true)
    const second = await watcher.startFinanzasWatcher()
    expect(second.started).toBe(false)
    expect(second.reason).toBe('already-started')
  })

  it('KBL_WATCH=0 disables the watcher with watch-disabled reason', async () => {
    const vault = mkVault()
    seedCompras(vault, '2026-10-15_mercadona.md', '1500')
    await freshModules(vault)
    process.env.KBL_WATCH = '0'
    try {
      const res = await watcher.startFinanzasWatcher()
      expect(res.started).toBe(false)
      expect(res.reason).toBe('watch-disabled')
    } finally {
      delete process.env.KBL_WATCH
    }
  })
})

describe('finanzas watcher — incremental upserts on the running DB', () => {
  it('reflects a modified precio_total in the running DB, keeping comma decimals', async () => {
    const vault = mkVault()
    seedCompras(vault, '2026-10-15_mercadona.md', '1500')
    await freshModules(vault)
    await db.ensureDb()
    expect((await watcher.startFinanzasWatcher()).started).toBe(true)
    expect(db.query("SELECT precio_total FROM items WHERE producto = 'Aceite de oliva'")).toEqual([[1500]])

    fs.writeFileSync(
      path.join(comprasDir(vault), '2026-10-15_mercadona.md'),
      'entity_type:: compra\nfecha:: 2026-10-15\ncomercio:: Mercadona\nproducto:: Aceite de oliva\ncantidad:: 1\nprecio_total:: 42,75\ncategoria:: despensa\n',
    )
    await waitFor(
      () => {
        const rows = db.query("SELECT precio_total FROM items WHERE producto = 'Aceite de oliva'")
        return rows.length === 1 && rows[0][0] === 43 ? rows : null
      },
      'modified precio_total (42,75 → 43) visible without restart',
    )
    const rows = db.query("SELECT precio_total FROM items WHERE producto = 'Aceite de oliva'")
    expect(rows).toHaveLength(1)
  })

  it('indexes a newly added compras file without a full rescan', async () => {
    const vault = mkVault()
    seedCompras(vault, '2026-10-15_mercadona.md', '1500')
    await freshModules(vault)
    await db.ensureDb()
    expect((await watcher.startFinanzasWatcher()).started).toBe(true)

    fs.writeFileSync(
      path.join(comprasDir(vault), '2026-10-16_carrefour.md'),
      'fecha:: 2026-10-16\ncomercio:: Carrefour\nproducto:: Yerba mate\ncantidad:: 2\nprecio_total:: 3299,90\n',
    )
    await waitFor(
      () => db.query("SELECT COUNT(*) FROM items WHERE archivo LIKE '%2026-10-16_carrefour.md'")[0]?.[0] > 0,
      'new compras file row appears',
    )
  })

  it('removes rows of a deleted compras file from the running DB', async () => {
    const vault = mkVault()
    seedCompras(vault, '2026-10-15_mercadona.md', '1500')
    seedCompras(vault, '2026-10-16_carrefour.md', '700')
    await freshModules(vault)
    await db.ensureDb()
    expect((await watcher.startFinanzasWatcher()).started).toBe(true)
    expect(db.query('SELECT COUNT(*) FROM items')).toEqual([[2]])

    fs.unlinkSync(path.join(comprasDir(vault), '2026-10-15_mercadona.md'))
    await waitFor(
      () => db.query('SELECT COUNT(*) FROM items')[0]?.[0] === 1,
      'deleted compras file rows disappear',
    )
    expect(db.query("SELECT archivo FROM items WHERE archivo LIKE '%carrefour.md'")).toHaveLength(1)
  })

  it('updates a food_sora slot value changed in a Daily note', async () => {
    const vault = mkVault()
    writeDailyFood(vault, '2026-10-18_domingo.md', '08:15')
    await freshModules(vault)
    await db.ensureDb()
    expect((await watcher.startFinanzasWatcher()).started).toBe(true)
    expect(db.query("SELECT manana FROM food_sora WHERE fecha = '2026-10-18'")).toEqual([['08:15']])

    writeDailyFood(vault, '2026-10-18_domingo.md', '09:30')
    await waitFor(
      () => {
        const rows = db.query("SELECT manana FROM food_sora WHERE fecha = '2026-10-18'")
        return rows.length === 1 && rows[0][0] === '09:30' ? rows : null
      },
      'food_sora slot value updates live',
    )
  })

  it('survives an unreadable compras file: rows intact, error recorded, repair restores', async () => {
    const vault = mkVault()
    seedCompras(vault, '2026-10-15_mercadona.md', '1500')
    seedCompras(vault, '2026-10-16_carrefour.md', '700')
    await freshModules(vault)
    await db.ensureDb()
    expect((await watcher.startFinanzasWatcher()).started).toBe(true)

    // Corrupt: make the file unreadable + bump its mtime so chokidar fires
    // a change event whose incremental read throws EACCES.
    const victim = path.join(comprasDir(vault), '2026-10-15_mercadona.md')
    fs.chmodSync(victim, 0o000)
    fs.utimesSync(victim, new Date(), new Date())

    await waitFor(
      () => {
        const src = db.getInitDiagnostics().sources
        return Object.keys(src).some((k) => k.includes('2026-10-15_mercadona.md') && String(src[k]).includes('error'))
      },
      "sourceStatus records 'error' for the corrupt file",
    )
    // No crash, no collateral damage: the other file's rows stay intact.
    expect(db.query('SELECT COUNT(*) FROM items')).toEqual([[2]])

    // Repair: readable again with new content → rows come back fresh.
    fs.chmodSync(victim, 0o644)
    fs.writeFileSync(victim, 'fecha:: 2026-10-15\ncomercio:: Mercadona\nproducto:: Aceite de oliva\ncantidad:: 1\nprecio_total:: 777\n')
    await waitFor(
      () => {
        const rows = db.query("SELECT precio_total FROM items WHERE archivo LIKE '%2026-10-15_mercadona.md'")
        return rows.length === 1 && rows[0][0] === 777 ? rows : null
      },
      'repaired file rows restored from the repaired content',
    )
  })
})
