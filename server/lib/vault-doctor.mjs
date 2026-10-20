// vault-doctor.mjs — Phase 5: Vault Doctor (schema lint per directory).
//
// The finanzas data layer is deliberately TOLERANT: a malformed file never
// throws — its rows are silently skipped and only getInitDiagnostics()
// knows which SOURCE degraded (never which FILE or which LINE). This
// module answers the audit verdict "robust against absence, fragile
// against garbage": it re-reads the four finans source zones fresh and
// lists every finding the tolerant parser would silently swallow, so a
// disorganized user can self-audit exactly which file is broken and why.
//
// Contract (story):
//   scanVault({ vaultRoot, obsidianUrl? }) →
//     {
//       scanned: { compras, food_sora, assets, wallet },  // files linted per zone
//       findings: [{ file, line?, kind, severity, field?, value?, message, obsidian_url }],
//       diagnostics: getInitDiagnostics(),                // runtime DB + watcher status
//     }
//
// Rules (only FILES IN EXPECTED ZONES are linted; unknown files are IGNORED,
// not validated — same trust boundary as the loaders):
//   Compras:    required producto (missing_field, error);
//               fecha bad → bad_date (warn);
//               precio parses to 0 while a producto exists → suspicious_price
//               (warn, mentions the European comma tolerance the loader
//               applies via normalizeNumber);
//               cantidad non-numeric → bad_quantity (warn).
//   Patrimonio: required tipo+nombre (missing_field, error);
//               fecha bad → bad_date (warn);
//               valor parses to 0 → suspicious_value (warn).
//   Daily:      only Daily-looking files (YYYY-MM-DD.md inside Daily/ OR
//               content containing a *_food_sora:: marker); slot values not
//               'H:MM'/'HH:MM' → bad_slot_format (warn) with the field name;
//               same date-from-filename in two files → duplicate_day (warn)
//               per extra file (the loader keeps the LAST row inserted).
//   Wallet:     JSON broken → unreadable_file (error); entries not a list,
//               or an entry missing concept / finite amount → bad_entry
//               (error), one finding per bad entry.
//
// The scan is pure-ish and FRESH every call (no cache): it never mutates
// shared state, never throws (total failure degrades to a zeroed scan),
// and line numbers are 1-based human/editor lines. Per-request cost is
// O(files in the four zones) — an audit page reads the SSOT directly by
// design; document before ever caching.

import path from 'path'
import fs from 'fs'
import { parsePrecio, normalizeNumber, getInitDiagnostics } from './finanzas-db.mjs'
import { obsidianUrl as defaultObsidianUrl } from './obsidian-url.mjs'

// Zone path segments replicated from finanzas-db.mjs / finanzas-watcher.mjs
// (both carry keep-in-sync comments already). Those modules export ONLY
// VAULT_ROOT-bound absolute consts; scanVault parameterizes by vaultRoot
// (temp-vault test harness), so the segments mirror the loader constants
// here. Changing the loader layout? Update these four lines too.
const COMPRAS_SEG = path.join('02 - AREAS', '008 - Trazabilidad Compras', 'Compras')
const PATRIMONIO_SEG = path.join('02 - AREAS', '008 - Trazabilidad Compras', 'Patrimonio')
const DAILY_SEG = path.join('05 - JOURNAL', 'Daily')
const WALLET_SEG = path.join('01 - PROYECTOS', 'AlToquePanama-Pau', 'pau-agent', '_wallet.json')

const WALLET_REL = '01 - PROYECTOS/AlToquePanama-Pau/pau-agent/_wallet.json'

const DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/      // filename AND cleanDate contract
const SLOT_VALUE_RE = /^\d{1,2}:\d{2}$/          // '07:30' / '9:05'

// cleanDate() persists ANY string that merely looks like a date; '2026-10-99'
// has the YYYY-MM-DD shape but months 13+ / days 32+ poison the summaries.
// Calendar plausibility beyond the shape is what the operator can't see.
function isImplausibleDate(raw) {
  const m = raw.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return false // shape failure itself is caught by DATE_PREFIX_RE
  const [, y, mo, d] = m
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  return Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 ||
    date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)
}
// Same inline-field family as parseFoodSoraFile's `fields` array.
const FOOD_FIELDS = [
  'madrugada_food_sora', 'manana_food_sora', 'mediodia_food_sora',
  'tarde_food_sora', 'noche_food_sora',
]

