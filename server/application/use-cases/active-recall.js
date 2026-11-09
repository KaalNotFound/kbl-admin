/**
 * ActiveRecall — Use Cases (Torre active-recall, ADR-025, 2026-08-04)
 *
 * Re-capetización: routes/active-recall.mjs importaba el store legacy
 * (infrastructure/active-recall-store.js) DIRECTO vía alias #infra (violación
 * R1 del gate ca-boundaries). Ahora el store es una dependencia inyectada
 * (port { getDueQuestions, submitReview, getStats }) desde el container — este
 * use-case NO importa infra ni lib.
 *
 * Nota de torre (bug fix): el endpoint POST /active-recall/review tenía un
 * path DI condicional hacia submitActiveRecallReview (use-case de mastery)
 * con contrato desalineado (conceptHash/correct vs concept/score/question) →
 * con el container cableado respondía 500 SIEMPRE. Se reemplaza por
 * activeRecall.submitReview (el fallback legacy que funcionaba), preservando
 * la validación y el Result pattern.
 */

import { resolveWithinRoot } from '../../lib/path-guard.mjs'

const MAX_BATCH_QUESTIONS = 500

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// Allowlist mirrors the store schema (seedQuestions persists question, type,
// concept, definition, sourceNote, sourceBloque) — the first-party UI sends
// those fields, so dropping them would silently degrade seeded questions.
const QUESTION_LIMITS = {
  question: 2000,
  answer: 4000,
  type: 10,
  concept: 200,
  definition: 4000,
  sourceNote: 500,
  sourceBloque: 100000,
}
const INVALID_QUESTION = { status: 400, error: 'Formato de pregunta inválido.' }
const VALID_TYPES = new Set(['question', 'doubt', 'concept'])

// Allowlist normalization (API3 mass assignment): only known, bounded fields
// reach the store — every other client-supplied key is dropped.
function normalizeQuestion(raw) {
  const question = typeof raw.question === 'string'
    ? raw.question.trim().slice(0, QUESTION_LIMITS.question)
    : '';
  if (!question) return null;
  const out = { question };
  if (raw.answer !== undefined && raw.answer !== null) {
    out.answer = String(raw.answer).slice(0, QUESTION_LIMITS.answer);
  }
  if (VALID_TYPES.has(raw.type)) {
    out.type = raw.type;
  }
  for (const key of ['concept', 'definition', 'sourceNote']) {
    if (raw[key] !== undefined && raw[key] !== null) {
      out[key] = typeof raw[key] === 'string'
        ? raw[key].slice(0, QUESTION_LIMITS[key])
        : String(raw[key]).slice(0, QUESTION_LIMITS[key]);
    }
  }
  if (Number.isInteger(raw.sourceBloque) && raw.sourceBloque >= 0) {
    out.sourceBloque = Math.min(raw.sourceBloque, QUESTION_LIMITS.sourceBloque);
  }
  return out;
}

export function createActiveRecallUseCases({ store, defaultIngestDir }) {
  /**
   * POST /active-recall/review
   * Body: { conceptHash, correct, timeSpentMs, mode }
   * Result pattern (AGENTS §2.3): validación → { status, error }; éxito → { ok: true, value }.
   */
  async function submitReview(payload = {}) {
    const { conceptHash, correct, timeSpentMs, mode } = payload;
    if (!conceptHash || correct === undefined) {
      return { status: 400, error: 'conceptHash and correct are required' };
    }
    const value = store.submitReview({ conceptHash, correct, timeSpentMs, mode });
    return { ok: true, value };
  }

  /**
   * POST /active-recall/due
   * Body: { limit?, moduleFilter? } — el store legacy no soporta moduleFilter.
   */
  async function getDue(payload = {}) {
    const limit = payload.limit ?? 10;
    const items = store.getDueQuestions().slice(0, limit);
    return { items, count: items.length };
  }

  /**
   * GET /active-recall/stats
   */
  async function getStats() {
    return store.getStats();
  }

  // ------------------------------------------------------------------
  // HTTP surface consumed by src/api/active-recall.ts (restored after the
  // ADR-025 refactor dropped it — the router only kept /review, POST /due
  // and /stats, so every Active Recall panel 404'd). All delegate to the
  // legacy store port.
  // ------------------------------------------------------------------

  /** GET /active-recall/all → { questions: [...due items...] } */
  async function getAll() {
    return { ok: true, value: { questions: store.getAllQuestions() } };
  }

  /** GET /active-recall/due → ActiveRecallDueResponse { questions, stats } */
  async function getDueWithStats(payload = {}) {
    let questions = store.getDueQuestions();
    if (Number.isFinite(payload.limit)) questions = questions.slice(0, payload.limit);
    return { ok: true, value: { questions, stats: store.getStats() } };
  }

  /** GET /active-recall/question/:id → full question or 404 */
  async function getQuestionById(id) {
    if (!id) return { status: 400, error: 'id is required' };
    const q = store.getQuestion(id);
    if (!q) return { status: 404, error: 'question not found' };
    return { ok: true, value: q };
  }

  /**
   * POST /active-recall/submit — body matches the legacy store contract:
   * { question, type, answer, score, concept?, definition?, sourceNote?,
   *   sourceBloque?, sessionId? } → { id, review, interval, nextReview, due }.
   */
  async function submit(payload = {}) {
    const { question, score } = payload;
    if (!question || !score) {
      return { status: 400, error: 'question and score are required' };
    }
    if (!['correct', 'partial', 'incorrect'].includes(score)) {
      return { status: 400, error: 'score must be correct, partial or incorrect' };
    }
    return { ok: true, value: store.submitReview(payload) };
  }

  /** POST /active-recall/ingest — backfill from vault _active_recall/ notes. */
  async function ingest(dir) {
    const target = dir || defaultIngestDir;
    const guard = resolveWithinRoot(defaultIngestDir, target);
    if (!guard.ok) {
      return { status: 400, error: 'Directorio de importación fuera del vault permitido.' };
    }
    return { ok: true, value: store.ingestFromActiveRecall(guard.path) };
  }

  /** POST /active-recall/seed — { questions: [...] } → { seeded } */
  async function seed(payload = {}) {
    if (!Array.isArray(payload.questions)) {
      return { status: 400, error: 'questions array is required' };
    }
    if (payload.questions.length > MAX_BATCH_QUESTIONS) {
      return { status: 400, error: 'Máximo 500 preguntas por lote.' };
    }
    if (!payload.questions.every(isPlainObject)) {
      return { status: 400, error: INVALID_QUESTION.error };
    }
    const questions = payload.questions.map(normalizeQuestion);
    if (questions.some((q) => q === null)) {
      return { status: 400, error: INVALID_QUESTION.error };
    }
    return { ok: true, value: { seeded: store.seedQuestions(questions) } };
  }

  /** POST /active-recall/inject — single-question variant of seed. */
  async function inject(payload = {}) {
    if (!isPlainObject(payload)) return { status: 400, error: INVALID_QUESTION.error };
    const question = normalizeQuestion(payload);
    if (!question) return { status: 400, error: INVALID_QUESTION.error };
    return { ok: true, value: { seeded: store.seedQuestions([question]) } };
  }

  return { submitReview, getDue, getStats, getAll, getDueWithStats, getQuestionById, submit, ingest, seed, inject };
}
