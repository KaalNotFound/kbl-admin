// vault-overview.js — use-case de overview (Torre vault-helpers, ADR-025)
// Lógica movida verbatim del handler original routes/overview.mjs (135L) → factory
// con deps inyectadas. CERO imports de lib/ ni fs — todo el I/O por el adapter.
// Re-capetización 2026-08-04: gate ca-boundaries R1 (routers no importan lib/infra).
import path from 'path';

export function createOverviewUseCases({ vault }) {
  const AREAS = ['00 - INBOX', '01 - PROYECTOS', '02 - AREAS', '03 - RECURSOS', '04 - ARCHIVOS', '05 - JOURNAL', '06 - KBL_INDEX', '08 - SYSTEM'];

  async function getOverview() {
    // defaults a 0: el subdir failed/ puede no existir en _queue (bug
    // preexistente emitía NaN en pipeline.total)
    const { pending = 0, done = 0, failed = 0 } = vault.getQueueCounts();

    const noteCounts = {};
    let totalNotes = 0;
    let inboxUnclassified = 0;

    for (const area of AREAS) {
      const areaPath = path.join(vault.VAULT_ROOT, area);
      // scanAreaRecursive devuelve array plano {name,path,type,depth}
      const entries = vault.scanAreaRecursive(areaPath);
      const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.md')).length;
      noteCounts[area] = { files, note_count: files };
      totalNotes += files;
      if (area === '00 - INBOX') {
        // Count unclassified in inbox
        const inboxPath = path.join(vault.VAULT_ROOT, '00 - INBOX');
        if (vault.existsSync(inboxPath)) {
          const countUnclassified = (dir) => {
            // listDir devuelve [{name, isDirectory}] (firma real del adapter)
            for (const e of vault.listDir(dir)) {
              const fp = path.join(dir, e.name);
              try {
                if (e.isDirectory && !e.name.startsWith('.')) countUnclassified(fp);
                else if (e.name.endsWith('.md') && !vault.readFile(fp).includes('entity_type::')) inboxUnclassified++;
              } catch (e) { console.warn('[use-case:overview] scan read failed:', e?.message); } // Degradation wrapped (Ley ECC E3, ADR-020)
            }
          };
          countUnclassified(inboxPath);
        }
      }
    }

    // Session logs (viven en 08 - SYSTEM/state/)
    const sessionLog = path.join(vault.VAULT_ROOT, '08 - SYSTEM', 'state', 'session-log.json');
    let sessionData = [];
    try {
      const logContent = vault.readFile(sessionLog);
      if (logContent) {
        const parsed = JSON.parse(logContent);
        sessionData = Array.isArray(parsed) ? parsed
          : (parsed && Array.isArray(parsed.sessions) ? parsed.sessions : []);
      }
    } catch { sessionData = []; }

    const lastSession = sessionData.length > 0 ? sessionData[sessionData.length - 1] : null;

    // Thermal log (vive en 08 - SYSTEM/logs/)
    const thermalLog = path.join(vault.VAULT_ROOT, '08 - SYSTEM', 'logs', 'thermal-log.json');
    let thermalData = [];
    try {
      const tContent = vault.readFile(thermalLog);
      if (tContent) {
        thermalData = JSON.parse(tContent);
        if (!Array.isArray(thermalData)) thermalData = [];
      }
    } catch { thermalData = []; }

    // Entity catalog stats
    const catalogPath = path.join(vault.VAULT_ROOT, '07 - SCRIPTS', 'ENTITY_CATALOG.json');
    let catalogEntryCount = 0;
    try {
      const catalog = JSON.parse(vault.readFile(catalogPath));
      catalogEntryCount = Object.keys(catalog).length;
    } catch { catalogEntryCount = 0; }

    // Health status
    const healthIssues = [];
    if (failed > 0) healthIssues.push({ severity: 'error', message: `${failed} procesos fallidos en cola` });
    if (pending > 10) healthIssues.push({ severity: 'warning', message: `${pending} archivos acumulados en pending` });
    if (inboxUnclassified > 0) healthIssues.push({ severity: 'info', message: `${inboxUnclassified} notas sin clasificar en inbox` });
    if (!lastSession) healthIssues.push({ severity: 'warning', message: 'Sin sesiones registradas' });

    const health = healthIssues.length === 0 ? 'good'
      : healthIssues.some(h => h.severity === 'error') ? 'bad' : 'warn';

    return {
      health,
      health_issues: healthIssues,
      vault: {
        total_notes: totalNotes,
        areas: noteCounts,
        inbox_unclassified: inboxUnclassified,
        entity_catalog_entries: catalogEntryCount,
      },
      pipeline: { pending, done, failed, total: pending + done + failed },
      sessions: {
        total: sessionData.length,
        last_session: lastSession ? {
          date: lastSession.date || lastSession.fecha || lastSession.id,
          duration: lastSession.duration || lastSession.duracion || (lastSession.start && lastSession.end ? `${lastSession.start} → ${lastSession.end}` : null),
          status: lastSession.status || lastSession.estado || lastSession.mode,
        } : null,
      },
      thermal: thermalData.slice(-30),
    };
  }

  async function getHealth() {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const { pending = 0, done = 0 } = vault.getQueueCounts();
    return {
      status: 'ok',
      uptime: Math.floor(uptime),
      memory: {
        rss: Math.floor(memUsage.rss / 1024 / 1024),
        heap: Math.floor(memUsage.heapUsed / 1024 / 1024),
      },
      pipeline: { pending, done },
      timestamp: new Date().toISOString(),
    };
  }

  return { getOverview, getHealth };
}
