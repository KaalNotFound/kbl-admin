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

// --- Parse helpers (used during data ingestion) ---

function parsePrecio(val) {
  if (!val) return 0
  return Math.round(parseFloat(val.replace('€', '').replace('$', '').trim())) || 0
}

function parseCantidad(val) {
  if (!val) return 1
  const n = parseFloat(val.trim())
  return isNaN(n) ? 1 : n
}

function cleanDate(raw) {
  if (!raw) return ''
  return raw.replace(/T.*/, '').slice(0, 10)
}

// --- DB singleton ---

let db = null
let dbInitialized = false
let dbInitFailed = false

function query(sql, params) {
  try {
    const r = db.exec(sql, params)
    return r[0]?.values || []
  } catch { return [] }
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
    noche TEXT DEFAULT ''
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    valor INTEGER NOT NULL,
    ingreso_generado INTEGER DEFAULT 0,
    fecha TEXT NOT NULL
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

  try {
    loadCompras()
    loadFoodSora()
    loadAssets()
    loadWallet()
    dbInitialized = true
  } catch (e) {
    dbInitFailed = true
    console.error('Finanzas DB init error:', e.message)
  }
}

function loadCompras() {
  const files = fs.readdirSync(COMPRAS_DIR).filter(f => f.endsWith('.md'))
  const insert = db.prepare('INSERT INTO items (fecha, comercio, producto, cantidad, precio_total, categoria, archivo) VALUES (?, ?, ?, ?, ?, ?, ?)')
  let itemsOk = 0

  for (const file of files) {
    const content = fs.readFileSync(path.join(COMPRAS_DIR, file), 'utf-8')
    const lines = content.split('\n')
    let ci = {}

    for (const line of lines) {
      const [key, ...valParts] = line.split('::')
      const val = valParts.join('::').trim()
      if (!key) continue
      const k = key.trim().toLowerCase()

      if (k === 'producto') {
        if (ci.producto) {
          insert.run([cleanDate(ci.fecha), ci.comercio || '', ci.producto, ci.cantidad || 1, ci.precio_total || 0, ci.categoria || '', file])
          itemsOk++
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
      insert.run([cleanDate(ci.fecha), ci.comercio || '', ci.producto, ci.cantidad || 1, ci.precio_total || 0, ci.categoria || '', file])
      itemsOk++
    }
  }
  insert.free()
  console.log(`Finanzas DB: ${files.length} tickets, ${itemsOk} items`)
}

function loadFoodSora() {
  const foodFiles = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md'))
  const insertF = db.prepare('INSERT OR REPLACE INTO food_sora (fecha, madrugada, manana, mediodia, tarde, noche) VALUES (?, ?, ?, ?, ?, ?)')
  const fields = ['madrugada_food_sora', 'manana_food_sora', 'mediodia_food_sora', 'tarde_food_sora', 'noche_food_sora']
  const labels = ['madrugada', 'manana', 'mediodia', 'tarde', 'noche']

  for (const file of foodFiles) {
    const content = fs.readFileSync(path.join(DAILY_DIR, file), 'utf-8')
    const date = cleanDate(file)
    const vals = {}
    for (let i = 0; i < fields.length; i++) {
      const rx = new RegExp(`^[ \\t]*-?[ \\t]*${fields[i]}::[ \\t]*(.*)`, 'gm')
      const matches = [...content.matchAll(rx)]
      const last = matches.filter(m => m[1].trim() !== '').pop()
      vals[labels[i]] = last ? last[1].trim() : ''
    }
    insertF.run([date, vals.madrugada, vals.manana, vals.mediodia, vals.tarde, vals.noche])
  }
  insertF.free()
  console.log(`Finanzas DB: ${foodFiles.length} food_sora entries`)
}

function loadAssets() {
  if (!fs.existsSync(PATRIMONIO_DIR)) return
  const assetFiles = fs.readdirSync(PATRIMONIO_DIR).filter(f => f.endsWith('.md'))
  const insertA = db.prepare('INSERT INTO assets (tipo, nombre, valor, ingreso_generado, fecha) VALUES (?, ?, ?, ?, ?)')
  for (const file of assetFiles) {
    const content = fs.readFileSync(path.join(PATRIMONIO_DIR, file), 'utf-8')
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
    if (asset.tipo && asset.nombre) insertA.run([asset.tipo, asset.nombre, asset.valor, asset.ingreso_generado, asset.fecha])
  }
  insertA.free()
  console.log(`Finanzas DB: ${assetFiles.length} assets`)
}

function loadWallet() {
  if (!fs.existsSync(WALLET_PATH)) return
  const wallet = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'))
  const insertI = db.prepare('INSERT INTO income_sources (fuente, monto, tipo, fecha) VALUES (?, ?, ?, ?)')
  for (const entry of wallet.entries) {
    insertI.run([`wallet:${entry.concept}`, entry.amount, 'variable', entry.date])
  }
  insertI.free()
  console.log(`Finanzas DB: ${wallet.entries.length} income entries`)
}

// --- Public API ---

export async function ensureDb() {
  if (dbInitFailed) return false
  if (!dbInitialized) await initDb()
  return dbInitialized
}

export { query, parsePrecio, parseCantidad, cleanDate }
