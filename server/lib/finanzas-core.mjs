// finanzas-core.mjs — Base compartida: paths, perfil, budget, alias index, mercado-db loader
// Pure functions that operate on query results and config. (Split ADR-024)
import path from 'path'
import fs from 'fs'
import { VAULT_ROOT } from '../infrastructure/vault-fs-adapter.mjs'

export const PRESUPUESTO_STATE = path.join(VAULT_ROOT, '07 - SCRIPTS', '_capture', 'presupuesto-state.json')
export const MERCADO_DB = path.join(VAULT_ROOT, '07 - SCRIPTS', '_capture', '_mercado', 'mercado-db.json')
export const PRESUPUESTO_DIR = path.join(VAULT_ROOT, '02 - AREAS', '008 - Trazabilidad Compras', 'Presupuesto')

// --- Financial profile (loaded from private config) ---

const PERFIL_PATH = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', 'config', 'finanzas-perfil.json')

function loadPerfil() {
  try {
    if (fs.existsSync(PERFIL_PATH)) {
      return JSON.parse(fs.readFileSync(PERFIL_PATH, 'utf8'))
    }
  } catch (e) {
    console.error('Finanzas perfil load error:', e.message)
  }
  return {
    ingresos_mensuales: {},
    gastos_fijos_mensuales: {},
    saldo_default: 0,
  }
}

let PERFIL = null
export function getPerfil() {
  if (!PERFIL) PERFIL = loadPerfil()
  return PERFIL
}

// --- Mercado DB loader (shared — DRY: 4 copias en el monolito → 1) ---

export function loadMercadoDb() {
  try {
    if (fs.existsSync(MERCADO_DB)) {
      return JSON.parse(fs.readFileSync(MERCADO_DB, 'utf8'))
    }
  } catch (e) {
    console.error('Finanzas mercado-db load error:', e.message)
  }
  return null
}

// --- Budget parser ---

export function parseBudget() {
  const budgetFile = path.join(PRESUPUESTO_DIR, '_budget.md')
  if (!fs.existsSync(budgetFile)) return null
  const text = fs.readFileSync(budgetFile, 'utf8')
  const lines = text.split('\n')
  const limites = {}
  for (const line of lines) {
    const m = line.match(/^categoria_limite::\s*(.+):(\d+)/)
    if (m) limites[m[1]] = parseInt(m[2])
  }
  const fijoMatch = text.match(/^presupuesto_fijo::\s*(\d+)/m)
  const ingresoMatch = text.match(/^ingreso_esperado::\s*(\d+)/m)
  return {
    limites,
    presupuesto_fijo: fijoMatch ? parseInt(fijoMatch[1]) : 0,
    ingreso_esperado: ingresoMatch ? parseInt(ingresoMatch[1]) : 0
  }
}

// --- Alias index for mercado search ---

let aliasIndex = null
export function getAliasIndex() {
  if (aliasIndex) return aliasIndex
  const idx = {}
  const dbMercado = loadMercadoDb()
  if (dbMercado?.productos) {
    for (const [producto, data] of Object.entries(dbMercado.productos)) {
      const key = producto.toLowerCase()
      idx[key] = producto
      if (data.aliases) {
        for (const alias of data.aliases) {
          idx[alias.toLowerCase()] = producto
        }
      }
    }
  }
  aliasIndex = idx
  return idx
}
