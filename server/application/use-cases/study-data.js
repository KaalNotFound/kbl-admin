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
  return {
    getData: () => buildStudyData(),
    getHistory: () => getStudyHistory(),
    saveAnswer,
    saveSelfScore,
    saveFeedbackRequest,
  }
}
