// finanzas-watcher.mjs — Phase 2: live vault sync for the finanzas DB.
//
// The SQL.js DB in finanzas-db.mjs is a startup snapshot: a full vault
// scan runs at boot and Obsidian edits are invisible until restart. This
// module closes that gap with chokidar:
//
//   - Watches DIRECTORIES (never individual files): Compras, Patrimonio,
//     Daily (food_sora) and the pau-agent dir that holds _wallet.json.
//   - Ignores dotfiles (.obsidian/, hidden), only `.md` tickets are
//     relevant (wallet excepted).
//   - `ignoreInitial` + `awaitWriteFinish` (250ms stability / 100ms poll)
//     because Obsidian autosaves in chunks — file events settle first.
//   - Per-path ~1200ms debounce, LAST-EVENT-WINS: a burst of changs on
//     the same file coalesces into one incremental upsert.
//   - Incremental single-file upsert (re-parse that file only: delete its
//     rows by `archivo` provenance path, insert fresh ones) — no full
//     rescan ever.
//   - Every apply is guarded: a bad file degrades only itself (visible in
//     getInitDiagnostics().sources) and never crashes the process.
//
// Kill switch: KBL_WATCH=0 disables startup (useful in CI where no vault
// events are expected).

import path from 'node:path'
import fs from 'node:fs'
import { watch as chokidarWatch } from 'chokidar'
import { VAULT_ROOT } from '../infrastructure/vault-fs-adapter.mjs'
import {
  ensureDb,
  upsertComprasFile,
  removeComprasFile,
  upsertFoodSoraFile,
  removeFoodSoraFile,
  upsertAssetsFile,
  removeAssetsFile,
  clearWalletRows,
  refreshWallet,
} from './finanzas-db.mjs'

