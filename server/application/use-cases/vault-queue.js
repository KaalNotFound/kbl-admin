/**
 * Queue use cases — Torre vault-helpers (ADR-025, 2026-08-04).
 *
 * Re-capetización de routes/queue.mjs: la lógica de dominio (scan de la cola
 * de procesamiento + hashes vistos) se mueve del handler del router a este
 * use-case. Todo el I/O llega por deps inyectadas (vault) — el router ya no
 * importa lib/ ni fs (boundary §2.1).
 *
 * vault = { VAULT_ROOT, listDir, readFile, fileStat, existsSync } (adapter
 * infrastructure/vault-fs-adapter.mjs, inyectado por el DI container).
 */
import path from 'path';

const QUEUE_SUBDIR = ['07 - SCRIPTS', '_queue'];

/**
 * @param {{ vault: { VAULT_ROOT: string, listDir: Function, readFile: Function, fileStat: Function, existsSync: Function } }} deps
 */
export function createQueueUseCases({ vault }) {
  const { VAULT_ROOT, listDir, readFile, fileStat, existsSync } = vault;

  /**
   * GET /api/queue — pending/done/failed files (50 max done)
   */
  async function getQueue() {
    const queueDir = path.join(VAULT_ROOT, ...QUEUE_SUBDIR);

    const getFiles = (subdir, status) => {
      const dir = path.join(queueDir, subdir);
      if (!existsSync(dir)) return [];
      return listDir(dir)
        .filter((f) => f.name.endsWith('.md') && !f.isDirectory)
        .map((f) => {
          const stat = fileStat(path.join(dir, f.name));
          return {
            name: f.name,
            size: stat?.size || 0,
            modified: stat?.mtime?.toISOString() || '',
            status,
          };
        })
        .sort((a, b) => b.modified.localeCompare(a.modified));
    };

    return {
      pending: getFiles('pending', 'pending'),
      done: getFiles('done', 'done').slice(0, 50),
      failed: getFiles('failed', 'failed'),
    };
  }

  /**
   * GET /api/seen — pipeline seen hashes
   */
  async function getSeen() {
    const seenPath = path.join(VAULT_ROOT, ...QUEUE_SUBDIR, 'seen.json');
    if (!existsSync(seenPath)) return { entries: 0, hashes: [] };
    const seen = JSON.parse(readFile(seenPath));
    const entries = Object.keys(seen).length;
    return {
      entries,
      recent_hashes: Object.entries(seen).slice(-20).map(([k, v]) => ({ hash: k, date: v })),
    };
  }

  return { getQueue, getSeen };
}
