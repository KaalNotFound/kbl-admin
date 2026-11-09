/**
 * Security slice 3 — data integrity at trust boundaries (issue #3)
 * OWASP A08 / API3 / API10 / LLM01 / LLM09: frontmatter injection, LLM output
 * validation and seed/inject allowlist normalization.
 */

import { describe, it, expect, vi } from 'vitest'
import { createCaptureNote } from '../application/use-cases/capture-note.js'
import { createActiveRecallUseCases } from '../application/use-cases/active-recall.js'

// ─── frontmatter-guard ───────────────────────────────────────────────────────

describe('frontmatter-guard.sanitizeFrontmatterValue', () => {
  const load = () => import('../lib/frontmatter-guard.mjs')

  it('collapses newlines so no extra field can be forged', async () => {
    const { sanitizeFrontmatterValue } = await load()
    const out = sanitizeFrontmatterValue('X\nentity_type:: hack')
    expect(out).not.toContain('\n')
    expect(out).not.toContain('entity_type::')
    expect(out).toContain('X')
  })

  it('neutralizes :: sequences (cannot open a new field)', async () => {
    const { sanitizeFrontmatterValue } = await load()
    expect(sanitizeFrontmatterValue('::')).not.toContain('::')
    expect(sanitizeFrontmatterValue('a::b')).not.toContain('::')
    expect(sanitizeFrontmatterValue('precio_total:: 0')).not.toContain('::')
  })

  it('caps length at 500 and removes control chars', async () => {
    const { sanitizeFrontmatterValue } = await load()
    expect(sanitizeFrontmatterValue('x'.repeat(900))).toHaveLength(500)
    expect(sanitizeFrontmatterValue('a\u0000b\u001Fc')).toBe('abc')
  })

  it('leaves normal compra values untouched (parser format intact)', async () => {
    const { sanitizeFrontmatterValue } = await load()
    expect(sanitizeFrontmatterValue('Mercadona')).toBe('Mercadona')
    expect(sanitizeFrontmatterValue('42,75')).toBe('42,75')
    expect(sanitizeFrontmatterValue('_panaderia')).toBe('_panaderia')
    expect(sanitizeFrontmatterValue('2')).toBe('2')
  })
})

describe('frontmatter-guard.sanitizeMultilineField', () => {
  const load = () => import('../lib/frontmatter-guard.mjs')

  it('escapes forged field lines, keeps regular text, caps at 4000', async () => {
    const { sanitizeMultilineField } = await load()
    const out = sanitizeMultilineField('nota normal\ncampo:: inyectada\n  ya indentada:: ok')
    const lines = out.split('\n')
    expect(lines[0]).toBe('nota normal')
    expect(lines[1]).toBe(' campo:: inyectada')
    expect(lines[2]).toBe('  ya indentada:: ok')
    expect(sanitizeMultilineField('x'.repeat(5000))).toHaveLength(4000)
  })
})

// ─── capture-note: compra fields are injection-safe ──────────────────────────

describe('capture-note compra fields cannot forge inline fields', () => {
  it('producto with newline + precio_total:: yields exactly ONE precio_total:: line', async () => {
    const written = []
    const vault = {
      VAULT_ROOT: '/tmp/kbl-sec3-vault',
      ensureDir: () => true,
      writeFile: (_p, content) => { written.push(content); return true },
      readFile: () => '',
      obsidianUrl: null,
    }
    const captureNote = createCaptureNote({ vault })
    const result = await captureNote({
      content: 'X',
      entityType: 'compra',
      date: '2026-11-09',
      fields: { comercio: 'Kiosco', producto: 'X\nprecio_total:: 0', precio_total: '10' },
    })
    expect(result.isFailure).not.toBe(true)
    const note = written.join('')
    expect(note.match(/precio_total::/g)).toHaveLength(1)
    expect(note).toContain('precio_total:: 10')
    expect(note).not.toContain('precio_total:: 0')
  })
})

// ─── mastery: LLM output boundary (LLM01/LLM09) ──────────────────────────────

describe('mastery normalizeEvaluation', () => {
  const load = () => import('../application/use-cases/mastery.js')

  it('non-finite / non-number / missing score → null (caller falls back)', async () => {
    const { normalizeEvaluation } = await load()
    expect(normalizeEvaluation({ score: NaN })).toBeNull()
    expect(normalizeEvaluation({ score: Infinity })).toBeNull()
    expect(normalizeEvaluation({ score: '99' })).toBeNull()
    expect(normalizeEvaluation({})).toBeNull()
    expect(normalizeEvaluation(null)).toBeNull()
  })

  it('clamps out-of-range scores to 0..100', async () => {
    const { normalizeEvaluation } = await load()
    const low = normalizeEvaluation({ score: -10 })
    const high = normalizeEvaluation({ score: 150 })
    expect(low.score).toBe(0)
    expect(high.score).toBe(100)
  })

  it('valid score unchanged; strings and lists capped', async () => {
    const { normalizeEvaluation } = await load()
    const ok = normalizeEvaluation({ score: 72, feedback: 'bien', strengths: ['s'], gaps: [], challenge: '¿y?' })
    expect(ok.score).toBe(72)
    expect(ok.feedback).toBe('bien')
    expect(ok.challenge).toBe('¿y?')

    const big = normalizeEvaluation({
      score: 50,
      feedback: 'F'.repeat(3000),
      strengths: Array.from({ length: 15 }, () => 'S'.repeat(400)),
      gaps: Array.from({ length: 15 }, () => 'G'.repeat(400)),
      challenge: 'C'.repeat(600),
    })
    expect(big.feedback).toHaveLength(2000)
    expect(big.strengths).toHaveLength(10)
    expect(big.strengths[0]).toHaveLength(300)
    expect(big.gaps).toHaveLength(10)
    expect(big.gaps[0]).toHaveLength(300)
    expect(big.challenge).toHaveLength(500)
  })
})

