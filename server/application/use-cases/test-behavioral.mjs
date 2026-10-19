/**
 * Behavioral Use Case Tests — Torre behavioral (ADR-025 pattern).
 * Red-first (ADR-044): este test existe ANTES del use-case.
 * Run: node server/application/use-cases/test-behavioral.mjs
 *
 * Cubre: estado in-memory (session API) + reports store-based con
 * deps inyectadas (vault stub) — sin imports de lib/ (R2 ca-boundaries).
 */
import { createBehavioralUseCases } from './behavioral.js';

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS: ' + name);
  } catch (e) {
    fail++;
    console.error('  FAIL: ' + name + ' - ' + e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

const TODAY = new Date().toISOString().split('T')[0];

const FAKE_STORE = {
  sessions: [
    { started_at: TODAY + 'T10:00:00Z', ended_at: TODAY + 'T10:30:00Z', block_type: 'estudio', activities: [{ type: 'code' }] },
    { started_at: TODAY + 'T11:00:00Z', ended_at: null, block_type: 'descanso', activities: [] },
  ],
  daily_summaries: { [TODAY]: { minutes: 45 } },
};

function makeVault(storeExists = true, store = FAKE_STORE) {
  return {
    VAULT_ROOT: 'C:/vault',
    existsSync: () => storeExists,
    readFile: () => JSON.stringify(store),
  };
}

console.log('\n--- In-memory session API ---');

test('startSession crea sesión y la setea como currentBlock', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const s = uc.startSession('estudio');
  assert(s && s.type === 'estudio' && Array.isArray(s.activities));
  assert(uc.getCurrentBlock() === s, 'currentBlock debe apuntar a la sesión nueva');
});

test('endSession sin sesión activa devuelve null (router → 404)', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  assert(uc.endSession('no-existe') === null);
});

test('endSession cierra la sesión activa y limpia currentBlock', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const s = uc.startSession('estudio');
  const closed = uc.endSession(s);
  assert(closed && closed.endTime instanceof Date);
  assert(uc.getCurrentBlock() === null, 'currentBlock debe quedar null');
});

test('logActivity sin sesión activa devuelve null', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  assert(uc.logActivity('x', { type: 'code' }) === null);
});

test('logActivity con sesión activa agrega actividad con timestamp', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  uc.startSession('estudio');
  const r = uc.logActivity('x', { type: 'code', target: 'test' });
  assert(r && r.success === true);
  const block = uc.getCurrentBlock();
  assert(block.activities.length === 1);
  assert(block.activities[0].type === 'code');
  assert(block.activities[0].timestamp instanceof Date);
});

console.log('\n--- Reports store-based (deps inyectadas) ---');

test('getDailySummary lee el store del día y expone sesiones + summary', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const day = uc.getDailySummary(TODAY);
  assert(day.sessions.length === 2, 'esperaba 2 sesiones, obtuvo ' + day.sessions.length);
  assert(day.summary && day.summary.minutes === 45);
  assert(day.sessions[0].start === TODAY + 'T10:00:00Z');
  assert(day.sessions[0].block === 'estudio', 'block_type debe mapearse a block');
});

test('getDailySummary sin store devuelve defaults vacíos (no crashea)', () => {
  const uc = createBehavioralUseCases({ vault: makeVault(false) });
  const day = uc.getDailySummary('2099-01-01');
  assert(day.sessions.length === 0 && day.summary === null);
});

test('getWeeklySummary devuelve 7 días con conteos', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const days = uc.getWeeklySummary();
  assert(days.length === 7, 'debe haber 7 días');
  assert(days.some((d) => d.date === TODAY), 'la fecha de hoy debe estar');
  const today = days.find((d) => d.date === TODAY);
  assert(today.sessions === 2 && today.activities === 1);
});

test('getStreaks con 1 día (hoy) → current 1 (hoy presente = streak activo, fiel al legacy)', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const s = uc.getStreaks();
  assert(s.total === 1, 'total debe ser 1');
  assert(s.longest === 1);
  assert(s.current === 1, 'hoy presente → current debe ser 1 (comportamiento legacy)');
});

test('getBlockAdherence cuenta sesiones del día por bloque', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const stats = uc.getBlockAdherence();
  assert(stats.estudio.actual === 1 && stats.estudio.percentage === 100);
  assert(stats.descanso.actual === 1);
  assert(stats.flex.actual === 0);
});

test('getTimeline mapea sesiones del día con duración', () => {
  const uc = createBehavioralUseCases({ vault: makeVault() });
  const timeline = uc.getTimeline();
  assert(timeline.length === 2);
  const first = timeline[0];
  assert(first.block === 'estudio');
  assert(first.duration === 30, '10:00→10:30 = 30 min, obtuvo ' + first.duration);
});

console.log('\n--- Results: ' + pass + ' passed, ' + fail + ' failed ---');
process.exit(fail > 0 ? 1 : 0);