const emptyScan = () => ({
  scanned: { compras: 0, food_sora: 0, assets: 0, wallet: 0 },
  findings: [],
})

/**
 * Run the vault schema lint. Never throws.
 * @param {object} opts
 * @param {string} opts.vaultRoot  absolute vault root to scan
 * @param {(rel: string) => string} [opts.obsidianUrl] provenance helper
 *        (Phase 1); defaults to server/lib/obsidian-url.mjs. Injected so the
 *        route can pass exactly the vaultFsApi-bound helper.
 */
export function scanVault({ vaultRoot, obsidianUrl = defaultObsidianUrl } = {}) {
  // Grace shell: a scan-level failure (vitest racing, dir holed by another
  // process…) degrades to a zeroed scan + diagnostics, never a 500 — same
  // resilience the loaders guarantee per source.
  try {
    const result = scanInner({ vaultRoot: path.resolve(vaultRoot || '') })
    // Provenance deep-link per finding (Phase 1 helper): every row is
    // clickable straight to the broken note in Obsidian.
    for (const f of result.findings) f.obsidian_url = obsidianUrl(f.file)
    return result
  } catch {
    return { ...emptyScan(), diagnostics: getInitDiagnostics() }
  }
}

function scanInner({ vaultRoot }) {
  const findings = []
  const scanned = { compras: 0, food_sora: 0, assets: 0, wallet: 0 }
  const relVault = (absFile) =>
    path.relative(vaultRoot, absFile).split(path.sep).join('/')

  const emit = (absFile, { kind, severity, field, value, line, message }) => {
    findings.push({
      file: relVault(absFile),
      ...(line != null ? { line } : {}),
      kind,
      severity,
      ...(field ? { field } : {}),
      ...(value != null ? { value } : {}),
      message,
    })
  }

  const readMdFiles = (dir) => {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return []
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .map(name => {
        const abs = path.join(dir, name)
        let content = null
        try { content = fs.readFileSync(abs, 'utf-8') } catch { /* → unreadable_file */ }
        return { abs, name, content }
      })
  }

  // ---- Compras ----
  const comprasFiles = readMdFiles(path.join(vaultRoot, COMPRAS_SEG))
  scanned.compras = comprasFiles.length
  for (const file of comprasFiles) {
    if (file.content === null) {
      emit(file.abs, {
        kind: 'unreadable_file', severity: 'error',
        message: "File cannot be read — the tolerant loader drops every row in this note silently",
      })
      continue
    }
    lintCompras(file, emit)
  }

  // ---- Patrimonio ----
  const assetFiles = readMdFiles(path.join(vaultRoot, PATRIMONIO_SEG))
  scanned.assets = assetFiles.length
  for (const file of assetFiles) {
    if (file.content === null) {
      emit(file.abs, {
        kind: 'unreadable_file', severity: 'error',
        message: 'File cannot be read — this asset would be silently missing from Patrimonio',
      })
      continue
    }
    lintAsset(file, emit)
  }

  // ---- Daily / food_sora ----
  const dailyFiles = readMdFiles(path.join(vaultRoot, DAILY_SEG))
  for (const file of dailyFiles) {
    if (file.content === null) continue
    // Only Daily-looking files participate: dated names OR the marker.
    const looksDaily = DATE_PREFIX_RE.test(file.name) || file.content.includes('_food_sora::')
    if (!looksDaily) continue
    scanned.food_sora++
    lintFoodSora(file, emit)
  }
  // duplicate_day: parseFoodSoraFile rows land via INSERT OR REPLACE on a
  // UNIQUE fecha — every file beyond the first with the same date silently
  // overwrites the previous note.
  lintDuplicateDays(dailyFiles, emit)

  // ---- Wallet ----
  const walletPath = path.join(vaultRoot, WALLET_SEG)
  if (fs.existsSync(walletPath)) {
    scanned.wallet = 1
    lintWallet(walletPath, emit)
  }

  return { scanned, findings, diagnostics: getInitDiagnostics() }
}

