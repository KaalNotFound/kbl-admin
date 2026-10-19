// vault-projects.js — use-case de proyectos (Torre vault-helpers, ADR-025, 2026-08-04)
// Re-capetización: la lógica del handler GET /api/projects (routes/projects.mjs) se
// movió acá como factory con deps inyectadas (vault). CERO imports de lib/ ni fs —
// todo el I/O por el adapter (regla R1: router NO importa lib; R2: application no
// instancia adapters — las deps llegan por factory).
// Fix dentro de la torre (bug preexistente listDir): el router original hacía
// path.join(dir, entry) con entry-objeto {name,isDirectory} → TypeError → catch del
// router → 500 silencioso; y scanProjectFiles NUNCA recolectaba archivos (allFiles=[]).
// Ahora se usa entry.name / entry.isDirectory — el endpoint queda destrabado.

import path from 'path'

const SEVEN_DAYS = 7 * 86400000

// Escaneo recursivo de archivos de un proyecto (sin node_modules ni dotfiles)
function scanProjectFiles(dir, vault, acc) {
  for (const entry of vault.listDir(dir)) {
    const fp = path.join(dir, entry.name)
    if (entry.isDirectory) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) scanProjectFiles(fp, vault, acc)
    } else {
      acc.push(entry.name)
    }
  }
}

export function createProjectsUseCases({ vault }) {
  return {
    // GET /api/projects — scan 01 - PROYECTOS/
    async getProjects() {
      const projectsDir = path.join(vault.VAULT_ROOT, '01 - PROYECTOS')
      const dirs = vault.listDir(projectsDir).filter(
        (d) => d.isDirectory && !d.name.startsWith('_') && d.name !== '_archived' && d.name !== '_lib'
      )

      const projects = dirs.map((d) => {
        const projectPath = path.join(projectsDir, d.name)

        const allFiles = []
        scanProjectFiles(projectPath, vault, allFiles)

        const mdFiles = allFiles.filter((f) => f.endsWith('.md'))
        let status = 'unknown'
        let lastUpdate = ''
        let description = ''
        let hasAgents = false
        let stack = []

        const fileLookup = {}
        for (const f of mdFiles) fileLookup[f.toLowerCase()] = f

        const pkgPath = path.join(projectPath, 'package.json')
        if (vault.existsSync(pkgPath)) {
          status = 'active'
          try {
            const pkg = JSON.parse(vault.readFile(pkgPath))
            if (pkg.dependencies) stack = Object.keys(pkg.dependencies).slice(0, 8)
          } catch (e) { console.warn('[use-case:projects] package.json malformed:', e?.message); } // Degradation wrapped (Ley ECC E3, ADR-020)
        }

        let mainContent = ''
        let mainFile = ''
        if (fileLookup['readme.md']) {
          mainFile = fileLookup['readme.md']
          mainContent = vault.readFile(path.join(projectPath, mainFile))
        } else if (fileLookup['agents.md']) {
          mainFile = fileLookup['agents.md']
          hasAgents = true
          mainContent = vault.readFile(path.join(projectPath, mainFile))
        }

        if (mainContent) {
          const statusMatch = mainContent.match(/status["']?\s*[:=]\s*["'](\w+)["']/i)
            || mainContent.match(/^status::\s*(\w+)/m)
            || mainContent.match(/^estado::\s*(\w+)/m)
          if (statusMatch) status = statusMatch[1]

          const descMatch = mainContent.match(/^description::\s*(.+)/m)
            || mainContent.match(/^descripcion::\s*(.+)/m)
            || mainContent.match(/^purpose::\s*(.+)/m)
          if (descMatch) {
            description = descMatch[1].slice(0, 120)
          } else {
            const headingMatch = mainContent.match(/^#\s+(.+)/m)
            if (headingMatch) description = headingMatch[1].slice(0, 120)
          }

          const stat = vault.fileStat(path.join(projectPath, mainFile))
          lastUpdate = stat ? stat.mtime.toISOString() : ''
        } else {
          const stat = vault.fileStat(projectPath)
          lastUpdate = stat ? stat.mtime.toISOString() : ''
        }

        if (status === 'unknown' && lastUpdate) {
          const age = Date.now() - new Date(lastUpdate).getTime()
          if (age < 7 * 86400000) status = 'active'
          else if (age < 30 * 86400000) status = 'low'
          else status = 'inactive'
        }
        if (status === 'unknown') status = 'inactive'

        return {
          name: d.name,
          status,
          last_update: lastUpdate,
          description,
          stack,
          has_agents: hasAgents,
          files_count: allFiles.length,
        }
      })

      const rank = { active: 0, low: 1, inactive: 2, unknown: 3 }
      projects.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))

      const now = Date.now()
      const stalled = projects.filter((p) => {
        if (!p.last_update) return false
        const age = now - new Date(p.last_update).getTime()
        return age > SEVEN_DAYS && (p.status === 'low' || p.status === 'inactive')
      })

      return { projects, stalled }
    },
  }
}
