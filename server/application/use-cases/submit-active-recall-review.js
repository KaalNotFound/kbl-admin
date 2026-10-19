/**
 * SubmitActiveRecallReview — Use Case
 *
 * Orchestrates: compute mastery → persist → publish events → return Result.
 *
 * @param {{ masteryStore: MasteryStore, eventBus: EventBus }} deps
 * @returns {(dto: QuizReviewDto) => Promise<Result<{mastery: object, level: number}>>}
 */
import { Result, computeMastery, getLevelFromScore } from '#domain';

export function createSubmitActiveRecallReview({ masteryStore, eventBus }) {
  return async function submitActiveRecallReview(dto) {
    // 1. Load existing mastery
    const loadResult = await masteryStore.load(dto.concept);
    if (loadResult.isFailure) return loadResult;

    const data = loadResult.value;
    const scoreHistory = data?.scoreHistory || [];
    const existingLevel = data?.level || 0;

    // 2. Add new score
    const newEntry = { score: dto.score, ts: new Date().toISOString() };
    const newHistory = [...scoreHistory, newEntry];

    // 3. Compute mastery (pure domain)
    const mastery = computeMastery(newHistory);
    const newLevel = getLevelFromScore(mastery.weightedScore);
    const levelChanged = newLevel !== existingLevel;

    // 4. Persist
    const saveResult = await masteryStore.save(dto.concept, {
      scoreHistory: newHistory,
      level: newLevel,
      mastery,
      updatedAt: new Date().toISOString(),
    });
    if (saveResult.isFailure) return saveResult;

    // 5. Publish events
    if (eventBus) {
      await eventBus.publish({
        type: 'active_recall.reviewed',
        payload: { concept: dto.concept, score: dto.score, question: dto.question },
      });
      if (levelChanged) {
        await eventBus.publish({
          type: 'mastery.level_changed',
          payload: { concept: dto.concept, oldLevel: existingLevel, newLevel },
        });
      }
    }

    return Result.ok({ mastery, level: newLevel, levelChanged });
  };
}
