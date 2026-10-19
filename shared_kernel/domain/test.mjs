/**
 * Quick smoke test for shared_kernel/domain.
 * Run: node shared_kernel/domain/test.mjs
 */
import { Result, ValidationError, ConceptName, MasteryScore, SkillLevel, ConceptHash, QuizResult, EntityType } from './index.js';

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    fail++;
    console.error(`  FAIL: ${name} — ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('\n--- Result ---');
test('Result.ok holds value', () => {
  const r = Result.ok(42);
  assert(r.isSuccess && r.value === 42);
});

test('Result.fail holds error', () => {
  const r = Result.fail(new Error('bad'));
  assert(r.isFailure && r.error.message === 'bad');
});

test('Result.match dispatches correctly', () => {
  const ok = Result.ok('hi');
  const err = Result.fail(new Error('no'));
  assert(ok.match(v => v, () => 'x') === 'hi');
  assert(err.match(() => 'x', e => e.message) === 'no');
});

test('Result.map transforms value', () => {
  const r = Result.ok(5).map(x => x * 2);
  assert(r.value === 10);
});

test('Result.map on failure passes through', () => {
  const r = Result.fail(new Error('e')).map(x => x * 2);
  assert(r.isFailure);
});

test('Result.toJSON serialization', () => {
  const ok = Result.ok(1).toJSON();
  assert(ok.ok === true && ok.value === 1);
  const err = Result.fail(new Error('x')).toJSON();
  assert(err.ok === false && err.error.message === 'x');
});

console.log('\n--- Value Objects ---');
test('ConceptName valid', () => assert(new ConceptName('Machine Learning').value === 'Machine Learning'));
test('ConceptName rejects empty', () => { try { new ConceptName(''); assert(false); } catch(e) { assert(e instanceof ValidationError); } });
test('ConceptName rejects >200', () => { try { new ConceptName('x'.repeat(201)); assert(false); } catch(e) { assert(e instanceof ValidationError); } });
test('ConceptName trims', () => assert(new ConceptName('  hello  ').trimmed === 'hello'));

test('MasteryScore valid', () => assert(new MasteryScore(75).value === 75));
test('MasteryScore rejects 101', () => { try { new MasteryScore(101); assert(false); } catch(e) { assert(e instanceof ValidationError); } });
test('MasteryScore rejects float', () => { try { new MasteryScore(50.5); assert(false); } catch(e) { assert(e instanceof ValidationError); } });
test('MasteryScore.isPassing', () => assert(new MasteryScore(80).isPassing === true));

test('SkillLevel valid', () => assert(new SkillLevel(3).label === 'proficient'));
test('SkillLevel rejects 5', () => { try { new SkillLevel(5); assert(false); } catch(e) { assert(e instanceof ValidationError); } });
test('SkillLevel.isExpert', () => assert(new SkillLevel(4).isExpert === true));

test('ConceptHash valid', () => assert(new ConceptHash('a1b2c3d4e5f6a7b8').value === 'a1b2c3d4e5f6a7b8'));
test('ConceptHash rejects short', () => { try { new ConceptHash('abc'); assert(false); } catch(e) { assert(e instanceof ValidationError); } });
test('ConceptHash rejects uppercase', () => { try { new ConceptHash('A1B2C3D4E5F6A7B8'); assert(false); } catch(e) { assert(e instanceof ValidationError); } });

test('QuizResult valid', () => assert(new QuizResult('correct').isCorrect === true));
test('QuizResult.toScore correct=100', () => assert(new QuizResult('correct').toScore() === 100));
test('QuizResult.toScore partial=50', () => assert(new QuizResult('partial').toScore() === 50));
test('QuizResult rejects invalid', () => { try { new QuizResult('maybe'); assert(false); } catch(e) { assert(e instanceof ValidationError); } });

test('EntityType valid', () => assert(new EntityType('study').isStudy === true));
test('EntityType rejects invalid', () => { try { new EntityType('blog'); assert(false); } catch(e) { assert(e instanceof ValidationError); } });

test('ValueObject.equals same', () => assert(new ConceptHash('a1b2c3d4e5f6a7b8').equals(new ConceptHash('a1b2c3d4e5f6a7b8'))));
test('ValueObject.equals different', () => assert(!new ConceptHash('a1b2c3d4e5f6a7b8').equals(new ConceptHash('1111111111111111'))));

console.log(`\n--- Results: ${pass} passed, ${fail} failed ---`);
process.exit(fail > 0 ? 1 : 0);
