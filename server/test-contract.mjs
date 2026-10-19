/**
 * FASE 7: Contract Tests — Adapter ↔ Port Validation
 *
 * Validates that each infrastructure adapter satisfies its port interface.
 * These tests verify the CONTRACT (return types, shapes), not implementation details.
 *
 * Run: node server/test-contract.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VaultFileSystemAdapter } from './infrastructure/vault-filesystem-adapter.js';
import { JsonFileMasteryStore } from './infrastructure/json-file-mastery-store.js';
import { OutboxEventBus } from './infrastructure/outbox-event-bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS: ' + name);
  } catch (e) {
    fail++;
    failures.push({ name, error: e.message });
    console.error('  FAIL: ' + name + ' — ' + e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertIsResult(val) {
  assert(val !== null && val !== undefined, 'Expected Result object');
  assert(typeof val.isSuccess === 'boolean', 'Result must have isSuccess');
  assert(typeof val.isFailure === 'boolean', 'Result must have isFailure');
  assert(val.isSuccess !== val.isFailure, 'isSuccess and isFailure must be opposites');
}

function assertOk(result, msg) {
  assertIsResult(result);
  assert(result.isSuccess, msg || 'Expected Result.ok');
}

function assertFail(result, msg) {
  assertIsResult(result);
  assert(result.isFailure, msg || 'Expected Result.fail');
}

// ============================================================
// ContentStore CONTRACT → VaultFileSystemAdapter
// ============================================================
console.log('\n=== ContentStore Contract → VaultFileSystemAdapter ===');

const CS_TMP = path.join(__dirname, '_contract_vault');
const cs = new VaultFileSystemAdapter(CS_TMP);

test('interface: has all required methods', () => {
  assert(typeof cs.write === 'function', 'write');
  assert(typeof cs.read === 'function', 'read');
  assert(typeof cs.exists === 'function', 'exists');
  assert(typeof cs.ensureDir === 'function', 'ensureDir');
  assert(typeof cs.listFiles === 'function', 'listFiles');
});

test('ensureDir returns Result<void>', async () => {
  const r = await cs.ensureDir('c/test');
  assertIsResult(r);
  assert(r.isSuccess);
});

test('write returns Result<string> (file path)', async () => {
  const r = await cs.write('c/test/hello.md', '# Hello');
  assertOk(r);
  assert(typeof r.value === 'string');
});

test('read returns Result<string> (content)', async () => {
  const r = await cs.read('c/test/hello.md');
  assertOk(r);
  assert(r.value === '# Hello');
});

test('read missing returns Result.fail (NotFoundError)', async () => {
  const r = await cs.read('c/nope.md');
  assertFail(r);
  assert(r.error.name === 'NotFoundError');
});

test('exists true returns Result<boolean>=true', async () => {
  const r = await cs.exists('c/test/hello.md');
  assertOk(r);
  assert(r.value === true);
});

test('exists false returns Result<boolean>=false', async () => {
  const r = await cs.exists('c/nope.md');
  assertOk(r);
  assert(r.value === false);
});

test('listFiles returns Result<string[]>', async () => {
  const r = await cs.listFiles('c/test');
  assertOk(r);
  assert(Array.isArray(r.value));
  assert(r.value.includes('hello.md'));
});

test('write to invalid path returns Result.fail', async () => {
  const r = await cs.write('', '');
  assertFail(r);
});

fs.rmSync(CS_TMP, { recursive: true, force: true });

// ============================================================
// MasteryStore CONTRACT → JsonFileMasteryStore
// ============================================================
console.log('\n=== MasteryStore Contract → JsonFileMasteryStore ===');

const MS_FILE = path.join(__dirname, '_contract_mastery.json');
const ms = new JsonFileMasteryStore(MS_FILE);

test('interface: has all required methods', () => {
  assert(typeof ms.load === 'function', 'load');
  assert(typeof ms.save === 'function', 'save');
  assert(typeof ms.loadAll === 'function', 'loadAll');
});

test('save returns Result<void>', async () => {
  const r = await ms.save('aabbccddeeff0011', {
    scoreHistory: [{ score: 75, ts: '2026-01-01T00:00:00Z' }],
    level: 2,
  });
  assertOk(r);
});

test('load returns Result<{scoreHistory, level}>', async () => {
  const r = await ms.load('aabbccddeeff0011');
  assertOk(r);
  assert(Array.isArray(r.value.scoreHistory));
  assert(typeof r.value.level === 'number');
  assert(r.value.scoreHistory.length === 1);
  assert(r.value.level === 2);
});

test('load unknown returns Result with defaults (level=0)', async () => {
  const r = await ms.load('0000000000000000');
  assertOk(r);
  assert(r.value.level === 0);
  assert(Array.isArray(r.value.scoreHistory));
});

test('loadAll returns Result<Map>', async () => {
  const r = await ms.loadAll();
  assertOk(r);
  assert(r.value instanceof Map);
  assert(r.value.has('aabbccddeeff0011'));
});

test('save overwrites existing concept', async () => {
  await ms.save('aabbccddeeff0011', {
    scoreHistory: [{ score: 90, ts: '2026-06-01T00:00:00Z' }],
    level: 3,
  });
  const r = await ms.load('aabbccddeeff0011');
  assertOk(r);
  assert(r.value.level === 3);
});

fs.unlinkSync(MS_FILE);

// ============================================================
// EventBus CONTRACT → OutboxEventBus
// ============================================================
console.log('\n=== EventBus Contract → OutboxEventBus ===');

const EB_FILE = path.join(__dirname, '_contract_outbox.json');
const eb = new OutboxEventBus(EB_FILE);

test('interface: has all required methods', () => {
  assert(typeof eb.publish === 'function', 'publish');
  assert(typeof eb.getPending === 'function', 'getPending');
  assert(typeof eb.markDelivered === 'function', 'markDelivered');
});

test('publish returns Result<eventId: string>', async () => {
  const r = await eb.publish({
    type: 'contract.test',
    aggregateId: 'agg-1',
    payload: { key: 'value' },
  });
  assertOk(r);
  assert(typeof r.value === 'string');
  assert(r.value.length > 0);
});

test('getPending returns Result<Array>', async () => {
  const r = await eb.getPending();
  assertOk(r);
  assert(Array.isArray(r.value));
  assert(r.value.length >= 1);
});

test('pending event has required shape: {id, type, aggregateId, payload, ts, delivered}', async () => {
  const r = await eb.getPending();
  assertOk(r);
  const evt = r.value[0];
  assert(typeof evt.id === 'string');
  assert(typeof evt.type === 'string');
  assert(typeof evt.aggregateId === 'string');
  assert(typeof evt.ts === 'string');
  assert(typeof evt.delivered === 'boolean');
  assert(evt.delivered === false);
});

test('markDelivered returns Result<void>', async () => {
  const pending = await eb.getPending();
  const evtId = pending.value[0].id;
  const r = await eb.markDelivered(evtId);
  assertOk(r);
});

test('after markDelivered, getPending returns fewer events', async () => {
  const r = await eb.getPending();
  assertOk(r);
  const delivered = r.value.filter(e => e.delivered === false);
  assert(delivered.length === 0, 'no undelivered events should remain');
});

fs.unlinkSync(EB_FILE);

// ============================================================
// Summary
// ============================================================
console.log('\n=== Contract Test Results: ' + pass + ' passed, ' + fail + ' failed ===');
if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log('  - ' + f.name + ': ' + f.error));
}
process.exit(fail > 0 ? 1 : 0);
