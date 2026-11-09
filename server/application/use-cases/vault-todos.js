/**
 * vault-todos.js — use-case del dominio TODOS + Vault Metrics (Torre vault-helpers, ADR-025)
 *
 * Re-capetización 2026-08-04: migra la lógica del router routes/todos.mjs a
 * application layer con deps inyectadas (vault). El router pasa a ser thin
 * (req.useCases.todos.*). Sin imports de lib/ ni fs — todo el I/O via vault.
 *
 * Hanoi contract (preservado del router): ORIGEN = _PENDING.md + logs (state),
 * DESTINO = dashboard del operador.
 *
 * Phase 4 (write-back): toggleTodo() closes the loop — the operator flips a
 * task's done state from the dashboard and the ONLY edit is that task's
 * state marker inside `_PENDING.md`. Format reality (verified 2026-10-20):
 * the file is SECTION-based (## Title + **Estado:**), not checkbox-per-line,
 * and some sections ALSO carry an Obsidian-native `- [ ]`/`- [x]` line in
 * their body. One done-marker per item, resolved in order:
 *   1. checkbox line inside the item's span → flip ONLY the bracket chars;
 *   2. otherwise the **Estado:** line       → flip ONLY the value segment
 *     (done-family ↔ 'todo'), prefix + trailing whitespace byte-preserved.
 * Everything else in the file stays byte-identical, so the markdown remains
 * the SSOT and external readers (Obsidian, CLI mirrors) see the same data.
 */
import path from 'path'

// --- Pending.md parsing (mirror verbatim de 07 - SCRIPTS/tools/todo-crud.mjs) ---

const STATE_MAP = [
  [/parcialmente completado/i, 'in-progress'],
  [/pendiente|no iniciado|detectado/i, 'todo'],
  [/en progreso|in-progress/i, 'in-progress'],
  [/completado|✅|done|implementado/i, 'done'],
  [/semilla|futuro|plan futuro|backlog/i, 'backlog'],
  [/mejora|review|aprobaci/i, 'review'],
  [/bloqueado|blocked|investigaci/i, 'blocked'],
  [/cancelado|cancelled/i, 'cancelled'],
]

function normalizeState(raw) {
  const text = String(raw ?? '').replace(/\*\*/g, '').trim()
  if (!text) return 'todo'
  for (const [re, state] of STATE_MAP) if (re.test(text)) return state
  return 'todo'
}

function slugify(title, date = '') {
  const clean = title
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
  return `${clean}-${date}`
}

