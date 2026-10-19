/**
 * Global Search — Use Cases (search across vault + app data)
 *
 * Powers GET /api/global-search (TopBar palette, "Buscar... Ctrl+K").
 * Searches vault notes (filename + content), projects, study concepts
 * (mastery store), todos and the entity catalog; returns grouped results
 * where every item carries a `tab` field for frontend navigation.
 *
 * All I/O goes through injected ports (vault adapters, stores) — no direct
 * infrastructure imports (boundary §2.1, same pattern as the other vault-* towers).
 */

import path from 'path'

const MAX_PER_GROUP = 6
const MIN_QUERY_LENGTH = 2

function snippetAround(content, term) {
  const idx = content.toLowerCase().indexOf(term)
  if (idx === -1) return ''
  const start = Math.max(0, idx - 40)
  return (start > 0 ? '…' : '') + content.slice(start, idx + term.length + 60).replace(/\s+/g, ' ').trim() + (idx + term.length + 60 < content.length ? '…' : '')
}

function scanNotes(deps, term) {
  const { vault, vaultRoot } = deps
  const out = []
  function walk(dir, depth) {
    if (out.length >= MAX_PER_GROUP || depth > 4) return
    for (const entry of vault.listDir(dir)) {
      if (out.length >= MAX_PER_GROUP) return
      const full = path.join(dir, entry.name)
      if (entry.isDirectory) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name.startsWith('_queue')) continue
        walk(full, depth + 1)
        continue
      }
      if (!entry.name.endsWith('.md')) continue
      const title = entry.name.replace(/\.md$/, '')
      if (title.toLowerCase().includes(term)) {
        out.push({ title, path: path.relative(vaultRoot, full), tab: 'study', kind: 'nota', snippet: '' })
        continue
      }
      // bounded content search for non-title matches
      try {
        const content = vault.readFile(full)
        if (content && content.toLowerCase().includes(term)) {
          out.push({ title, path: path.relative(vaultRoot, full), tab: 'study', kind: 'nota', snippet: snippetAround(content, term) })
        }
      } catch (e) { /* unreadable file — skip */ }
    }
  }
  walk(vaultRoot, 0)
  if (process.env.NODE_ENV !== 'production') console.log(`[global-search] notes scan: ${out.length} matches for "${term}"`)
  return out.slice(0, MAX_PER_GROUP)}

export function createGlobalSearchUseCases({ vault, projects, todos, mastery, entities }) {
  /**
   * GET /api/global-search?q=...
   * Returns { query, total, groups: [{ type, label, items: [{ title, tab, kind, ... }] }] }
   */
  async function search(rawQuery) {
    const query = (rawQuery || '').toString().trim()
    if (query.length < MIN_QUERY_LENGTH) return { query, total: 0, groups: [] }

    const term = query.toLowerCase()
    const groups = []

    // Notes — vault markdown (demo-vault or real vault via VAULT_ROOT)
    try {
      const notes = scanNotes({ vault, vaultRoot: vault.VAULT_ROOT }, term)
      if (notes.length) groups.push({ type: 'notes', label: 'Notas', items: notes })
    } catch (e) {
      console.error('[global-search] notes scan failed:', e?.message)
    }

    // Projects — getProjects() → [{ name/title?, description }]
    try {
      const data = await projects.getProjects()
      const items = (data.projects || [])
        .filter((p) =>
          (p.name || '').toLowerCase().includes(term) ||
          (p.description || '').toLowerCase().includes(term))
        .slice(0, MAX_PER_GROUP)
        .map((p) => ({ title: p.name || p.title || p.dir || 'Proyecto', path: p.dir || '', tab: 'projects', kind: p.status || 'proyecto', meta: p.description || '' }))
      if (items.length) groups.push({ type: 'projects', label: 'Proyectos', items })
    } catch (e) { /* projects group optional */ }

    // Study concepts — mastery store
    try {
      const concepts = mastery.getAllMastery() || []
      const items = concepts
        .filter((c) =>
          (c.concept || '').toLowerCase().includes(term) ||
          (c.module || '').toLowerCase().includes(term))
        .slice(0, MAX_PER_GROUP)
        .map((c) => ({ title: c.concept, tab: 'study', kind: 'concepto', meta: `${c.module || 'estudio'} · nivel ${c.level}` }))
      if (items.length) groups.push({ type: 'concepts', label: 'Conceptos', items })
    } catch (e) { /* concepts group optional */ }

    // Todos — getTodos() returns { active?, items?... } — normalize
    try {
      const data = await todos.getTodos()
      const list = Array.isArray(data) ? data : (data.active || data.items || data.todos || [])
      const items = list
        .filter((t) =>
          (t.title || t.text || '').toLowerCase().includes(term))
        .slice(0, MAX_PER_GROUP)
        .map((t) => ({ title: t.title || t.text, tab: 'todos', kind: t.status || 'tarea', meta: t.status || '' }))
      if (items.length) groups.push({ type: 'todos', label: 'TODO', items })
    } catch (e) { /* todos group optional */ }

    // Entity catalog
    try {
      const catalog = await entities.getEntityCatalog() || []
      const items = catalog
        .filter((en) =>
          (en.name || '').toLowerCase().includes(term) ||
          (en.type || '').toLowerCase().includes(term))
        .slice(0, MAX_PER_GROUP)
        .map((en) => ({ title: en.name, tab: 'entities', kind: en.type || 'entidad', meta: `${en.notes || 0} notas` }))
      if (items.length) groups.push({ type: 'entities', label: 'Entities', items })
    } catch (e) { /* entities group optional */ }

    const total = groups.reduce((acc, g) => acc + g.items.length, 0)
    return { query, total, groups }
  }

  return { search }
}
