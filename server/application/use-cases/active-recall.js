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
    return { ok: true, value: store.ingestFromActiveRecall(dir || defaultIngestDir) };
  }

  /** POST /active-recall/seed — { questions: [...] } → { seeded } */
  async function seed(payload = {}) {
    if (!Array.isArray(payload.questions)) {
      return { status: 400, error: 'questions array is required' };
    }
    return { ok: true, value: { seeded: store.seedQuestions(payload.questions) } };
  }

  /** POST /active-recall/inject — single-question variant of seed. */
  async function inject(payload = {}) {
    if (!payload.question) return { status: 400, error: 'question is required' };
    return { ok: true, value: { seeded: store.seedQuestions([payload]) } };
  }

  return { submitReview, getDue, getStats, getAll, getDueWithStats, getQuestionById, submit, ingest, seed, inject };
}
