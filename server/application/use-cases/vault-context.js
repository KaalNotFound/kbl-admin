// vault-context.js — use-case de contexto del sistema (Torre vault-helpers, ADR-025, 2026-08-04)
// Re-capetización: la lógica de routes/context.mjs (GET /logs + GET /context) migra aquí
// como factory con deps inyectadas (vault = API del adapter vault-fs-adapter.mjs).
// Sin imports de lib/ ni fs — todo el I/O por vault.{VAULT_ROOT,listDir,readFile,fileStat,existsSync}.
// FIX listDir (bug preexistente): listDir devuelve [{name,isDirectory}] (NO strings) —
// el router original hacía f.startsWith/f.endsWith sobre objetos → TypeError →
// capture_logs=[] siempre (silencioso) y /context 500 SIEMPRE (filter fuera de try).
import path from 'path';

export function createContextUseCases({ vault }) {
  const systemDir = () => path.join(vault.VAULT_ROOT, '08 - SYSTEM');

  async function getLogs() {
    const sessionLog = path.join(vault.VAULT_ROOT, '08 - SYSTEM', 'state', 'session-log.json');
    let sessions = [];
    try {
      const content = vault.readFile(sessionLog);
      if (content) {
        const parsed = JSON.parse(content);
        sessions = Array.isArray(parsed) ? parsed
          : (parsed && Array.isArray(parsed.sessions) ? parsed.sessions : []);
      }
    } catch (e) { console.warn('[use-case:context] session-log parse failed:', e?.message); } // Degradation wrapped (Ley ECC E3, ADR-020)

    const thermalLog = path.join(vault.VAULT_ROOT, '08 - SYSTEM', 'logs', 'thermal-log.json');
    let thermalReadings = [];
    try {
      const content = vault.readFile(thermalLog);
      if (content) thermalReadings = JSON.parse(content);
    } catch (e) { console.warn('[use-case:context] thermal-log parse failed:', e?.message); } // Degradation wrapped (Ley ECC E3, ADR-020)

    const logsDir = path.join(vault.VAULT_ROOT, '07 - SCRIPTS', '_queue');
    let captureLogs = [];
    try {
      captureLogs = vault.listDir(logsDir)
        .filter((f) => f.name.startsWith('capture_log_'))
        .map((f) => {
          const stat = vault.fileStat(path.join(logsDir, f.name));
          return { name: f.name, size: stat?.size || 0, modified: stat?.mtime?.toISOString() || '' };
        });
    } catch (e) { console.warn('[use-case:context] capture logs listing failed:', e?.message); } // Degradation wrapped (Ley ECC E3, ADR-020)

    return {
      sessions: Array.isArray(sessions) ? sessions.slice(-50) : [],
      thermal: Array.isArray(thermalReadings) ? thermalReadings.slice(-100) : [],
      capture_logs: captureLogs,
    };
  }

  async function getContext() {
    // Parse _PENDIENTES.md
    const pendientesPath = path.join(vault.VAULT_ROOT, '_PENDIENTES.md');
    let pendientes = [];
    if (vault.existsSync(pendientesPath)) {
      const raw = vault.readFile(pendientesPath);
      const sections = raw.split(/(?=^## )/m);
      for (const sec of sections) {
        const titleMatch = sec.match(/^## (.+)/m);
        if (!titleMatch) continue;
        const title = titleMatch[1];
        const priority = (() => {
          if (title.match(/OCR|batch|Tecnico PC/i)) return 'Alta';
          if (title.match(/Encoding|Frases|Baja|Caracteres/i)) return 'Baja';
          return 'Media';
        })();
        const statusMatch = sec.match(/^\*\*Estado:\*\*\s*(.+)/m);
        const status = statusMatch ? statusMatch[1].trim() : 'Pendiente';
        const projectMatch = sec.match(/^\*\*Proyecto:\*\*\s*(.+)/m);
        const project = projectMatch ? projectMatch[1].trim() : '';
        const whatMatch = sec.match(/^\*\*Qu[eé] falta:\*\*\s*(.+)/m);
        const what = whatMatch ? whatMatch[1].trim() : '';
        pendientes.push({ title, priority, status, project, what });
      }
    }

    // Parse _ROADMAP.md
    const roadmapPath = path.join(vault.VAULT_ROOT, '_ROADMAP.md');
    let roadmap = { current: null, pending: [], completed: [] };
    if (vault.existsSync(roadmapPath)) {
      const raw = vault.readFile(roadmapPath);
      const currentMatch = raw.match(/^## Current\s*\n+(.+)/m);
      if (currentMatch) {
        const currentLines = currentMatch[1].split('\n').filter((l) => l.trim() && !l.match(/^---|^## /));
        roadmap.current = currentLines.length > 0 ? currentLines[0].replace(/^\d+\.\s*/, '').trim() : null;
      }
      const pendingItems = raw.matchAll(/^\s*- \[ \]\s*(.+)$/gm);
      roadmap.pending = Array.from(pendingItems, (m) => m[1]);
      const completedItems = raw.matchAll(/^\s*- \[x\]\s*(.+)$/gmi);
      roadmap.completed = Array.from(completedItems, (m) => m[1]);
    }

    // Parse checkpoints (FIX listDir: f.name en filtros/sort/slice)
    const checkpointFiles = vault.listDir(systemDir())
      .filter((f) => f.name.startsWith('CHECKPOINT_') && f.name.endsWith('.md'))
      .sort((a, b) => {
        const dateA = (a.name.match(/(\d{4}-\d{2}-\d{2})/) || ['', '0000-00-00'])[1];
        const dateB = (b.name.match(/(\d{4}-\d{2}-\d{2})/) || ['', '0000-00-00'])[1];
        return dateB.localeCompare(dateA);
      })
      .slice(0, 10);

    const checkpoints = checkpointFiles.map((f) => {
      const content = vault.readFile(path.join(systemDir(), f.name));
      const lines = content.split('\n').filter((l) => l.trim()).length;
      const summaryLines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('---')).slice(0, 3);
      const summary = summaryLines.join(' ').slice(0, 200);
      const dateMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : f.name.replace('CHECKPOINT_', '').replace('.md', '');
      return { date, file: f.name, summary, lines };
    });

    return { pendientes, roadmap, checkpoints };
  }

  return { getLogs, getContext };
}
