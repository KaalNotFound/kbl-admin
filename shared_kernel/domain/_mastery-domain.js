/**
 * Mastery Domain — Pure functions for computing mastery scores.
 * Extracted from mastery-store.js and behavioral-tracker.mjs.
 * ZERO I/O — pure computation only.
 */

/**
 * Compute mastery metrics from a score history.
 * @param {Array<{score: number, ts: string}>} scoreHistory
 * @returns {{ average: number, weightedScore: number, streak: number, count: number }}
 */
export function computeMastery(scoreHistory) {
  const scores = scoreHistory.map(e => e.score);
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Weighted: recent scores count more (linear recency weighting)
  const len = scores.length;
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < len; i++) {
    const weight = i + 1;
    weightedSum += scores[i] * weight;
    totalWeight += weight;
  }
  const weightedScore = Math.round(weightedSum / totalWeight);

  // Streak: consecutive passing answers from most recent
  let streak = 0;
  for (let i = len - 1; i >= 0; i--) {
    if (scores[i] >= 60) streak++;
    else break;
  }

  return { average: Math.round(average), weightedScore, streak, count: len };
}

/**
 * Map a weighted score to a discrete skill level (0-4).
 * @param {number} weightedScore
 * @returns {number} 0-4
 */
export function getLevelFromScore(weightedScore) {
  if (weightedScore >= 90) return 4;
  if (weightedScore >= 75) return 3;
  if (weightedScore >= 60) return 2;
  if (weightedScore >= 40) return 1;
  return 0;
}
