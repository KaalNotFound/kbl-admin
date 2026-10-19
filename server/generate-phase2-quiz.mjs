import { writeFileSync, appendFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(__dirname, 'test-acceptance.mjs');

const lines = [
"",
"/* ========================================= */",
"/* TEST SUITE: submitQuizReview              */",
"/* ========================================= */",
"",
"async function testQuizReview() {",
" let passed = 0, failed = 0;",
" const log = (name, ok) => {",
"   if (ok) { passed++; console.log('  PASS: ' + name); }",
"   else { failed++; console.log('  FAIL: ' + name); }",
" };",
"",
" // GIVEN: empty mastery store, WHEN: first quiz score 80",
" {",
"   const ms = new FakeMasteryStore();",
"   const eb = new FakeEventBus();",
"   const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });",
"   const result = await submit({ conceptHash: 'abc123', conceptName: 'Test', correct: true, quizScore: 80 });",
"   log('first score returns ok', result.isOk());",
"   log('score equals 80', result.value.masteryScore === 80);",
"   log('event published', eb.events.length === 1);",
" }",
 "",
" // GIVEN: mastery 60 weight 1, WHEN: quiz 80 weight 1 → weighted avg",
 " {",
"   const ms = new FakeMasteryStore();",
"   await ms.save('hash2', { masteryScore: 60, weight: 1, level: 1 });",
"   const eb = new FakeEventBus();",
"   const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });",
"   const result = await submit({ conceptHash: 'hash2', conceptName: 'T2', correct: true, quizScore: 80 });",
"   log('weighted avg applied', result.isOk());",
"   log('score is 70 (60+80)/2', result.value.masteryScore === 70);",
" }",
 "",
" // GIVEN: store failure, WHEN: submit → Result.fail",
 " {",
"   const ms = new FakeMasteryStore();",
"   ms.failOn = 'save';",
"   const eb = new FakeEventBus();",
"   const submit = createSubmitQuizReview({ masteryStore: ms, eventBus: eb });",
"   const result = await submit({ conceptHash: 'h3', conceptName: 'T3', correct: true, quizScore: 90 });",
"   log('store failure returns err', result.isErr());",
" }",
 "",
" return { passed, failed };",
"}",
];
writeFileSync(target, lines.join('\\n'), 'utf8');
console.log('PHASE 2a: ' + lines.length + ' lines (quiz tests) written');
