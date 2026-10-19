/**
 * behavioral.js — Torre behavioral (ADR-025 pattern).
 * Use-case con estado in-memory (sesiones efímeras del server) + reports
 * store-based sobre el behavioral-log.json persistido.
 *
 * Migrado verbatim de lib/behavioral-session.mjs + lib/behavioral-reports.mjs
 * (el barrel lib/behavioral-tracker.mjs queda legacy para backward compat).
 * Sin imports de lib/ ni fs — todo el I/O por deps inyectadas (vault).
 *
 * FIX de path incluido: el legacy construía el store path con __dirname
 * (resolvía a 01 - PROYECTOS/08 - SYSTEM/... — inexistente, load() devolvía
 * vacío silencioso). Acá el path se construye desde vault.VAULT_ROOT →
 * raíz real del vault (08 - SYSTEM/state/behavioral-log.json).
 */
import path from 'path';

export function createBehavioralUseCases({ vault }) {
  // --- Estado in-memory (sesiones efímeras del server, no persistidas) ---
  const sessions = [];
  let currentBlock = null;

  // BLOCKS canónico: los bloques evidenciados por los minutes de
  // daily_summaries del store (estudio/infra/descanso/flex).
  const BLOCKS = Object.freeze({
    estudio: Object.freeze({}),
    infra: Object.freeze({}),
    descanso: Object.freeze({}),
    flex: Object.freeze({}),
  });

  const storePath = () => path.join(vault.VAULT_ROOT, '08 - SYSTEM', 'state', 'behavioral-log.json');

  /**
   * Load persisted store transformed to the daily-shape the reports expect:
   *   data[date] = { sessions: [{start, end, block}], activities, summary }
   * Store legacy (escrito por proceso externo): shape
   *   { sessions: [{started_at, ended_at, block_type, activities}],
   *     daily_summaries: {date: summary} }
   * @returns {Record<string, {sessions: Array, activities: Array, summary: unknown}>}
   */
  function load() {
    const data = {};
    try {
      if (!vault.existsSync(storePath())) return data;
      const store = JSON.parse(vault.readFile(storePath()));
      for (const s of store.sessions || []) {
        const date = (s.started_at || '').slice(0, 10);
        if (!date) continue;
        const day = (data[date] ??= { sessions: [], activities: [], summary: null });
        day.sessions.push({ start: s.started_at, end: s.ended_at || null, block: s.block_type || 'DESCANSO' });
        for (const a of s.activities || []) day.activities.push({ ...a, timestamp: a.started_at });
      }
      for (const [date, summary] of Object.entries(store.daily_summaries || {})) {
        (data[date] ??= { sessions: [], activities: [], summary: null }).summary = summary;
      }
    } catch {
      // store ilegible → data vacío (reports devuelven defaults, no crashean)
    }
    return data;
  }

  // --- In-memory session API (migrada de behavioral-session.mjs) ---

  function startSession(type) {
    const session = {
      type,
      startTime: new Date(),
      endTime: null,
      activities: [],
    };
    sessions.push(session);
    currentBlock = session;
    return session;
  }

  function endSession(sessionId) {
    if (!currentBlock) return null;
    currentBlock.endTime = new Date();
    const closed = currentBlock;
    currentBlock = null;
    return closed;
  }

  function logActivity(sessionId, activity) {
    if (!currentBlock) return null;
    currentBlock.activities.push({
      ...activity,
      timestamp: new Date(),
    });
    return { success: true };
  }

  function getCurrentBlock() {
    return currentBlock;
  }

  // --- Reports store-based (migrados de behavioral-reports.mjs) ---

  function getDailySummary(date) {
    const data = load();
    return data[date] || { sessions: [], activities: [], summary: null };
  }

  function getWeeklySummary() {
    const data = load();
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const daySummary = data[key] || { sessions: [], activities: [] };
      days.push({
        date: key,
        sessions: daySummary.sessions.length,
        activities: daySummary.activities.length,
        summary: daySummary.summary || null,
      });
    }
    return days;
  }

  function getBlockAdherence() {
    const data = load();
    const today = new Date().toISOString().split('T')[0];
    const dayData = data[today] || { sessions: [] };
    const blockStats = {};
    for (const block of Object.keys(BLOCKS)) {
      blockStats[block] = { planned: 1, actual: 0, percentage: 0 };
    }
    for (const session of dayData.sessions) {
      const blockName = session.block || 'DESCANSO';
      if (blockStats[blockName]) blockStats[blockName].actual++;
    }
    for (const block of Object.keys(blockStats)) {
      blockStats[block].percentage = Math.round(
        (blockStats[block].actual / blockStats[block].planned) * 100
      );
    }
    return blockStats;
  }

  function getStreaks() {
    const data = load();
    const dates = Object.keys(data).sort();
    if (dates.length === 0) return { current: 0, longest: 0, total: 0 };
    let current = 0, longest = 0, total = 0, streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) streak++;
      else { longest = Math.max(longest, streak); streak = 1; }
    }
    longest = Math.max(longest, streak);
    const today = new Date().toISOString().split('T')[0];
    if (dates.includes(today)) current = streak;
    total = dates.length;
    return { current, longest, total };
  }

  function getTimeline() {
    const data = load();
    const today = new Date().toISOString().split('T')[0];
    const dayData = data[today] || { sessions: [] };
    return dayData.sessions.map((s) => ({
      start: s.start,
      end: s.end,
      block: s.block || 'DESCANSO',
      duration: s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 60000) : null,
    }));
  }

  return {
    startSession,
    endSession,
    logActivity,
    getCurrentBlock,
    getDailySummary,
    getWeeklySummary,
    getBlockAdherence,
    getStreaks,
    getTimeline,
  };
}
