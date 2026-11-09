// finanzas-db.mjs — SQL.js database layer for finanzas personales
// Handles DB init, schema, data loading from vault files.
import path from 'path'
import fs from 'fs'
import initSqlJs from 'sql.js'
import { VAULT_ROOT } from '../infrastructure/vault-fs-adapter.mjs'

const COMPRAS_DIR = path.join(VAULT_ROOT, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
const DAILY_DIR = path.join(VAULT_ROOT, '05 - JOURNAL', 'Daily')
const PATRIMONIO_DIR = path.join(VAULT_ROOT, '02 - AREAS', '008 - Trazabilidad Compras', 'Patrimonio')
const WALLET_PATH = path.join(VAULT_ROOT, '01 - PROYECTOS', 'AlToquePanama-Pau', 'pau-agent', '_wallet.json')

// Vault-relative provenance path for a file inside a source dir (Phase 1):
// "02 - AREAS/008 - Trazabilidad Compras/Compras/2026-10-15_mercadona.md".
// Forced to '/' so the value is stable across OS + directly joinable to
// VAULT_ROOT when rendering obsidian_url.
const vaultRelative = (dir, file) =>
  path.relative(VAULT_ROOT, path.join(dir, file)).split(path.sep).join('/')

// --- Parse helpers (used during data ingestion) ---
// Vault data is human-written markdown: tolerate both decimal conventions
// ("19,99" European / "19.99" US) and thousands separators ("1.234,56",
// "1,234.56"). The LAST dot-or-comma block is the decimal one (standard
// heuristic; "1.234" is intentionally read as a decimal — see DEVLOG).

function normalizeNumber(raw) {
  if (raw == null) return NaN
  let s = String(raw).replace(/[€$]/g, '').replace(/\s/g, '')
  if (!s) return NaN
  const hasDot = s.includes('.')
  const hasComma = s.includes(',')
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (hasComma) {
    s = s.replace(/,/g, '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}

function parsePrecio(val) {
  const n = normalizeNumber(val)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function parseCantidad(val) {
  const n = normalizeNumber(val)
  return Number.isFinite(n) ? n : 1
}

function cleanDate(raw) {
  if (!raw) return ''
  return raw.replace(/T.*/, '').slice(0, 10)
}

// --- DB singleton ---
// Each vault data source is loaded ISOLATEDLY: a malformed file (e.g. a
// hand-broken _wallet.json) must degrade ONLY that source, never latch the
// whole finanzas layer into a permanent dbInitFailed state. Diagnostics
// stay queryable for future vault-doctor surfaces.

let db = null
let dbInitialized = false
let dbInitFailed = false
const sourceStatus = {}

function query(sql, params) {
  try {
    const r = db.exec(sql, params)
    return r[0]?.values || []
  } catch (e) {
    console.warn('Finanzas query failed:', e?.message)
    return []
  }
}

function getInitDiagnostics() {
  return {
    initialized: dbInitialized,
    initFailed: dbInitFailed,
    sources: { ...sourceStatus },
  }
}

function loadSource(name, fn) {
  try {
    const count = fn()
    sourceStatus[name] = `ok:${count ?? ''}`
  } catch (e) {
    sourceStatus[name] = `error:${e?.message || 'unknown'}`
    console.warn(`Finanzas DB: source '${name}' degraded —`, e?.message)
  }
}

async function initDb() {
  const SQL = await initSqlJs()
  db = new SQL.Database()

  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    comercio TEXT NOT NULL,
    producto TEXT NOT NULL,
    cantidad REAL DEFAULT 1,
    precio_total INTEGER NOT NULL,
    categoria TEXT DEFAULT '',
    archivo TEXT NOT NULL
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS food_sora (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL UNIQUE,
    madrugada TEXT DEFAULT '',
    manana TEXT DEFAULT '',
    mediodia TEXT DEFAULT '',
    tarde TEXT DEFAULT '',
    noche TEXT DEFAULT '',
    archivo TEXT DEFAULT ''
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    valor INTEGER NOT NULL,
    ingreso_generado INTEGER DEFAULT 0,
    fecha TEXT NOT NULL,
    archivo TEXT DEFAULT ''
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS income_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fuente TEXT NOT NULL,
    monto INTEGER NOT NULL,
    tipo TEXT DEFAULT 'fijo',
    fecha TEXT NOT NULL
  )`)

  db.run('DELETE FROM items')
  db.run('DELETE FROM food_sora')
  db.run('DELETE FROM assets')
  db.run('DELETE FROM income_sources')

  // Structural setup succeeded — the DB is usable even if every vault
  // source is garbage. Each loader degrades independently.
  loadSource('compras', loadCompras)
  loadSource('food_sora', loadFoodSora)
  loadSource('assets', loadAssets)
  loadSource('wallet', loadWallet)
  dbInitialized = true
}

// --- Per-file parsers (single source of truth for full loads AND live sync) ---
// Phase 2 live sync: these take a file's CONTENT and its vault-relative
// provenance path and return parsed row objects, so the full-directory
// loaders and the chokidar watcher (finanzas-watcher.mjs) never diverge.

/**
 * Parse one compras ticket note into item rows.
 * Inline-field logic extracted from loadCompras — behavior identical:
 * each `producto::` line starts a new item; keys after it fill that item;
 * a `precio_total::`/`precio::` BEFORE a producto still applies to it
 * (waits), matching the original loop's state machine.
 */
function parseComprasFile(content, relArchivo) {
  const rows = []
  const lines = content.split('\n')
  let ci = {}

  for (const line of lines) {
    const [key, ...valParts] = line.split('::')
    const val = valParts.join('::').trim()
    if (!key) continue
    const k = key.trim().toLowerCase()

    if (k === 'producto') {
      if (ci.producto) {
        rows.push({ fecha: cleanDate(ci.fecha), comercio: ci.comercio || '', producto: ci.producto, cantidad: ci.cantidad || 1, precio_total: ci.precio_total || 0, categoria: ci.categoria || '', archivo: relArchivo })
      }
      ci = { ...ci, producto: val, cantidad: 1, precio_total: 0, categoria: '' }
    } else if (k === 'fecha' && val) {
      ci.fecha = cleanDate(val)
    } else if (k === 'comercio' && val) {
      ci.comercio = val
    } else if (k === 'cantidad') {
      ci.cantidad = parseCantidad(val)
    } else if (k === 'precio_total') {
      ci.precio_total = parsePrecio(val)
    } else if (k === 'precio') {
      ci.precio_total = parsePrecio(val)
    } else if (k === 'categoria') {
      ci.categoria = val
    }
  }
  if (ci.producto) {
    rows.push({ fecha: cleanDate(ci.fecha), comercio: ci.comercio || '', producto: ci.producto, cantidad: ci.cantidad || 1, precio_total: ci.precio_total || 0, categoria: ci.categoria || '', archivo: relArchivo })
  }
  return rows
}

// B7 perf: the five field regexes are constants — hoisted to module scope so
// files stop building 5 `new RegExp` per parse. Reuse is safe: matchAll()
// clones the regex and never advances the shared object's lastIndex (still
// reset defensively before each use, /g regexes are stateful).
const FOOD_SORA_FIELDS = ['madrugada_food_sora', 'manana_food_sora', 'mediodia_food_sora', 'tarde_food_sora', 'noche_food_sora']
const FOOD_SORA_LABELS = ['madrugada', 'manana', 'mediodia', 'tarde', 'noche']
const FOOD_SORA_REGEXPS = FOOD_SORA_FIELDS.map(
  (field) => new RegExp(`^[ \\t]*-?[ \\t]*${field}::[ \\t]*(.*)`, 'gm')
)

/**
 * Parse one Daily note's food_sora slot fields into one table row.
 * The date comes from the FILENAME (same`cleanDate(file)` heuristic as
 * the full loader), not from frontmatter.
 */
function parseFoodSoraFile(content, fileName, relArchivo) {
  const vals = {}
  for (let i = 0; i < FOOD_SORA_FIELDS.length; i++) {
    const rx = FOOD_SORA_REGEXPS[i]
    rx.lastIndex = 0 // stateful /g — always start fresh
    const matches = [...content.matchAll(rx)]
    const last = matches.filter(m => m[1].trim() !== '').pop()
    vals[FOOD_SORA_LABELS[i]] = last ? last[1].trim() : ''
  }
  return { fecha: cleanDate(fileName), ...vals, archivo: relArchivo }
}

/**
 * Parse one Patrimonio asset note into a row, or null when tipo/nombre
 * are missing (same filter as the full loader).
 */
function parseAssetsFile(content, relArchivo) {
  const lines = content.split('\n')
  const asset = { tipo: '', nombre: '', valor: 0, ingreso_generado: 0, fecha: '' }
  for (const line of lines) {
    const [key, ...valParts] = line.split('::')
    const val = valParts.join('::').trim()
    if (!key) continue
    const k = key.trim().toLowerCase()
    if (k === 'tipo') asset.tipo = val
    else if (k === 'nombre') asset.nombre = val
    else if (k === 'valor') asset.valor = parsePrecio(val)
    else if (k === 'ingreso_generado') asset.ingreso_generado = parsePrecio(val)
    else if (k === 'fecha') asset.fecha = cleanDate(val)
  }
  if (!asset.tipo || !asset.nombre) return null
  return { ...asset, archivo: relArchivo }
}

function loadCompras() {
  // Fresh clones / new vaults may not have the Compras folder yet — an
  // unguarded readdirSync threw ENOENT, initDb latched dbInitFailed and
  // every downstream search/summary degraded forever (see DEVLOG 2026-10-19).
  if (!fs.existsSync(COMPRAS_DIR)) return
  const files = fs.readdirSync(COMPRAS_DIR).filter(f => f.endsWith('.md'))
  const insert = db.prepare('INSERT INTO items (fecha, comercio, producto, cantidad, precio_total, categoria, archivo) VALUES (?, ?, ?, ?, ?, ?, ?)')
  let itemsOk = 0

  for (const file of files) {
    const content = fs.readFileSync(path.join(COMPRAS_DIR, file), 'utf-8')
    const rows = parseComprasFile(content, vaultRelative(COMPRAS_DIR, file))
    for (const r of rows) {
      insert.run([r.fecha, r.comercio, r.producto, r.cantidad, r.precio_total, r.categoria, r.archivo])
      itemsOk++
    }
  }
  insert.free()
  console.log(`Finanzas DB: ${files.length} tickets, ${itemsOk} items`)
}

function loadFoodSora() {
  if (!fs.existsSync(DAILY_DIR)) return
  const foodFiles = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md'))
  const insertF = db.prepare('INSERT OR REPLACE INTO food_sora (fecha, madrugada, manana, mediodia, tarde, noche, archivo) VALUES (?, ?, ?, ?, ?, ?, ?)')

  for (const file of foodFiles) {
    const content = fs.readFileSync(path.join(DAILY_DIR, file), 'utf-8')
    const row = parseFoodSoraFile(content, file, vaultRelative(DAILY_DIR, file))
    insertF.run([row.fecha, row.madrugada, row.manana, row.mediodia, row.tarde, row.noche, row.archivo])
  }
  insertF.free()
  console.log(`Finanzas DB: ${foodFiles.length} food_sora entries`)
}

function loadAssets() {
  if (!fs.existsSync(PATRIMONIO_DIR)) return
  const assetFiles = fs.readdirSync(PATRIMONIO_DIR).filter(f => f.endsWith('.md'))
  const insertA = db.prepare('INSERT INTO assets (tipo, nombre, valor, ingreso_generado, fecha, archivo) VALUES (?, ?, ?, ?, ?, ?)')
  for (const file of assetFiles) {
    const content = fs.readFileSync(path.join(PATRIMONIO_DIR, file), 'utf-8')
    const row = parseAssetsFile(content, vaultRelative(PATRIMONIO_DIR, file))
    if (row) insertA.run([row.tipo, row.nombre, row.valor, row.ingreso_generado, row.fecha, row.archivo])
  }
  insertA.free()
  console.log(`Finanzas DB: ${assetFiles.length} assets`)
}

function loadWallet() {
  if (!fs.existsSync(WALLET_PATH)) return 0
  let wallet
  try {
    wallet = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'))
  } catch (e) {
    throw new Error(`_wallet.json is not valid JSON — ${e.message}`)
  }
  if (!Array.isArray(wallet.entries)) {
    throw new Error('_wallet.json "entries" is not a list')
  }
  const insertI = db.prepare('INSERT INTO income_sources (fuente, monto, tipo, fecha) VALUES (?, ?, ?, ?)')
  let loaded = 0
  for (const entry of wallet.entries) {
    const concept = typeof entry?.concept === 'string' && entry.concept.trim() ? entry.concept.trim() : null
    const amount = Number.isFinite(Number(entry?.amount)) && entry?.amount !== null && entry?.amount !== '' && !Number.isNaN(Number(entry.amount)) ? Number(entry.amount) : NaN
    if (!concept || !Number.isFinite(amount)) continue
    insertI.run([`wallet:${concept}`, amount, 'variable', cleanDate(entry.date || '') || ''])
    loaded++
  }
  insertI.free()
  console.log(`Finanzas DB: ${loaded} income entries`)
  return loaded
}

// --- Live-sync (Phase 2) single-file incremental upserts ---
// The chokidar watcher (finanzas-watcher.mjs) calls these per fs event:
// re-parse ONE file, delete its rows by provenance path, insert fresh
// ones. No full rescan. Every helper is individually guarded — a bad
// file degrades ONLY itself (recorded as `<source>:<basename>` in
// sourceStatus) and never crashes the process nor latches dbInitFailed.

function exec(sql, params) {
  db.run(sql, params)
}

// Provenance-path deletion: exact current relative path (the watcher's
// case), any `*/<basename>` variant, plus the bare-basename heuristic for
// legacy rows written before Phase 1 normalized paths.
function deleteProvenanceRows(table, relArchivo, basename) {
  exec(`DELETE FROM ${table} WHERE archivo = ? OR archivo LIKE ? OR archivo = ?`, [relArchivo, `%/${basename}`, basename])
}

function upsertComprasFile(absPath) {
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return
  const rel = vaultRelative(COMPRAS_DIR, name)
  try {
    const rows = parseComprasFile(fs.readFileSync(absPath, 'utf-8'), rel)
    exec('DELETE FROM items WHERE archivo = ?', [rel])
    const insert = db.prepare('INSERT INTO items (fecha, comercio, producto, cantidad, precio_total, categoria, archivo) VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const r of rows) insert.run([r.fecha, r.comercio, r.producto, r.cantidad, r.precio_total, r.categoria, r.archivo])
    insert.free()
    console.log(`Finanzas watcher: compras '${name}' re-indexed (${rows.length} items)`)
  } catch (e) {
    // Deliberately swallow: stale rows stay intact, the error is visible
    // in diagnostics and the next successful event repairs the file.
    sourceStatus[`compras:${name}`] = `error:${e?.message || 'unknown'}`
    console.warn(`Finanzas watcher: upsert failed for '${name}' —`, e?.message)
  }
}

function removeComprasFile(absPath) {
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return
  deleteProvenanceRows('items', vaultRelative(COMPRAS_DIR, name), name)
}

function upsertFoodSoraFile(absPath) {
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return
  const rel = vaultRelative(DAILY_DIR, name)
  try {
    const row = parseFoodSoraFile(fs.readFileSync(absPath, 'utf-8'), name, rel)
    deleteProvenanceRows('food_sora', rel, name)
    exec('INSERT OR REPLACE INTO food_sora (fecha, madrugada, manana, mediodia, tarde, noche, archivo) VALUES (?, ?, ?, ?, ?, ?, ?)', [row.fecha, row.madrugada, row.manana, row.mediodia, row.tarde, row.noche, row.archivo])
    console.log(`Finanzas watcher: food_sora '${name}' re-indexed`)
  } catch (e) {
    sourceStatus[`food_sora:${name}`] = `error:${e?.message || 'unknown'}`
    console.warn(`Finanzas watcher: upsert failed for '${name}' —`, e?.message)
  }
}

function removeFoodSoraFile(absPath) {
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return
  deleteProvenanceRows('food_sora', vaultRelative(DAILY_DIR, name), name)
}

function upsertAssetsFile(absPath) {
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return
  const rel = vaultRelative(PATRIMONIO_DIR, name)
  try {
    const rows = [parseAssetsFile(fs.readFileSync(absPath, 'utf-8'), rel)].filter(Boolean)
    exec('DELETE FROM assets WHERE archivo = ?', [rel])
    const insert = db.prepare('INSERT INTO assets (tipo, nombre, valor, ingreso_generado, fecha, archivo) VALUES (?, ?, ?, ?, ?, ?)')
    for (const r of rows) insert.run([r.tipo, r.nombre, r.valor, r.ingreso_generado, r.fecha, r.archivo])
    insert.free()
    console.log(`Finanzas watcher: assets '${name}' re-indexed (${rows.length} rows)`)
  } catch (e) {
    sourceStatus[`assets:${name}`] = `error:${e?.message || 'unknown'}`
    console.warn(`Finanzas watcher: upsert failed for '${name}' —`, e?.message)
  }
}

function removeAssetsFile(absPath) {
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return
  deleteProvenanceRows('assets', vaultRelative(PATRIMONIO_DIR, name), name)
}

function clearWalletRows() {
  exec("DELETE FROM income_sources WHERE fuente LIKE 'wallet:%'")
}

function refreshWallet() {
  try {
    // Wallet re-loads are NOT keyed by provenance path (income_sources has
    // no archivo column) — the `wallet:` fuente prefix is the namespace.
    clearWalletRows()
    const count = loadWallet()
    sourceStatus.wallet = `ok:${count ?? ''}`
  } catch (e) {
    sourceStatus.wallet = `error:${e?.message || 'unknown'}`
    console.warn('Finanzas watcher: wallet refresh failed —', e?.message)
  }
}

// --- Public API ---

export async function ensureDb() {
  if (dbInitFailed) return false
  if (!dbInitialized) await initDb()
  return dbInitialized
}

export {
  query,
  parsePrecio,
  parseCantidad,
  cleanDate,
  normalizeNumber,
  getInitDiagnostics,
  parseComprasFile,
  parseFoodSoraFile,
  parseAssetsFile,
  upsertComprasFile,
  removeComprasFile,
  upsertFoodSoraFile,
  removeFoodSoraFile,
  upsertAssetsFile,
  removeAssetsFile,
  clearWalletRows,
  refreshWallet,
}
