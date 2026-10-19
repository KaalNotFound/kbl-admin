/**
 * vault-todos.js — use-case del dominio TODOS + Vault Metrics (Torre vault-helpers, ADR-025)
 *
 * Re-capetización 2026-08-04: migra la lógica del router routes/todos.mjs a
 * application layer con deps inyectadas (vault). El router pasa a ser thin
 * (req.useCases.todos.*). Sin imports de lib/ ni fs — todo el I/O via vault.
 *
 * Hanoi contract (preservado del router): ORIGEN = _PENDING.md + logs (state),
 * DESTINO = dashboard del operador.
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
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)$/)
    if (m) {
      if (current) sections.push(current)
      current = { title: m[1], body: '', state: null, priority: null, updated: null }
      continue
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
  }
  if (current) sections.push(current)
  return sections
}

/**
 * createTodosUseCases — factory del dominio TODOS/Vault Metrics.
 * @param {{ VAULT_ROOT: string, readFile: Function, scanAreaRecursive: Function }} vault
 */
export function createTodosUseCases({ vault }) {
  const { VAULT_ROOT, readFile, scanAreaRecursive } = vault

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
      id: slugify(s.title.split(' (')[0], (s.title.match(/(\d{4}-\d{2}-\d{2})/) || [null, ''])[1]),
      title: s.title,
      state: normalizeState(s.state),
      priority: s.priority ? s.priority.replace(/\*\*/g, '') : 'Baja',
      updated: s.updated || null,
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
      timestamp: new Date().toISOString(),
    }
  }

  // GET /todos/metrics — real-time vault metrics from logs
  async function getMetrics() {
    const sysPath = path.join(VAULT_ROOT, '08 - SYSTEM')
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

  return { getTodos, getMetrics, getGraph }
}
