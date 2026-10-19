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

export function createActiveRecallUseCases({ store }) {
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

  return { submitReview, getDue, getStats };
}