function lintDuplicateDays(dailyFiles, emit) {
  const dated = dailyFiles.filter(f => f.content !== null && DATE_PREFIX_RE.test(f.name))
  const byDay = new Map()
  for (const f of dated) {
    // loadFoodSora dates from the FILENAME: cleanDate(name).slice(0,10).
    const day = f.name.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(f)
  }
  for (const [day, group] of byDay) {
    for (let i = 1; i < group.length; i++) {
      emit(group[i].abs, {
        kind: 'duplicate_day', severity: 'warn',
        message: `Day ${day} is covered by more than one Daily note — the loader keeps only the last one it reads, so '${group[0].name}' is silently replaced by '${group[i].name}'`,
      })
    }
  }
}

// --- inline-field grammar shared with the loaders (key:: value lines) ---
const parseInlineLines = (content) =>
  content.split('\n').map((line, i) => {
    const sep = line.indexOf('::')
    if (sep === -1) return null
    const rawKey = line.slice(0, sep).trim()
    if (!rawKey) return null
    return { line: i + 1, key: rawKey.toLowerCase(), value: line.slice(sep + 2).trim() }
  }).filter(Boolean)

function lintCompras(file, emit) {
  const entries = parseInlineLines(file.content)
  let hasProductoRow = false     // at least one producto:: with a value
  let hadProductoLine = false
  let firstKeyLine = null
  const ticket = { cantidades: [], precios: [], fechas: [] }

  for (const e of entries) {
    if (firstKeyLine === null) firstKeyLine = e.line
    if (e.key === 'producto') {
      hadProductoLine = true
      if (!e.value) {
        emit(file.abs, {
          kind: 'missing_field', severity: 'error', field: 'producto', line: e.line,
          message: "Empty 'producto::' line — the loader starts an empty item here that never gets inserted",
        })
      } else {
        hasProductoRow = true
      }
    } else if (e.key === 'fecha') {
      ticket.fechas.push(e)
    } else if (e.key === 'cantidad') {
      ticket.cantidades.push(e)
    } else if (e.key === 'precio_total' || e.key === 'precio') {
      ticket.precios.push(e)
    }
  }

  if (!hasProductoRow && !hadProductoLine && entries.length > 0) {
    emit(file.abs, {
      kind: 'missing_field', severity: 'error', field: 'producto',
      line: firstKeyLine,
      message: "Note carries ticket fields but no 'producto::' — loadCompras produces zero rows and the note is silently skipped",
    })
  }
  for (const e of ticket.fechas) {
    if (e.value && (!DATE_PREFIX_RE.test(e.value) || isImplausibleDate(e.value))) {
      emit(file.abs, {
        kind: 'bad_date', severity: 'warn', field: 'fecha', value: e.value, line: e.line,
        message: "Date is not a plausible 'YYYY-MM-DD' — cleanDate() persists the raw string into the DB forever",
      })
    }
  }
  for (const e of ticket.cantidades) {
    if (e.value && !Number.isFinite(normalizeNumber(e.value))) {
      emit(file.abs, {
        kind: 'bad_quantity', severity: 'warn', field: 'cantidad', value: e.value, line: e.line,
        message: "Cantidad is not numeric — the loader silently forces quantity 1",
      })
    }
  }
  if (hasProductoRow) {
    // "precio parses to 0 while producto exists": covers BOTH a gone/garbled
    // value and a real European round-down ('0,40' rounds to 0 in the DB).
    const prices = ticket.precios.map(e => parsePrecio(e.value))
    if (ticket.precios.length === 0 || prices.every(p => p === 0)) {
      const offender = ticket.precios[0]
      emit(file.abs, {
        kind: 'suspicious_price', severity: 'warn',
        field: 'precio_total',
        value: offender?.value,
        line: offender?.line,
        message: offender
          ? `Price parses to 0 (value '${offender.value || 'empty'}'). The loader's European comma tolerance was applied ('24,90' → 24.90, '1.234,56' → 1234.56) — small round-downs like '0,40' and garbled values both land as 0`
          : "Item with no price line — the row lands with precio_total = 0. European comma formats ('24,90') are tolerated by the loader's normalization; check whether that tolerance is hiding a typo'd amount",
      })
    }
  }
}

