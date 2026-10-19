/**
 * Behavioral Session — In-memory session state for time-blocking.
 * Tracks current block, session history, and activity log.
 * 
 * Replaces the missing module referenced by behavioral-tracker.mjs.
 */

const sessions = [];
let currentBlock = null;

function startSession(type) {
  const session = {
    type,
    startTime: new Date(),
    endTime: null,
    activities: []
  };
  sessions.push(session);
  currentBlock = session;
  return session;
}

function endSession() {
  if (currentBlock) {
    currentBlock.endTime = new Date();
    currentBlock = null;
  }
}

function logActivity(activity) {
  if (currentBlock) {
    currentBlock.activities.push({
      ...activity,
      timestamp: new Date()
    });
  }
}

function getCurrentBlock() {
  return currentBlock;
}

function getBlockAdherence() {
  if (!currentBlock) return null;
  const elapsed = Date.now() - currentBlock.startTime.getTime();
  return {
    type: currentBlock.type,
    elapsed,
    activityCount: currentBlock.activities.length
  };
}

// --- Persisted store bridge (Hanoi fix 2026-08-01) ---
// behavioral-reports.mjs consumes a daily store `data[date] = {sessions, activities, summary}`.
// The real persisted store is 08 - SYSTEM/state/behavioral-log.json (legacy, written by an
// external process; shape { sessions: [{started_at, ended_at, block_type, activities}],
// daily_summaries: {date: summary} }). BLOCKS are the canonical blocks evidenced by the
// daily_summaries minutes (estudio/infra/descanso/flex).

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, '..', '..', '..', '08 - SYSTEM', 'state', 'behavioral-log.json');

export const BLOCKS = Object.freeze({
  estudio: Object.freeze({}),
  infra: Object.freeze({}),
  descanso: Object.freeze({}),
  flex: Object.freeze({}),
});

/**
 * Load persisted store transformed to the daily-shape the reports expect:
 *   data[date] = { sessions: [{start, end, block}], activities, summary }
 * @returns {Record<string, {sessions: Array, activities: Array, summary: unknown}>}
 */
export function load() {
  const data = {};
  try {
    if (!existsSync(STORE_PATH)) return data;
    const store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
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

export { getCurrentBlock, startSession, endSession, logActivity, getBlockAdherence };
