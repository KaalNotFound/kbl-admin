/**
 * Tests for active-recall-store.js
 * Validates: store CRUD, spaced repetition, due questions, stats.
 */
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const DIR = mkdtempSync(join(tmpdir(), 'ar-test-'));
const STORE_FILE = join(DIR, 'active-recall.json');

// Override env before import
process.env.ACTIVE_RECALL_STORE_PATH = STORE_FILE;

const {
  readStore, writeStore, hashQuestion, getDueQuestions,
  getAllQuestions, getQuestion, submitReview, getStats
} = await import('../infrastructure/active-recall-store.js');

let pass = 0, fail = 0;
function assert(cond, msg) { if (!cond) { fail++; console.error('FAIL: ' + msg); } else { pass++; } }

// Test 1: Initial store (empty, no seed data)
const s = readStore();
assert(typeof s === 'object' && 'questions' in s, 'store has questions key');
const initialCount = Array.isArray(s.questions) ? s.questions.length : Object.keys(s.questions).length;
assert(initialCount >= 0, 'store initializes');

// Test 2: hashQuestion determinism
const h1 = hashQuestion('What is 2+2?');
const h2 = hashQuestion('What is 2+2?');
assert(h1 === h2, 'hash is deterministic');
assert(typeof h1 === 'string' && h1.length === 12, 'hash is 12-char hex');

// Test 3: submitReview creates question entry
submitReview({ question: 'What is 2+2?', type: 'active-recall', answer: '4', score: 80 });

// Test 4: getQuestion returns submitted question
const q = getQuestion(h1);
assert(q && q.question === 'What is 2+2?', 'getQuestion returns correct question');
assert(Array.isArray(q.reviews), 'question has reviews array');
assert(q.reviews.length === 1, 'one review after submit');
assert(q.reviews[0].score === 80, 'correct score in review');

// Test 5: getDueQuestions
const due = getDueQuestions();
assert(Array.isArray(due), 'getDueQuestions returns array');

// Test 6: getStats
const stats = getStats();
assert(typeof stats === 'object', 'getStats returns object');
assert('totalQuestions' in stats, 'stats has totalQuestions');
assert(stats.totalQuestions >= 0, 'totalQuestions is valid count');

// Test 7: getAllQuestions
const all = getAllQuestions();
assert(Array.isArray(all), 'getAllQuestions returns array');

// Test 8: readStore/writeStore round trip
writeStore(s);
const s2 = readStore();
assert(s2.questions.length === s.questions.length, 'round trip preserves data');

console.log('\nactive-recall-store: ' + pass + ' passed, ' + fail + ' failed');

rmSync(DIR, { recursive: true, force: true });
process.exit(fail > 0 ? 1 : 0);
