/**
 * Use Case Tests — Smoke tests for mastery domain + DTO validation.
 * Run: node server/application/use-cases/test.mjs
 */
import { Result, ValidationError, computeMastery, getLevelFromScore } from '#domain';
import { QuizReviewDto, CaptureNoteDto, QuizCompleteDto } from '../dto/index.js';

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

// --- Mastery Domain ---
console.log('\n--- Mastery Domain ---');
test('computeMastery returns correct structure', () => {
  const r = computeMastery([{score:80,ts:'2026-01-01'},{score:90,ts:'2026-01-02'}]);
  assert(r.average === 85 && r.weightedScore === 87 && r.streak === 2 && r.count === 2);
});

test('computeMastery weighted favors recent', () => {
  const r = computeMastery([{score:0,ts:'a'},{score:100,ts:'b'}]);
  assert(r.weightedScore > r.average, 'weighted should be higher than average when recent is better');
});

test('computeMastery streak breaks on failure', () => {
  const r = computeMastery([{score:80,ts:'a'},{score:30,ts:'b'},{score:90,ts:'c'}]);
  assert(r.streak === 1, 'streak should be 1 (only last pass)');
});

test('getLevelFromScore maps correctly', () => {
  assert(getLevelFromScore(95) === 4);
  assert(getLevelFromScore(80) === 3);
  assert(getLevelFromScore(65) === 2);
  assert(getLevelFromScore(45) === 1);
  assert(getLevelFromScore(10) === 0);
});

// --- DTO Validation ---
console.log('\n--- DTO Validation ---');
test('QuizReviewDto accepts valid input', () => {
  const r = QuizReviewDto({ question: 'What is 2+2?', score: 80, concept: 'Math' });
  assert(r.isSuccess && r.value.question === 'What is 2+2?');
});

test('QuizReviewDto rejects empty question', () => {
  const r = QuizReviewDto({ question: '', score: 80 });
  assert(r.isFailure && r.error instanceof ValidationError);
});

test('QuizReviewDto rejects score > 100', () => {
  const r = QuizReviewDto({ question: 'Q', score: 150 });
  assert(r.isFailure);
});

test('CaptureNoteDto accepts valid input', () => {
  const r = CaptureNoteDto({ entity_type: 'study', title: 'Test Note', tags: 'ai' });
  assert(r.isSuccess && r.value.entityType === 'study');
});

test('CaptureNoteDto rejects missing entity_type', () => {
  const r = CaptureNoteDto({ title: 'Test' });
  assert(r.isFailure);
});

test('CaptureNoteDto rejects missing title', () => {
  const r = CaptureNoteDto({ entity_type: 'study' });
  assert(r.isFailure);
});

test('QuizCompleteDto accepts valid input', () => {
  const r = QuizCompleteDto({ concept: 'AI', results: [{score:'correct'},{score:'incorrect'}] });
  assert(r.isSuccess && r.value.results.length === 2);
});

test('QuizCompleteDto rejects empty results', () => {
  const r = QuizCompleteDto({ concept: 'AI', results: [] });
  assert(r.isFailure);
});

test('QuizCompleteDto rejects invalid score value', () => {
  const r = QuizCompleteDto({ concept: 'AI', results: [{score:'maybe'}] });
  assert(r.isFailure);
});

console.log('\n--- Results: ' + pass + ' passed, ' + fail + ' failed ---');
process.exit(fail > 0 ? 1 : 0);