// Same source dirs as finanzas-db.mjs — keep in sync.
const COMPRAS_DIR = path.join(VAULT_ROOT, '02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
const DAILY_DIR = path.join(VAULT_ROOT, '05 - JOURNAL', 'Daily')
const PATRIMONIO_DIR = path.join(VAULT_ROOT, '02 - AREAS', '008 - Trazabilidad Compras', 'Patrimonio')
const WALLET_PATH = path.join(VAULT_ROOT, '01 - PROYECTOS', 'AlToquePanama-Pau', 'pau-agent', '_wallet.json')

// Obsidian autosaves in chunks (~2s); 1200ms coalesces bursts while a
// single edit lands fast enough to still feel instant.
const DEBOUNCE_MS = 1200
const AWAIT_WRITE_FINISH = { stabilityThreshold: 250, pollInterval: 100 }
const IGNORE_HIDDEN = /(^|[/\\])\../ // dotfiles, e.g. .obsidian/, .trash/

let watcher = null
let started = false
// path → {timer, kind} — one pending apply per watched path
const pending = new Map()

/**
 * Classify a watched path into a data source. Returns null for anything
 * outside the four recognized sources (dotfiles never reach here).
 */
function classifyPath(absPath) {
  if (absPath === WALLET_PATH) return 'wallet'
  const name = path.basename(absPath)
  if (!name.endsWith('.md')) return null
  const inside = (dir) => absPath.startsWith(dir + path.sep)
  if (inside(COMPRAS_DIR)) return 'compras'
  if (inside(DAILY_DIR)) return 'food_sora'
  if (inside(PATRIMONIO_DIR)) return 'assets'
  return null
}

/**
 * Apply one debounced event. Wrapped in try/catch: a handler throwing
 * must log + degrade, never crash the process. Handlers themselves are
 * also individually guarded (stale rows stay intact on a bad file).
 */
function applyEvent(absPath, kind) {
  const source = classifyPath(absPath)
  if (!source) return
  try {
    if (source === 'compras') {
      kind === 'remove' ? removeComprasFile(absPath) : upsertComprasFile(absPath)
    } else if (source === 'food_sora') {
      kind === 'remove' ? removeFoodSoraFile(absPath) : upsertFoodSoraFile(absPath)
    } else if (source === 'assets') {
      kind === 'remove' ? removeAssetsFile(absPath) : upsertAssetsFile(absPath)
    } else if (source === 'wallet') {
      // Rename = unlink + add: 'remove' wipes wallet rows; the follow-up
      // 'add' re-loads them, so the pair converges even mid-rename.
      kind === 'remove' ? clearWalletRows() : refreshWallet()
    }
  } catch (e) {
    console.warn(`Finanzas watcher: failed to apply ${kind} to '${absPath}' —`, e?.message || e)
  }
}

/**
 * Per-path debounce, LAST-EVENT-WINS: an add/change supersedes a pending
 * remove and vice versa — only the latest event for a path matters.
 */
function scheduleApply(absPath, kind) {
  const previous = pending.get(absPath)
  if (previous) clearTimeout(previous.timer)
  const timer = setTimeout(() => {
    pending.delete(absPath)
    applyEvent(absPath, kind)
  }, DEBOUNCE_MS)
  // timer.unref? keep process alive is fine (persistent watcher anyway)
  pending.set(absPath, { timer, kind })
}

/**
 * Start the finances live sync. Idempotent, fire-and-forget friendly:
 * resolves `{started, reason?|dirs}`, never throws for expected decline
 * paths; a chokidar init error rejects via 'error' (callers should
 * .catch — boot must not depend on the watcher).
 */
export async function startFinanzasWatcher() {
  if (process.env.KBL_WATCH === '0') {
    return { started: false, reason: 'watch-disabled' }
  }
  if (started) {
    return { started: false, reason: 'already-started' }
  }
  // Claim the flag BEFORE awaiting ensureDb so concurrent callers cannot
  // both pass the guard and spawn duplicate watchers.
  started = true

  const dbReady = await ensureDb()
  if (!dbReady) {
    started = false
    console.warn('Finanzas watcher: not started — db init failed')
    return { started: false, reason: 'db-init-failed' }
  }

  // Directory-level watching (validated pattern from obsidian-brain /
  // Cairn / vault indexers): individual-file watches break on Obsidian's
  // atomic-save renames.
  const watchPaths = [COMPRAS_DIR, PATRIMONIO_DIR, DAILY_DIR, path.dirname(WALLET_PATH)].filter((p) => fs.existsSync(p))
  watcher = chokidarWatch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: AWAIT_WRITE_FINISH,
    ignored: IGNORE_HIDDEN,
  })

  watcher.on('add', (p) => scheduleApply(p, 'upsert'))
  watcher.on('change', (p) => scheduleApply(p, 'upsert'))
  watcher.on('unlink', (p) => scheduleApply(p, 'remove'))
  watcher.on('error', (err) => console.warn('Finanzas watcher: chokidar error —', err?.message || err))

  // Awaiting the initial scan keeps behavior deterministic: adds inside
  // the scan window are not silently dropped (ignoreInitial) — callers
  // editing right after this promise resolves get their events delivered.
  const instance = watcher
  await new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (!settled) {
        settled = true
        resolve()
      }
    }
    instance.once('ready', finish)
    // Watcher closed while initializing must not hang the caller.
    const poll = setInterval(() => {
      if (watcher !== instance) {
        clearInterval(poll)
        finish()
      }
    }, 100)
    instance.once('error', () => {
      clearInterval(poll)
      finish()
    })
  })

  console.log(`Finanzas watcher: watching ${watchPaths.length} vault directories`)
  return { started: true, dirs: watchPaths }
}

/**
 * Stop watching + clear pending debounces (deterministic tests, hot
 * reloads). Sync by contract; the chokidar close completes async.
 */
export function stopFinanzasWatcher() {
  for (const { timer } of pending.values()) clearTimeout(timer)
  pending.clear()
  if (watcher) {
    const instance = watcher
    watcher = null
    instance.close().catch((e) => console.warn('Finanzas watcher: close failed —', e?.message || e))
  }
}

/**
 * Clear the module-level started flag (tests + hot reloads). Call after
 * stopFinanzasWatcher.
 */
export function _resetWatcherForTest() {
  started = false
}
