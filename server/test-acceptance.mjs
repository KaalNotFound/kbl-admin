/**
 * Acceptance Tests — Use Cases with Fake implementations.
 * Given-When-Then format. No I/O, no external dependencies.
 * Run: node server/test-acceptance.mjs
 */
import { Result } from '#domain';
import { createSubmitQuizReview } from './application/use-cases/submit-quiz-review.js';
import { createCaptureNote } from './application/use-cases/capture-note.js';
import { createSubmitActiveRecallReview } from './application/use-cases/submit-active-recall-review.js';

// --- Fake Implementations ---

class FakeMasteryStore {
  constructor() { this.data = new Map(); this.failOn = null; }
  async load(concept) {
    if (this.failOn === 'load') return Result.fail(new Error('load failed'));
    return Result.ok(this.data.get(concept) || null);
  }
  async save(concept, value) {
    if (this.failOn === 'save') return Result.fail(new Error('save failed'));
    this.data.set(concept, value);
    return Result.ok(true);
  }
}

class FakeContentStore {
  constructor() { this.files = new Map(); this.dirs = new Set(); this.failOn = null; }
  async ensureDir(p) {
    if (this.failOn === 'ensureDir') return Result.fail(new Error('dir failed'));
    this.dirs.add(p); return Result.ok(true);
  }
  async write(p, content) {
    if (this.failOn === 'write') return Result.fail(new Error('write failed'));
    this.files.set(p, content); return Result.ok(true);
  }
}

class FakeEventBus {
  constructor() { this.events = []; this.failOn = null; }
  async publish(event) {
    if (this.failOn === 'publish') throw new Error('pub failed');
    this.events.push(event); return Result.ok(true);
  }
}

// --- Test Infrastructure ---

let pass = 0, fail = 0;
async function describe(name, fn) {
  console.log('\n--- ' + name + ' ---');
  await fn();
}
async function it(name, fn) {
  try { await fn(); pass++; console.log('  PASS: ' + name); }
  catch (e) { fail++; console.error('  FAIL: ' + name + ' — ' + e.message); }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// =========================================
// ACCEPTANCE: submitQuizReview
// =========================================

await describe('submitQuizReview', async () => {

  // GIVEN empty store, WHEN first quiz score 80
  await it('first score 80 → mastery.weightedScore=80, level=3', async () => {
    const ms = new FakeMasteryStore();
    const eb = new FakeEventBus();
    const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'math-1', score: 80 });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.mastery.weightedScore === 80, 'weightedScore=80');
    assert(r.value.level === 3, 'level=3 (>=75)');
    assert(r.value.levelChanged === true, 'level changed 0→3');
    assert(eb.events.length === 1, 'one event published');
  });

  // GIVEN empty store, WHEN quiz score 95 → level 4
  await it('first score 95 → level=4 (>=90)', async () => {
    const ms = new FakeMasteryStore();
    const eb = new FakeEventBus();
    const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'math-2', score: 95 });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.level === 4, 'level=4 (>=90)');
    assert(eb.events.length === 1, 'event published');
  });

  // GIVEN mastery 40 level=1, WHEN quiz 90 → weighted=(40+90*2)/3=73, level=2, changed
  await it('score 40→90: weightedScore=73, level=2, levelChanged', async () => {
    const ms = new FakeMasteryStore();
    await ms.save('hist-1', {
      scoreHistory: [{ score: 40, ts: '2026-01-01' }], level: 1 });
    const eb = new FakeEventBus();
    const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'hist-1', score: 90 });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.mastery.weightedScore === 73, 'weighted=(40+180)/3=73');
    assert(r.value.level === 2, 'level=2 (60<=73<75)');
    assert(r.value.levelChanged === true, 'level 1→2');
    assert(eb.events.length === 1, 'event published');
  });

  // GIVEN mastery level 3, WHEN quiz in same level range → no event
  await it('same level range → no level_changed event', async () => {
    const ms = new FakeMasteryStore();
    await ms.save('noevent', {
      scoreHistory: [{ score: 80, ts: '2026-01-01' }], level: 3 });
    const eb = new FakeEventBus();
    const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'noevent', score: 85 });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.levelChanged === false, 'no level change');
    assert(eb.events.length === 0, 'no event');
  });

  // GIVEN store fails, WHEN submit → Result.fail
  await it('save failure → Result.fail', async () => {
    const ms = new FakeMasteryStore(); ms.failOn = 'save';
    const eb = new FakeEventBus();
    const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'x', score: 50 });
    assert(r.isFailure, 'should fail');
  });

});

