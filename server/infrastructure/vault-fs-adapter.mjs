import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Vault root: server/infrastructure/ -> server/ -> KBL_Admin/ -> 01 - PROYECTOS/ -> KBL_SYSTEM/
// (Torre vault-helpers ADR-025: movido desde lib/vault-helpers.mjs — misma
//  profundidad (hermanos bajo server/), 4 niveles hacia KBL_SYSTEM)
export const VAULT_ROOT = path.resolve(__dirname, '..', '..', '..', '..')

// --- Shared constants (DRY: STUDY_PATH was defined 3x across study, active-recall, mastery) ---
export const STUDY_PATH = path.resolve(VAULT_ROOT, '02 - APRENDIZAJE', 'MoureDev-Master')
export const ACTIVE_RECALL_DIR = path.join(STUDY_PATH, '_campus', '_active_recall')
export const FEEDBACK_DIR = path.join(ACTIVE_RECALL_DIR, '_feedback_requests')
export const QUEUE_DIR = path.join(VAULT_ROOT, '07 - SCRIPTS', '_queue')

// --- Core filesystem utilities ---

/**
 * List directory entries (non-recursive, filtered to .md files and subdirs)
 */
export function listDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile() || e.isDirectory())
      .map(e => ({ name: e.name, isDirectory: e.isDirectory() }))
  } catch (e) {
    console.error('[vault] listDir: error reading', dir, e.message)
    return []
  }
}

/**
 * Read a file as UTF-8 text, returns null on error
 */
export function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error('[vault] readFile: error reading', filePath, e.message)
    return null
  }
}

/**
 * Get file stats (size, mtime), returns null on error
 */
export function fileStat(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return { size: stat.size, mtime: stat.mtime }
  } catch (e) {
    return null
  }
}

/**
 * Full file info for recursive scans (sub-torre inventory, ADR-025): isDirectory
 * + mtime + birthtime, returns null on error. listDir da isDirectory por entry
 * pero no birthtime; statSync directo tampoco está expuesto — este wrapper evita
 * que el use-case importe fs (regla R2).
 */
export function fileInfo(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return {
      isDirectory: stat.isDirectory(),
      mtime: stat.mtime,
      birthtime: stat.birthtime || null,
    }
  } catch (e) {
    return null
  }
}

/**
 * Check if a path exists (fs.existsSync wrapper — Torre vault-helpers, ADR-025)
 */
export function existsSync(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch (e) {
    return false
  }
}

/**
 * Ensure a directory exists (recursive mkdir)
 */
export function ensureDir(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  } catch (e) {
    console.error('[vault] ensureDir: error creating', dirPath, e.message)
    return false
  }
}

/**
 * Write a file as UTF-8 (sub-torre inventory, ADR-025), returns bool
 */
export function writeFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (e) {
    console.error('[vault] writeFile: error writing', filePath, e.message)
    return false
  }
}

/**
 * Generate a URL-safe slug from text
 */
export function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Collect all .md files recursively from a directory
 * Returns array of { name, fullPath, relativePath }
 */
export function collectStudyFiles(dir, prefix = '') {
  const results = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const name = entry.name
      if (entry.isDirectory()) {
        results.push(...collectStudyFiles(path.join(dir, name), prefix + name + '/'))
        continue
      }
      if (!name.endsWith('.md')) continue
      if (name === 'Enganche_KBL.md' || name === 'INDEX.md') continue
      results.push({ name: prefix + name, fullPath: path.join(dir, name) })
    }
  } catch (e) {
    console.warn('[vault] collectStudyFiles: error scanning', dir, e.message)
  }
  return results
}

/**
 * Scan area recursively up to maxDepth levels
 * Returns array of { name, path, type, depth }
 */
export function scanAreaRecursive(dir, depth = 0, maxDepth = 3) {
  const results = []
  if (depth > maxDepth) return results
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      results.push({
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        depth
      })
      if (entry.isDirectory()) {
        results.push(...scanAreaRecursive(entryPath, depth + 1, maxDepth))
      }
    }
  } catch (e) {
    console.warn('[vault] scanAreaRecursive: error scanning', dir, e.message)
  }
  return results
}

/**
 * Get counts of queued items per category
 * Torre vault-helpers (ADR-025, 2026-08-04): default queueDir = QUEUE_DIR —
 * el router original llamaba sin args y sin default devolvía {} siempre
 * (bug preexistente: pipeline del overview roto silenciosamente).
 */
export function getQueueCounts(queueDir = QUEUE_DIR) {
  const counts = {}
  try {
    if (!fs.existsSync(queueDir)) return counts
    const entries = fs.readdirSync(queueDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(queueDir, entry.name)
        const files = fs.readdirSync(subPath).filter(f => f.endsWith('.md'))
        counts[entry.name] = files.length
      }
    }
  } catch (e) {
    console.warn('[vault] getQueueCounts: error', e.message)
  }
  return counts
}

/**
 * Build inline-fields frontmatter block (key:: value per line, no YAML delimiters).
 * Accepts keys with or without the trailing '::' suffix (normalizes).
 * Materialized 2026-08-01 (Hanoi fix): study-service.mjs imported this symbol from
 * here but it was never exported (SIMBOLO_FANTASMA_COMPARTIDO pattern).
 * @param {Record<string, string|number>} fields
 * @returns {string}
 */
export function buildFrontmatter(fields) {
  return Object.entries(fields || {})
    .map(([k, v]) => {
      const key = k.endsWith('::') ? k : `${k}::`
      return `${key} ${v ?? ''}`
    })
    .join('\n')
}

/**
 * Parse inline-fields frontmatter (key:: value) at the start of a note.
 * Falls back to YAML frontmatter (--- ... ---) when no inline fields found.
 * @param {string} content
 * @returns {Record<string, string>}
 */
export function parseFrontmatter(content) {
  const fm = {}
  if (!content) return fm
  const head = content.split('\n').slice(0, 20).join('\n')
  const inlineRe = /^([\w][\w-]*?)\s*::\s*(.+)$/gm
  let m
  let inlineCount = 0
  while ((m = inlineRe.exec(head)) !== null) {
    fm[m[1]] = m[2].trim()
    inlineCount++
  }
  if (inlineCount > 0) return fm
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3)
    if (end !== -1) {
      const yaml = content.slice(3, end).trim()
      for (const line of yaml.split('\n')) {
        const mm = line.match(/^(\w[\w-]*?):\s*(.+)$/)
        if (!mm) continue
        fm[mm[1]] = mm[2].trim().replace(/^['"](.*)['"]$/, '$1')
      }
    }
  }
  return fm
}
