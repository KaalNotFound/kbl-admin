/**
 * Study data — Use Cases
 *
 * Thin delegation to the study-service read/write functions so that routers
 * can consume them via DI (req.useCases.studyData) without importing lib/
 * directly (boundary §2.1, same pattern as the finanzas and mastery towers).
 *
 * All I/O lives in lib/study-service.mjs (which routes filesystem access
 * through the vault adapter, honoring KBL_VAULT_ROOT); this factory receives
 * the functions as injected dependencies and adds no logic of its own.
 *
 * @param {object} deps — functions from lib/study-service.mjs
 */
export function createStudyDataUseCases({
  buildStudyData,
  getStudyHistory,
  saveAnswer,
  saveSelfScore,
  saveFeedbackRequest,
}) {
  /**
   * GET /study/history → StudyHistoryResponse contract
   * (src/types.ts): { history: Record<fecha, items>, items, stats }.
   *
   * The legacy getStudyHistory() returns a bare array; StudyHashmap.tsx
   * reads `items` and `stats` from the response, so the use-case adapts the
   * array into the full envelope (grouping + derived stats). Without this,
   * `r.items` is undefined and the Mapa sub-tab crashes the React tree
   * ("items is not iterable").
   */
  function getHistoryEnvelope() {
    const items = getStudyHistory();
    const history = {};
    for (const item of items) {
      (history[item.fecha] ||= []).push(item);
    }

    const scores = items.map((i) => i.score);
    const byDate = [...new Set(items.map((i) => i.fecha))].sort().reverse();
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < byDate.length; i++) {
      const diff = Math.round((today - new Date(byDate[i])) / 86400000);
      if (diff === streak) streak++;
      else if (diff > streak) break;
    }

    return {
      history,
      items,
      stats: {
        total: items.length,
        correct: scores.filter((s) => s === 'correct').length,
        partial: scores.filter((s) => s === 'partial').length,
        incorrect: scores.filter((s) => s === 'incorrect').length,
        streak,
        today: today.toISOString().slice(0, 10),
      },
    };
  }

  return {
    getData: () => buildStudyData(),
    getHistory: getHistoryEnvelope,
    saveAnswer,
    saveSelfScore,
    saveFeedbackRequest,
  }
}