describe('evaluateSocratic persists bounded evaluations (mocked NLM)', () => {
  it('an LLM answer claiming score 999 never persists >100; fields stay capped', async () => {
    const { createMasteryUseCases } = await import('../application/use-cases/mastery.js')
    const answer = JSON.stringify({
      score: 999,
      feedback: 'F'.repeat(5000),
      strengths: Array.from({ length: 15 }, () => 'S'.repeat(400)),
      gaps: ['g'.repeat(400)],
      challenge: 'C'.repeat(600),
    })
    const validateConcept = vi.fn((payload) => ({ score: payload.score, concept: payload.concept }))
    const nlm = { request: vi.fn(async () => ({ data: { answer } })) }
    const uc = createMasteryUseCases({ store: { validateConcept }, vault: {}, nlm })

    const res = await uc.evaluateSocratic('closure', 'Explicación del estudiante con detalle suficiente.')

    expect(Number.isFinite(res.score)).toBe(true)
    expect(res.score).toBeLessThanOrEqual(100)
    expect(validateConcept.mock.calls[0][0].score).toBeLessThanOrEqual(100) // persisted value
    expect(res.mastery.score).toBeLessThanOrEqual(100)
    expect(res.feedback.length).toBeLessThanOrEqual(2000)
    expect(res.strengths.length).toBeLessThanOrEqual(10)
    expect(res.strengths[0].length).toBeLessThanOrEqual(300)
    expect(res.gaps[0].length).toBeLessThanOrEqual(300)
  })
})

// ─── active-recall: seed/inject allowlist (API3 mass assignment) ─────────────

describe('active-recall seed/inject normalize to the allowlist', () => {
  function makeUc() {
    const seedQuestions = vi.fn(() => 1)
    const store = { seedQuestions, getDueQuestions: () => [], submitReview: () => ({}), getStats: () => ({}) }
    return { uc: createActiveRecallUseCases({ store, defaultIngestDir: '/tmp' }), seedQuestions }
  }

  it('seed drops unknown fields before persisting', async () => {
    const { uc, seedQuestions } = makeUc()
    const res = await uc.seed({ questions: [{ question: 'q', evil: 'x' }] })
    expect(res.ok).toBe(true)
    expect(res.value.seeded).toBe(1)
    expect(seedQuestions.mock.calls[0][0][0]).toEqual({ question: 'q' })
  })

  it('seed rejects non-plain-object entries with a Spanish 400', async () => {
    const { uc } = makeUc()
    const res = await uc.seed({ questions: ['notanobject'] })
    expect(res.status).toBe(400)
    expect(res.error).toBe('Formato de pregunta inválido.')
  })

  it('seed rejects entries without a valid question', async () => {
    const { uc, seedQuestions } = makeUc()
    const res = await uc.seed({ questions: [{ evil: 'x' }] })
    expect(res.status).toBe(400)
    expect(res.error).toBe('Formato de pregunta inválido.')
    expect(seedQuestions).not.toHaveBeenCalled()
  })

  it('inject drops unknown fields and rejects invalid payloads', async () => {
    const { uc, seedQuestions } = makeUc()
    const ok = await uc.inject({ question: 'q', evil: 'x' })
    expect(ok.ok).toBe(true)
    expect(seedQuestions.mock.calls[0][0][0]).toEqual({ question: 'q' })

    const bad = await uc.inject('notanobject')
    expect(bad.status).toBe(400)
    const noQ = await uc.inject({ type: 'question' })
    expect(noQ.status).toBe(400)
    expect(noQ.error).toBe('Formato de pregunta inválido.')
  })

  it('caps question length, keeps UI metadata, and drops unknown keys', async () => {
    const { uc, seedQuestions } = makeUc()
    await uc.seed({
      questions: [{
        question: 'q'.repeat(3000),
        type: 'doubt',
        concept: 'closures',
        definition: 'd'.repeat(5000),
        sourceNote: 'nota',
        sourceBloque: 3,
        evil: 'x',
        module: 'dropped',
        tags: ['dropped'],
      }],
    })
    const persisted = seedQuestions.mock.calls[0][0][0]
    expect(Object.keys(persisted).sort()).toEqual(
      ['concept', 'definition', 'question', 'sourceBloque', 'sourceNote', 'type'])
    expect(persisted.question).toHaveLength(2000)
    expect(persisted.definition).toHaveLength(4000)
    expect(persisted.type).toBe('doubt')
  })

  it('rejects invalid type values instead of trusting them', async () => {
    const { uc, seedQuestions } = makeUc()
    const res = await uc.seed({ questions: [{ question: 'q', type: "'); DROP TABLE" }] })
    expect(res.ok).toBe(true)
    expect(seedQuestions.mock.calls[0][0][0]).toEqual({ question: 'q' }) // type dropped
  })
})
