/**
 * FASE 5 Tests — Observabilidad (StructuredLogger + CorrelationId + DI Wiring)
 * 12 tests: Logger (4), Middleware (5), DI Container (3)
 */

import { StructuredLogger, createLogger } from '../infrastructure/structured-logger.js';
import { correlationIdMiddleware, requestLogger } from '../infrastructure/correlation-middleware.js';
import { createContainer } from '../di-container.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ FAIL: ${name}`); }
}

// Capture stdout/stderr for testing
let capturedOutput = '';
const origStdout = process.stdout.write;
const origStderr = process.stderr.write;

function captureStdout() {
  capturedOutput = '';
  process.stdout.write = (c) => { capturedOutput += c.toString(); return true; };
}
function captureStderr() {
  capturedOutput = '';
  process.stderr.write = (c) => { capturedOutput += c.toString(); return true; };
}
function restore() {
  process.stdout.write = origStdout;
  process.stderr.write = origStderr;
}

// ===== StructuredLogger =====
console.log('\n--- StructuredLogger ---');

// Test 1: JSON output format
captureStdout();
const log1 = new StructuredLogger({ service: 'test-svc', correlationId: 'corr-123', minLevel: 'debug' });
log1.info('test message', { key: 'value' });
restore();
try {
  const p = JSON.parse(capturedOutput.trim());
  assert(p.ts !== undefined, 'Has timestamp');
  assert(p.level === 'info', 'Level is info');
  assert(p.correlationId === 'corr-123', 'Has correlationId');
  assert(p.message === 'test message', 'Has message');
  assert(p.key === 'value', 'Has meta');
  assert(p.service === 'test-svc', 'Has service');
} catch (e) { assert(false, `JSON parse: ${e.message}`); }

// Test 2: Level filtering
captureStdout();
const log2 = new StructuredLogger({ minLevel: 'warn' });
log2.debug('no'); log2.info('no'); log2.warn('yes');
restore();
assert(capturedOutput.includes('yes'), 'Warn passes filter');
assert(!capturedOutput.includes('"no"'), 'Debug/info blocked');

// Test 3: Child logger
captureStdout();
const parent = new StructuredLogger({ correlationId: 'pid', minLevel: 'debug' });
const child = parent.child({ mod: 'auth' });
child.info('child');
restore();
try {
  const p = JSON.parse(capturedOutput.trim());
  assert(p.correlationId === 'pid', 'Child inherits correlationId');
  assert(p.mod === 'auth', 'Child has extra context');
} catch (e) { assert(false, `Child parse: ${e.message}`); }

// Test 4: startTimer
captureStdout();
const log4 = new StructuredLogger({ minLevel: 'debug' });
const timer = log4.startTimer('op');
await new Promise(r => setTimeout(r, 10));
timer.stop({ extra: 'd' });
restore();
try {
  const p = JSON.parse(capturedOutput.trim());
  assert(p.message === 'op completed', 'Timer logs completion');
  assert(typeof p.durationMs === 'number', 'Timer has durationMs');
  assert(p.extra === 'd', 'Timer has meta');
} catch (e) { assert(false, `Timer parse: ${e.message}`); }

// ===== CorrelationMiddleware =====
console.log('\n--- CorrelationMiddleware ---');

// Test 5: assigns UUID
let req = { headers: {}, ip: '127.0.0.1', method: 'GET', originalUrl: '/t' };
let res = { setHeader: () => {} };
let nextCalled = false;
correlationIdMiddleware(req, res, () => { nextCalled = true; });
assert(nextCalled, 'Calls next()');
assert(typeof req.correlationId === 'string' && req.correlationId.length > 0, 'Assigns UUID');
assert(req.log instanceof StructuredLogger, 'Creates req.log');

// Test 6: uses existing header
req = { headers: { 'x-correlation-id': 'existing-id' }, ip: '127.0.0.1' };
res = { setHeader: () => {} };
correlationIdMiddleware(req, res, () => {});
assert(req.correlationId === 'existing-id', 'Uses existing header');

// Test 7: sets response header
const headers = [];
req = { headers: {}, ip: '127.0.0.1' };
res = { setHeader: (k, v) => headers.push({ k, v }) };
correlationIdMiddleware(req, res, () => {});
assert(headers.some(c => c.k === 'X-Correlation-Id'), 'Sets response header');

// Test 8: req.log correlationId matches
assert(req.log.correlationId === req.correlationId, 'req.log correlationId matches');

// Test 9: requestLogger lifecycle
let logs = [];
const mockLog = new StructuredLogger({ minLevel: 'debug' });
mockLog.info = (msg, meta) => logs.push({ msg, meta });
mockLog.warn = (msg, meta) => logs.push({ msg, meta });
req = { headers: {}, ip: '127.0.0.1', method: 'GET', originalUrl: '/api/t', log: mockLog };
res = { statusCode: 200, end: function() {} };
nextCalled = false;
requestLogger(req, res, () => { nextCalled = true; });
assert(nextCalled, 'requestLogger calls next()');
assert(logs.some(e => e.msg === 'request.start'), 'Logs request.start');
res.statusCode = 201;
res.end();
const endLog = logs.find(e => e.msg === 'request.end');
assert(endLog !== undefined, 'Logs request.end');
assert(endLog.meta.statusCode === 201, 'Logs status code');
assert(typeof endLog.meta.durationMs === 'number', 'Logs duration');

// ===== createContainer (DI) =====
console.log('\n--- createContainer (DI) ---');

const tmpDir = path.join(os.tmpdir(), `kbl-di-${crypto.randomUUID().slice(0, 8)}`);
await fs.mkdir(path.join(tmpDir, 'data'), { recursive: true });

try {
  const c = createContainer({
    vaultRoot: tmpDir,
    masteryStorePath: path.join(tmpDir, 'data', 'mastery.json'),
    outboxPath: path.join(tmpDir, 'data', 'outbox.json'),
    logger: new StructuredLogger({ service: 'test', minLevel: 'debug' }),
  });

  // Test 10: All adapters wired
  assert(c.contentStore !== undefined, 'Container has contentStore');
  assert(c.masteryStore !== undefined, 'Container has masteryStore');
  assert(c.eventBus !== undefined, 'Container has eventBus');
  assert(c.logger !== undefined, 'Container has logger');

  // Test 11: Use cases are functions
  assert(typeof c.useCases.submitQuizReview === 'function', 'submitQuizReview is function');
  assert(typeof c.useCases.captureNote === 'function', 'captureNote is function');
  assert(typeof c.useCases.submitActiveRecallReview === 'function', 'submitActiveRecallReview is function');

  // Test 12: Logger has setCorrelationId (dynamic assignment)
  assert(typeof c.logger.setCorrelationId === 'function', 'Logger has setCorrelationId');
  c.logger.setCorrelationId('dynamic-123');
  assert(c.logger.correlationId === 'dynamic-123', 'setCorrelationId works');

} catch (e) { assert(false, `DI container: ${e.message}`); }

// Cleanup
await fs.rm(tmpDir, { recursive: true, force: true });

// ===== Summary =====
console.log(`\n=== FASE 5: ${passed}/${passed + failed} tests passed ===`);
if (failed > 0) process.exit(1);
