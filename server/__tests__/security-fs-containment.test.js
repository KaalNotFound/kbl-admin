/**
 * Security: filesystem containment and payload caps (TDD)
 *
 * Issue KaalNotFound/kbl-admin#3, slice 2: ingest must stay inside the
 * injected vault root, recursive scans are bounded, and request arrays are
 * capped so a single call cannot exhaust memory or read arbitrary files.
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { resolveWithinRoot } from '../lib/path-guard.mjs'
import { createActiveRecallUseCases } from '../application/use-cases/active-recall.js'
import { assertBatchSize } from '../routes/capture.mjs'

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kbl-sec2-'))
const ROOT = path.join(TMP, 'vault')

// The store resolves its file path at import time.
process.env.ACTIVE_RECALL_STORE_PATH = path.join(TMP, 'active-recall-store.json')
process.env.ACTIVE_RECALL_SEED_PATH = path.join(TMP, 'missing-seed.json')
const store = await import('../infrastructure/active-recall-store.js')

function makeDir(...segments) {
  const dir = path.join(...segments)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function makeStoreMock() {
  return {
    ingestFromActiveRecall: vi.fn(() => 0),
    seedQuestions: vi.fn((questions) => questions.length),
  }
}

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true })
})

// ---------------------------------------------------------------
// path-guard
// ---------------------------------------------------------------
describe('resolveWithinRoot', () => {
  makeDir(ROOT, 'notes', 'deep')

  it('accepts a nested path inside the root', () => {
    const res = resolveWithinRoot(ROOT, path.join('notes', 'deep'))
    expect(res.ok).toBe(true)
    expect(res.path).toBe(fs.realpathSync.native(path.join(ROOT, 'notes', 'deep')))
  })

  it('rejects a parent-directory escape', () => {
    expect(resolveWithinRoot(ROOT, path.join('..', 'outside'))).toMatchObject({ ok: false })
  })

  it('rejects an absolute path outside the root', () => {
    expect(resolveWithinRoot(ROOT, '/etc/passwd')).toMatchObject({ ok: false })
  })

  it('rejects a symlink inside the root that points outside', () => {
    const outside = makeDir(TMP, 'outside-target')
    const link = path.join(ROOT, 'escape-link')
    try {
      fs.symlinkSync(outside, link, 'dir')
    } catch {
      return // Platform without symlink support — skip assertion.
    }
    expect(resolveWithinRoot(ROOT, 'escape-link')).toMatchObject({ ok: false })
  })
})

// ---------------------------------------------------------------
// use case: ingest
// ---------------------------------------------------------------
describe('active-recall use case ingest', () => {
  it('rejects a directory outside the vault root without touching the store', async () => {
    const mock = makeStoreMock()
    const uc = createActiveRecallUseCases({ store: mock, defaultIngestDir: ROOT })

    const res = await uc.ingest(path.join(ROOT, '..', 'outside'))

    expect(res).toEqual({
      status: 400,
      error: 'Directorio de importación fuera del vault permitido.',
    })
    expect(mock.ingestFromActiveRecall).not.toHaveBeenCalled()
  })

  it('uses the default ingest dir when no dir is provided', async () => {
    const mock = makeStoreMock()
    const uc = createActiveRecallUseCases({ store: mock, defaultIngestDir: ROOT })

    const res = await uc.ingest()

    expect(res.ok).toBe(true)
    expect(mock.ingestFromActiveRecall).toHaveBeenCalledWith(fs.realpathSync.native(ROOT))
  })
})

// ---------------------------------------------------------------
// use case: seed / inject caps
// ---------------------------------------------------------------
describe('active-recall use case seed and inject caps', () => {
  it('rejects more than 500 questions', async () => {
    const mock = makeStoreMock()
    const uc = createActiveRecallUseCases({ store: mock, defaultIngestDir: ROOT })
    const questions = Array.from({ length: 501 }, (_, i) => ({ question: `q${i}` }))

    const res = await uc.seed({ questions })

    expect(res).toEqual({ status: 400, error: 'Máximo 500 preguntas por lote.' })
    expect(mock.seedQuestions).not.toHaveBeenCalled()
  })

  it('accepts exactly 500 questions', async () => {
    const mock = makeStoreMock()
    const uc = createActiveRecallUseCases({ store: mock, defaultIngestDir: ROOT })
    const questions = Array.from({ length: 500 }, (_, i) => ({ question: `q${i}` }))

    const res = await uc.seed({ questions })

    expect(res.ok).toBe(true)
    expect(res.value.seeded).toBe(500)
  })

  it('rejects non-object entries in seed', async () => {
    const mock = makeStoreMock()
    const uc = createActiveRecallUseCases({ store: mock, defaultIngestDir: ROOT })

    const res = await uc.seed({ questions: [{ question: 'ok' }, 'not-an-object'] })

    expect(res).toMatchObject({ status: 400 })
    expect(mock.seedQuestions).not.toHaveBeenCalled()
  })

  it('rejects a non-object inject payload', async () => {
    const mock = makeStoreMock()
    const uc = createActiveRecallUseCases({ store: mock, defaultIngestDir: ROOT })

    const res = await uc.inject(['not-an-object'])

    expect(res).toMatchObject({ status: 400 })
    expect(mock.seedQuestions).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------
// store: recursive scan caps and symlink skipping
// ---------------------------------------------------------------
describe('active-recall store ingest caps', () => {
  it('stops at maxFiles and reports truncation through the out-param', () => {
    const dir = makeDir(TMP, 'many-files')
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(dir, `n${i}.md`), `# Active Recall: cap q${i}\n`)
    }

    let truncated = false
    const imported = store.ingestFromActiveRecall(dir, {
      caps: { maxFiles: 3 },
      onTruncated: () => { truncated = true },
    })

    expect(imported).toBeLessThanOrEqual(3)
    expect(truncated).toBe(true)
  })

  it('stops descending past maxDepth and reports truncation', () => {
    const dir = makeDir(TMP, 'deep-tree', 'a', 'b', 'c')
    fs.writeFileSync(path.join(dir, 'x.md'), '# Active Recall: too deep\n')

    let truncated = false
    const imported = store.ingestFromActiveRecall(path.join(TMP, 'deep-tree'), {
      caps: { maxDepth: 1 },
      onTruncated: () => { truncated = true },
    })

    expect(imported).toBe(0)
    expect(truncated).toBe(true)
  })

  it('does not import a .md symlink pointing outside the scanned tree', () => {
    const dir = makeDir(TMP, 'symlink-vault')
    const outside = path.join(TMP, 'outside-secret.md')
    fs.writeFileSync(outside, '# Active Recall: symlink secret\n')
    try {
      fs.symlinkSync(outside, path.join(dir, 'secret.md'))
    } catch {
      return // Platform without symlink support — skip assertion.
    }

    const imported = store.ingestFromActiveRecall(dir)

    expect(imported).toBe(0)
  })
})

// ---------------------------------------------------------------
// capture batch cap
// ---------------------------------------------------------------
describe('capture batch cap', () => {
  it('rejects more than 100 captures at the helper level', () => {
    expect(assertBatchSize({ captures: new Array(101).fill({}) })).toMatchObject({ ok: false })
    expect(assertBatchSize({ captures: new Array(100).fill({}) })).toMatchObject({ ok: true })
  })

  it('returns 400 from the router before touching DI', async () => {
    const app = express()
    app.use(express.json())
    app.use('/api', (await import('../routes/capture.mjs')).default)

    const res = await request(app)
      .post('/api/capture/batch')
      .send({ captures: new Array(101).fill({ content: 'x' }) })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Máximo 100')
  })
})