function lintAsset(file, emit) {
  const entries = parseInlineLines(file.content)
  const rows = { tipo: [], nombre: [], valor: [], fecha: [] }
  for (const e of entries) {
    if (rows[e.key]) rows[e.key].push(e)
  }
  for (const field of ['tipo', 'nombre']) {
    const present = rows[field].some(e => e.value)
    if (!present) {
      // Point at the (empty) inline line when one exists, else file-level.
      const emptyLine = rows[field].find(e => !e.value)
      emit(file.abs, {
        kind: 'missing_field', severity: 'error', field,
        line: emptyLine?.line,
        message: `Required field '${field}' is missing/empty — parseAssetsFile returns null and the whole asset is skipped`,
      })
    }
  }
  for (const e of rows.fecha) {
    if (e.value && (!DATE_PREFIX_RE.test(e.value) || isImplausibleDate(e.value))) {
      emit(file.abs, {
        kind: 'bad_date', severity: 'warn', field: 'fecha', value: e.value, line: e.line,
        message: "Date is not a plausible 'YYYY-MM-DD' — cleanDate() persists the raw string",
      })
    }
  }
  if (rows.valor.some(e => e.value) || entries.length > 0) {
    const valor = rows.valor.length ? parsePrecio(rows.valor[rows.valor.length - 1].value) : 0
    if (valor === 0) {
      const valLine = rows.valor.length ? rows.valor[rows.valor.length - 1].line : undefined
      emit(file.abs, {
        kind: 'suspicious_value', severity: 'warn', field: 'valor',
        value: rows.valor.length ? rows.valor[rows.valor.length - 1].value : undefined,
        line: valLine,
        message: "Value parses to 0 — the asset row lands in Patrimonio with valor = 0 (the loader's comma tolerance is applied; check for a missing or garbled amount)",
      })
    }
  }
}

function lintFoodSora(file, emit) {
  // Same line-grammar as parseFoodSoraFile: '- field:: value' per slot.
  const rx = new RegExp(`^[ \\t]*-?[ \\t]*(${FOOD_FIELDS.join('|')})::[ \\t]*([^\n]*)`)
  file.content.split('\n').forEach((line, i) => {
    const m = line.match(rx)
    if (!m) return
    const [, field, rawValue] = m
    const value = rawValue.trim()
    if (!value) return // empty slot = not eaten, valid absence
    if (!SLOT_VALUE_RE.test(value)) {
      emit(file.abs, {
        kind: 'bad_slot_format', severity: 'warn', field, value, line: i + 1,
        message: `Slot timestamp does not match 'H:MM'/'HH:MM' — the loader stores the raw string in food_sora and the calendar loses its time math`,
      })
    }
  })
}

function lintWallet(walletPath, emit) {
  const emitWallet = (payload) => emit(walletPath, payload)
  let wallet
  try {
    wallet = JSON.parse(fs.readFileSync(walletPath, 'utf-8'))
  } catch (e) {
    emitWallet({
      kind: 'unreadable_file', severity: 'error',
      message: `_wallet.json is not valid JSON — loadWallet degrades the whole income source (${e?.message || 'parse error'})`,
    })
    return
  }
  if (!Array.isArray(wallet.entries)) {
    emitWallet({
      kind: 'bad_entry', severity: 'error', field: 'entries',
      message: '\'_wallet.json\' "entries" is not a list — loadWallet rejects the file and the income source degrades',
    })
    return
  }
  wallet.entries.forEach((entry, idx) => {
    // Same acceptance criteria as loadWallet: string concept + finite amount.
    const okConcept = typeof entry?.concept === 'string' && entry.concept.trim()
    const okAmount = entry?.amount !== null && entry?.amount !== '' &&
      Number.isFinite(Number(entry.amount)) && !Number.isNaN(Number(entry.amount))
    if (okConcept && okAmount) return
    emitWallet({
      kind: 'bad_entry', severity: 'error',
      field: !okConcept ? 'concept' : 'amount',
      value: !okConcept ? JSON.stringify(entry?.concept ?? null) : JSON.stringify(entry?.amount ?? null),
      line: idx + 1,
      message: `entries[${idx}] is missing ${!okConcept ? "'concept'" : "'amount'"} — the loader skips this entry and its income never reaches the dashboard`,
    })
  })
}

// WALLET_REL export kept for docs/UI copy parity with the loader paths.
export { WALLET_REL }
