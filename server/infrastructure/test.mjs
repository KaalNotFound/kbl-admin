/**
 * Infrastructure Adapter Tests
 * Run: node server/infrastructure/test.mjs
 *
 * Torre test-infra (ADR-025, 2026-08-04): los helpers fs se definen LOCALES
 * (node:fs) — el test ya no importa 07 - SCRIPTS/lib/io.mjs (capa cruzada
 * cross-project, violación R3 del gate ca-boundaries). El test es autónomo.
 */
import { existsSync, readFileSync, unlinkSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CircuitBreaker, CircuitOpenError, retryWithJitter } from '../lib/circuit-breaker.js';
import { VaultFileSystemAdapter } from './vault-filesystem-adapter.js';
import { JsonFileMasteryStore } from './json-file-mastery-store.js';
import { OutboxEventBus } from './outbox-event-bus.js';

// ── Helpers fs locales (antes importados de 07 - SCRIPTS/lib/io.mjs) ──────────
function fileExists(p) {
  try { return existsSync(p); } catch { return false; }
}
function readText(p) {
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}
function removeFile(p) {
  try {
    if (!existsSync(p)) return false;
    unlinkSync(p);
    return true;
  } catch { return false; }
}
function removeDir(p) {
  try {
    if (!existsSync(p)) return false;
    rmSync(p, { recursive: true, force: true });
    return true;
  } catch { return false; }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// --- CircuitBreaker ---
console.log('\n--- CircuitBreaker ---');
test('starts in CLOSED state', () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });
  assert(cb.state === 'CLOSED');
});

test('trips to OPEN after threshold failures', async () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3, resetTimeout: 60000 });
  for (let i = 0; i < 3; i++) {
    try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
  }
  assert(cb.state === 'OPEN');
});

test('rejects calls when OPEN', async () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, resetTimeout: 60000 });
  try { await cb.execute(() => Promise.reject(new Error('fail'))); } catch {}
  try {
    await cb.execute(() => Promise.resolve('ok'));
    assert(false, 'Should have thrown CircuitOpenError');
  } catch (e) {
    assert(e instanceof CircuitOpenError);
  }
});

test('passes through successful calls', async () => {
  const cb = new CircuitBreaker({ name: 'test' });
  const result = await cb.execute(() => Promise.resolve(42));
  assert(result === 42);
});

test('resets failure count on success', async () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });
  try { await cb.execute(() => Promise.reject(new Error('e'))); } catch {}
  try { await cb.execute(() => Promise.reject(new Error('e'))); } catch {}
  await cb.execute(() => Promise.resolve('ok')); // reset
  assert(cb.failureCount === 0);
  assert(cb.state === 'CLOSED');
});

test('reset() manually restores CLOSED', async () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1 });
  try { await cb.execute(() => Promise.reject(new Error('e'))); } catch {}
  assert(cb.state === 'OPEN');
  cb.reset();
  assert(cb.state === 'CLOSED');
});

// --- retryWithJitter ---
console.log('\n--- retryWithJitter ---');
test('retries on failure and eventually succeeds', async () => {
  let attempts = 0;
  const result = await retryWithJitter(
    () => { attempts++; if (attempts < 3) throw new Error('not yet'); return 'done'; },
    { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 50 }
  );
  assert(result === 'done' && attempts === 3);
});

test('throws after exhausting retries', async () => {
  try {
    await retryWithJitter(
      () => { throw new Error('always fail'); },
      { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 50 }
    );
    assert(false, 'Should have thrown');
  } catch (e) {
    assert(e.message === 'always fail');
  }
});

// --- VaultFileSystemAdapter (uses temp dir) ---
console.log('\n--- VaultFileSystemAdapter ---');
const tmpDir = path.join(__dirname, '_test_tmp_vault');
const adapter = new VaultFileSystemAdapter(tmpDir);

test('ensureDir creates directory', async () => {
  const r = await adapter.ensureDir('test/sub/dir');
  assert(r.isSuccess);
  assert(fileExists(path.join(tmpDir, 'test/sub/dir')));
});

test('write creates file', async () => {
  const r = await adapter.write('test/sub/hello.md', '# Hello');
  assert(r.isSuccess);
  assert(readText(path.join(tmpDir, 'test/sub/hello.md')) === '# Hello');
});

test('read returns file content', async () => {
  const r = await adapter.read('test/sub/hello.md');
  assert(r.isSuccess && r.value === '# Hello');
});

test('read returns NotFoundError for missing file', async () => {
  const r = await adapter.read('test/nonexistent.md');
  assert(r.isFailure);
  assert(r.error.name === 'NotFoundError');
});

test('exists returns true for existing file', async () => {
  const r = await adapter.exists('test/sub/hello.md');
  assert(r.isSuccess && r.value === true);
});

test('exists returns false for missing file', async () => {
  const r = await adapter.exists('test/nope.md');
  assert(r.isSuccess && r.value === false);
});

test('listFiles returns files', async () => {
  const r = await adapter.listFiles('test/sub');
  assert(r.isSuccess && r.value.includes('hello.md'));
});

// Cleanup
removeDir(tmpDir);

// --- JsonFileMasteryStore ---
console.log('\n--- JsonFileMasteryStore ---');
const tmpStore = path.join(__dirname, '_test_tmp_mastery.json');
const store = new JsonFileMasteryStore(tmpStore);

test('save + load round-trips', async () => {
  const saveR = await store.save('a1b2c3d4e5f6a7b8', { scoreHistory: [{score:80,ts:'2026-01-01'}], level: 2 });
  assert(saveR.isSuccess);
  const loadR = await store.load('a1b2c3d4e5f6a7b8');
  assert(loadR.isSuccess);
  assert(loadR.value.level === 2 && loadR.value.scoreHistory.length === 1);
});

test('load returns empty for unknown concept', async () => {
  const r = await store.load('0000000000000000');
  assert(r.isSuccess && r.value.level === 0);
});

test('loadAll returns Map', async () => {
  const r = await store.loadAll();
  assert(r.isSuccess && r.value instanceof Map);
  assert(r.value.has('a1b2c3d4e5f6a7b8'));
});

removeFile(tmpStore);

// --- OutboxEventBus ---
console.log('\n--- OutboxEventBus ---');
const tmpOutbox = path.join(__dirname, '_test_tmp_outbox.json');
const bus = new OutboxEventBus(tmpOutbox);

test('publish stores event', async () => {
  const r = await bus.publish({ type: 'test.event', aggregateId: 'a1', payload: { x: 1 } });
  assert(r.isSuccess);
  assert(typeof r.value === 'string'); // event ID
});

test('getPending returns undelivered events', async () => {
  const r = await bus.getPending();
  assert(r.isSuccess && r.value.length === 1);
  assert(r.value[0].type === 'test.event');
});

test('markDelivered removes from pending', async () => {
  const pending = await bus.getPending();
  const eventId = pending.value[0].id;
  const r = await bus.markDelivered(eventId);
  assert(r.isSuccess);
  const after = await bus.getPending();
  assert(after.value.length === 0);
});

removeFile(tmpOutbox);

console.log('\n--- Results: ' + pass + ' passed, ' + fail + ' failed ---');
process.exit(fail > 0 ? 1 : 0);