// =========================================
// ACCEPTANCE: captureNote
// =========================================

await describe('captureNote', async () => {

  await it('valid capture → writes file + publishes note.captured', async () => {
    const cs = new FakeContentStore();
    const eb = new FakeEventBus();
    const capture = createCaptureNote({ contentStore: cs, eventBus: eb });
    const r = await capture({
      title: 'Test Note', content: '# Test\nBody',
      entityType: 'study_note', tags: 'ai,testing',
      priority: 'high', energy: 'medium', focus: 'general',
      sourceUrl: 'https://example.com' });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.filePath.includes('_inbox'), 'path has _inbox');
    assert(cs.files.size === 1, 'one file written');
    const content = [...cs.files.values()][0];
    assert(content.includes('study_note'), 'frontmatter has entity_type');
    assert(content.includes('# Test Note'), 'has H1 title');
    assert(eb.events.length === 1, 'event published');
    assert(eb.events[0].type === 'note.captured', 'correct type');
  });

  await it('contentStore write fails → Result.fail', async () => {
    const cs = new FakeContentStore(); cs.failOn = 'write';
    const eb = new FakeEventBus();
    const capture = createCaptureNote({ contentStore: cs, eventBus: eb });
    const r = await capture({
      title: 'X', content: 'Y', entityType: 'note',
      tags: '', priority: 'low', energy: 'low', focus: 'test', sourceUrl: '' });
    assert(r.isFailure, 'should fail');
  });

  await it('contentStore ensureDir fails → Result.fail', async () => {
    const cs = new FakeContentStore(); cs.failOn = 'ensureDir';
    const eb = new FakeEventBus();
    const capture = createCaptureNote({ contentStore: cs, eventBus: eb });
    const r = await capture({
      title: 'Z', content: 'W', entityType: 'note',
      tags: '', priority: 'low', energy: 'low', focus: 'test', sourceUrl: '' });
    assert(r.isFailure, 'should fail on ensureDir');
  });

});

// =========================================
// ACCEPTANCE: submitActiveRecallReview
// =========================================

await describe('submitActiveRecallReview', async () => {

  await it('first review score 90 → two events (review + level_changed)', async () => {
    const ms = new FakeMasteryStore();
    const eb = new FakeEventBus();
    const submit = createSubmitActiveRecallReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'ar-1', score: 90, question: 'What is X?' });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.levelChanged === true, 'level changed');
    assert(r.value.level === 4, 'level=4 (>=90)');
    assert(eb.events.length === 2, 'review + level_changed');
    assert(eb.events[0].type === 'active_recall.reviewed', 'first is review');
    assert(eb.events[1].type === 'mastery.level_changed', 'second is level');
  });

  await it('same level → only review event', async () => {
    const ms = new FakeMasteryStore();
    await ms.save('ar-2', {
      scoreHistory: [{ score: 80, ts: '2026-01-01' }], level: 3 });
    const eb = new FakeEventBus();
    const submit = createSubmitActiveRecallReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'ar-2', score: 80, question: 'Q?' });
    assert(r.isSuccess, 'should succeed');
    assert(r.value.levelChanged === false, 'no level change');
    assert(eb.events.length === 1, 'only review event');
    assert(eb.events[0].type === 'active_recall.reviewed', 'correct type');
  });

  await it('load failure → Result.fail', async () => {
    const ms = new FakeMasteryStore(); ms.failOn = 'load';
    const eb = new FakeEventBus();
    const submit = createSubmitActiveRecallReview({ masteryStore: ms, eventBus: eb });
    const r = await submit({ concept: 'x', score: 50, question: 'Q?' });
    assert(r.isFailure, 'should fail');
  });

});

// --- Runner ---

console.log('\n=============================');
console.log('FASE 8 ACCEPTANCE TESTS');
console.log('Pass: ' + pass + ' | Fail: ' + fail);
console.log('=============================');
process.exit(fail > 0 ? 1 : 0);
