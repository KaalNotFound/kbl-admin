import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = join(__dirname, 'test-acceptance.mjs');

const lines = [
"import { strict as assert } from 'assert';",
"import { createSubmitQuizReview } from './application/use-cases/submit-quiz-review.js';",
"import { createCaptureNote } from './application/use-cases/capture-note.js';",
"import { createSubmitActiveRecallReview } from './application/use-cases/submit-active-recall-review.js';",
"import { Result } from '../shared_kernel/domain/index.js';",
"",
"/* FAKE IMPLEMENTATIONS */",
"class FakeMasteryStore {",
"  constructor() { this.data = new Map(); this.failOn = null; }",
"  async load(concept) {",
"    if (this.failOn === 'load') return Result.fail(new Error('Store down'));",
"    return Result.ok(this.data.get(concept) || null);",
"  }",
"  async save(concept, data) {",
"    if (this.failOn === 'save') return Result.fail(new Error('Store down'));",
"    this.data.set(concept, data);",
"    return Result.ok(true);",
"  }",
"}",
"class FakeContentStore {",
"  constructor() { this.files = new Map(); this.failOn = null; }",
"  async write(path, content) {",
"    if (this.failOn === 'write') return Result.fail(new Error('FS down'));",
"    this.files.set(path, content);",
"    return Result.ok(true);",
"  }",
"  async ensureDir() {",
"    if (this.failOn === 'ensureDir') return Result.fail(new Error('FS down'));",
"    return Result.ok(true);",
"  }",
"}",
"class FakeEventBus {",
"  constructor() { this.events = []; this.failOn = null; }",
"  async publish(event) {",
"    if (this.failOn === 'publish') return Result.fail(new Error('Bus down'));",
"    this.events.push(event);",
"    return Result.ok(true);",
"  }",
"}",
];
writeFileSync(target, lines.join('\n'), 'utf8');
console.log('PHASE 1: ' + lines.length + ' lines written to test-acceptance.mjs');