function parseSections(content) {
  const sections = []
  const lines = content.split('\n')
  let current = null
  // Phase 4: stable 0-based line index of each `##` heading. The file is the
  // SSOT and duplicate titles exist, so line-based targeting beats content
  // matching. Line splitting is \n-only and CRLF normalization (readPending)
  // never changes the line count, so indices map 1:1 onto the RAW file bytes.
  lines.forEach((line, index) => {
    const m = line.match(/^##\s+(.+)$/)
    if (m) {
      if (current) sections.push(current)
      current = { title: m[1], body: '', state: null, priority: null, updated: null, line: index }
      return
    }
    if (current) {
      current.body += (current.body ? '\n' : '') + line
      if (!current.state) {
        const sm = line.match(/\*\*Estado:\*\*\s*(.+)/)
        if (sm) current.state = sm[1].trim()
      }
      if (!current.priority) {
        const pm = line.match(/\*\*Prioridad:\*\*\s*(.+)/)
        if (pm) current.priority = pm[1].trim()
      }
      if (!current.updated) {
        const um = line.match(/\*\*Última actualización:\*\*\s*(.+)/)
        if (um) current.updated = um[1].trim()
      }
    }
  })
  if (current) sections.push(current)
  return sections
}

/** Stable item id — same slug the getTodos consumer shape exposes (single source). */
function sectionId(s) {
  return slugify(s.title.split(' (')[0], (s.title.match(/(\d{4}-\d{2}-\d{2})/) || [null, ''])[1])
}

/**
 * createTodosUseCases — factory del dominio TODOS/Vault Metrics.
 * @param {{ VAULT_ROOT: string, readFile: Function, scanAreaRecursive: Function,
 *            writeFileAtomic: Function, obsidianUrl?: Function }} vault
 */
export function createTodosUseCases({ vault }) {
  const { VAULT_ROOT, readFile, scanAreaRecursive, writeFileAtomic, obsidianUrl } = vault

  // Data provenance (Phase 1): exposed SSOT files as {file, obsidian_url}.
  // obsidianUrl is injected via the vault adapter API (no direct lib/ import
  // in the use-case layer); absent in older wirings → sources degrade to [].
  const withProvenance = (vaultRelativePath) => obsidianUrl
    ? [{ file: vaultRelativePath, obsidian_url: obsidianUrl(vaultRelativePath) }]
    : []

  async function readPending() {
    const file = path.join(VAULT_ROOT, '_PENDING.md')
    const content = readFile(file)
    if (content === null) return { sections: [], error: 'no _PENDING.md' }
    // Fix CRLF (2026-08-04): _PENDING.md usa \r\n y `.` de JS no matchea \r —
    // /^##\s+(.+)$/ fallaba contra líneas CRLF → sections=[] SIEMPRE (bug
    // preexistente del router original, enmascarado por el catch). Normalizo.
    return { sections: parseSections(content.replace(/\r\n/g, '\n')), error: null }
  }

  // GET /todos — TODO list from SSOT (state machine + priority)
  async function getTodos() {
    const { sections, error } = await readPending()
    if (error) return { status: 404, error }

    const todos = sections.map((s) => ({
      id: sectionId(s),
      title: s.title,
      state: normalizeState(s.state),
      priority: s.priority ? s.priority.replace(/\*\*/g, '') : 'Baja',
      updated: s.updated || null,
      // Phase 4 (additive): 0-based heading index — stable write-back target
      // when duplicate titles exist. Existing consumers ignore it.
      line: s.line,
    }))

    const countBy = (states) => todos.filter((t) => states.includes(t.state)).length

    return {
      total: todos.length,
      active: todos.filter((t) => !['done', 'cancelled'].includes(t.state)),
      counts: {
        backlog: countBy(['backlog']),
        todo: countBy(['todo']),
        'in-progress': countBy(['in-progress']),
        review: countBy(['review']),
        blocked: countBy(['blocked']),
        done: countBy(['done']),
        cancelled: countBy(['cancelled']),
      },
      sources: withProvenance('_PENDING.md'),
      timestamp: new Date().toISOString(),
    }
  }

  // ─── Phase 4: write-back toggle ───────────────────────────────────────────

  // `## Heading` → `- [ ]`/`- [x]` checkbox line. `[-*]` tolerates `-` and `*`
  // bullets; the inner char is the ONLY byte group that may change.
  const CHECKBOX_RE = /^(\s*[-*]\s+\[)([ xX])(\].*)$/
  // `**Estado:**` line: prefix + value + trailing whitespace (includes \r on
  // CRLF files — the trailing \r is part of group 3 and never rewritten).
  const ESTADO_RE = /^(\s*\*\*Estado:\*\*\s*)(.*?)(\s*)$/

  const isDoneRaw = (raw) => normalizeState(raw) === 'done'

  /**
   * Resolve the target section from an itemRef {id} and/or {line}.
   * Strategy (duplicate-title safe):
   *   - {line}: match by exact heading index; verify id when both fields are
   *     present (a stale line after external edits falls back to id search).
   *   - {id} alone: unique → OK; 0 matches → 'todo not found'; several →
   *     'ambiguous todo match' (the caller should re-send the line).
   */
  function resolveSection(sections, { id, line }) {
    if (Number.isInteger(line)) {
      const byLine = sections.filter((s) => s.line === line)
      if (byLine.length === 1 && (!id || sectionId(byLine[0]) === id)) return byLine[0]
    }
    if (typeof id === 'string' && id.trim()) {
      const matches = sections.filter((s) => sectionId(s) === id)
      if (matches.length === 1) return matches[0]
      if (matches.length > 1) throw new Error('ambiguous todo match')
    }
    throw new Error('todo not found')
  }

  /** Pure: flipped done-marker diagnostics+replacement for ONE raw line. */
  function flipMarker(rawLine) {
    const cb = rawLine.match(CHECKBOX_RE)
    if (cb) {
      const from = cb[2]
      const to = from === 'x' || from === 'X' ? ' ' : 'x'
      return { mode: 'checkbox', from, to, next: `${cb[1]}${to}${cb[3]}` }
    }
    const st = rawLine.match(ESTADO_RE)
    if (st) {
      const from = st[2]
      const to = isDoneRaw(from) ? 'todo' : 'done'
      // A checkbox has two states: done-family collapses to `done`, any
      // other state re-opens as `todo`. Only the value segment changes.
      return { mode: 'estado', from: from.trim(), to, next: `${st[1]}${to}${st[3]}` }
    }
    return null
  }

  /**
   * POST /todos/toggle — surgical write-back into the SSOT _PENDING.md.
   * itemRef = {id} or {line} (or both — both is what the UI sends).
   *
   * Guarantees:
   *   - fresh read every call (the file can change in Obsidian between
   *     renders — no cache);
   *   - EXACTLY the resolved item's state-marker line changes (checkbox
   *     bracket preferred over Estado value); every other byte is preserved,
   *     including \r\n endings;
   *   - atomic write (via the vault port): `<file>.tmp` + rename, owned by
   *     the adapter so a crash mid-write leaves the original intact, never
   *     a half-flipped file;
   *   - mismatch between render and reality → clean 'todo not found' /
   *     'ambiguous todo match'; single documented retry of the read+match+
   *     flip+write cycle on transient I/O failure.
   *
   * @returns {item, sources, toggled} on success; {status, error} otherwise
   *   (mirrors getTodos' {status, error} convention consumed by the router).
   */
  async function toggleTodo(itemRef) {
    const ref = itemRef == null ? {} : itemRef
    const file = path.join(VAULT_ROOT, '_PENDING.md')
    const MAX_ATTEMPTS = 2 // one flip + a single documented retry

    let lastErr = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Fresh read every attempt — no cache, SSOT can change externally.
      const raw = readFile(file)
      if (raw === null) return { status: 404, error: 'no _PENDING.md' }

      try {
        const sections = parseSections(raw.replace(/\r\n/g, '\n'))
        const target = resolveSection(sections, ref)

        // Item span: from its heading line to the next heading (or EOF).
        const nextLine = sections
          .filter((s) => s.line > target.line)
          .reduce((min, s) => Math.min(min, s.line), raw.split('\n').length)
        const rawLines = raw.split('\n')

        // One done-marker per item: checkbox wins over Estado.
        let flip = null
        let flipIndex = -1
        for (let i = target.line; i < nextLine; i++) {
          if (CHECKBOX_RE.test(rawLines[i])) { flip = flipMarker(rawLines[i]); flipIndex = i; break }
        }
        if (!flip) {
          for (let i = target.line; i < nextLine; i++) {
            if (ESTADO_RE.test(rawLines[i])) { flip = flipMarker(rawLines[i]); flipIndex = i; break }
          }
        }
        if (!flip) throw new Error('todo not found') // no toggleable marker

        rawLines[flipIndex] = flip.next

        // Atomic write-back through the vault port (B8): same crash-safe
        // semantics as before (temp file + rename, cleanup on failure),
        // the use-case stays fs-free.
        if (!writeFileAtomic(file, rawLines.join('\n'))) {
          throw new Error('write failed')
        }

        // Refreshed item shape from the post-write parse (falls back to the
        // pre-flip fields if the file changed concurrently during rename).
        const after = readFile(file)
        const refreshed = after !== null
          ? parseSections(after.replace(/\r\n/g, '\n')).find((s) => s.line === target.line)
          : null
        const item = {
          id: sectionId(target),
          title: target.title,
          state: flip.mode === 'checkbox'
            ? normalizeState((refreshed ?? target).state)
            : (refreshed ? normalizeState(refreshed.state) : flip.to),
          priority: target.priority ? target.priority.replace(/\*\*/g, '') : 'Baja',
          updated: target.updated || null,
          line: target.line,
        }

        return { item, sources: withProvenance('_PENDING.md'), toggled: flip }
      } catch (e) {
        // Targeting errors are deterministic — no retry.
        if (e.message === 'todo not found' || e.message === 'ambiguous todo match') {
          return { status: 404, error: e.message }
        }
        lastErr = e
        console.warn('[use-case:todos] toggle attempt failed:', e?.message)
      }
    }
    return { status: 500, error: `Could not toggle todo: ${lastErr?.message || 'write failed'}` }
  }

  // GET /todos/metrics — real-time vault metrics from logs
  async function getMetrics() {    const sysPath = path.join(VAULT_ROOT, '08 - SYSTEM')
    const stateDir = path.join(sysPath, 'state')

    const readJson = (base, rel) => {
      const fp = path.join(base, rel)
      const raw = readFile(fp)
      if (raw === null) return null
      try {
        return JSON.parse(raw)
      } catch (e) {
        console.warn('[use-case:todos] JSON parse failed:', e?.message)
        return null
      }
    }

    const exceptionLog = readJson(stateDir, 'exception-log.json') || []
    const sessionLog = readJson(stateDir, 'session-log.json') || []
    const operationalLog = readJson(path.join(sysPath, 'logs'), 'operational-log.json') || []

    // exception-log aggregation by gate/status
    const byGate = {}
    const byStatus = { fail: 0, warn: 0, registered: 0 }
    for (const e of exceptionLog) {
      byGate[e.gate] = (byGate[e.gate] || 0) + 1
      if (byStatus[e.status] !== undefined) byStatus[e.status]++
    }
    const topGates = Object.entries(byGate).sort((a, b) => b[1] - a[1]).slice(0, 8)

    const sessions = Array.isArray(sessionLog) ? sessionLog
      : (sessionLog && Array.isArray(sessionLog.sessions) ? sessionLog.sessions : [])

    const ops = Array.isArray(operationalLog) ? operationalLog
      : (operationalLog && Array.isArray(operationalLog.traces) ? operationalLog.traces : [])

    return {
      exceptions: {
        total: exceptionLog.length,
        by_status: byStatus,
        top_gates: topGates.map(([gate, count]) => ({ gate, count })),
      },
      sessions: {
        total: sessions.length,
        last: sessions.length ? (sessions[sessions.length - 1].date || sessions[sessions.length - 1].id || '—') : null,
      },
      operational: {
        total: ops.length,
        last: ops.length ? ops[ops.length - 1].seq || ops[ops.length - 1].timestamp : null,
      },
      timestamp: new Date().toISOString(),
    }
  }

  // GET /todos/graph — Mermaid graph of the vault (areas + orphan snapshot)
  async function getGraph() {
    const areas = ['00 - INBOX', '01 - PROYECTOS', '02 - AREAS', '03 - RECURSOS', '04 - ARCHIVOS', '05 - JOURNAL', '08 - SYSTEM']
    const nodes = []

    for (const area of areas) {
      const areaPath = path.join(VAULT_ROOT, area)
      const entries = scanAreaRecursive(areaPath)
      const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.md')).length
      const total = entries.filter((e) => e.type === 'file').length
      nodes.push({ id: area.replace(/\s+/g, '_'), label: area, files, md_notes: files, total_files: total })
    }

    // snapshot orphans/broken from vault-graph gate if exists
    const snapPath = path.join(VAULT_ROOT, '08 - SYSTEM', 'state', 'snapshots', 'vault-graph.json')
    let orphanCount = null
    let brokenCount = null
    const snapRaw = readFile(snapPath)
    if (snapRaw !== null) {
      try {
        const snap = JSON.parse(snapRaw)
        orphanCount = Array.isArray(snap.orphans) ? snap.orphans.length : null
        brokenCount = Array.isArray(snap.broken) ? snap.broken.length : null
      } catch (e) {
        console.warn('[use-case:todos] vault-graph snapshot parse failed:', e?.message)
      }
    }

    const lines = ['graph TD']
    lines.push('  VAULT["🏛 KBL_SYSTEM"]')
    for (const n of nodes) {
      lines.push(`  ${n.id}["${n.label} (${n.md_notes} md)"]`)
      lines.push(`  VAULT --> ${n.id}`)
    }
    if (orphanCount !== null) {
      lines.push(`  ORPHANS["⚠ Huérfanos: ${orphanCount}"]`)
      lines.push('  VAULT -.-> ORPHANS')
    }

    return {
      mermaid: lines.join('\n'),
      nodes,
      orphan_count: orphanCount,
      broken_count: brokenCount,
      timestamp: new Date().toISOString(),
    }
  }

  return { getTodos, toggleTodo, getMetrics, getGraph }
}
