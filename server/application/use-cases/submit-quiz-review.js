/**
 * SubmitQuizReview — Use Case
 *
 * Orchestrates: validate DTO → compute mastery → persist → return Result.
 * No I/O in domain logic. Port calls only via injected dependencies.
 *
 * @param {{ masteryStore: MasteryStore, eventBus: EventBus }} deps
 * @returns {(dto: QuizReviewDto) => Promise<Result<{mastery: object, level: number}>>}
 */
import { Result, computeMastery, getLevelFromScore } from '#domain';

export function createSubmitQuizReview({ masteryStore, eventBus }) {
  return async function submitQuizReview(dto) {
    // 1. Load existing mastery data
    const loadResult = await masteryStore.load(dto.concept);
    if (loadResult.isFailure) return loadResult;

    const data = loadResult.value;
    const scoreHistory = data?.scoreHistory || [];
    const existingLevel = data?.level || 0;

    // 2. Compute new mastery score (pure domain logic)
    const newEntry = { score: dto.score, ts: new Date().toISOString() };
    const newHistory = [...scoreHistory, newEntry];
    const mastery = computeMastery(newHistory);

    // 3. Determine level change
    const newLevel = getLevelFromScore(mastery.weightedScore);
    const levelChanged = newLevel !== existingLevel;

    // 4. Persist via port
    const saveResult = await masteryStore.save(dto.concept, {
      scoreHistory: newHistory,
      level: newLevel,
      mastery,
      updatedAt: new Date().toISOString(),
    });
    if (saveResult.isFailure) return saveResult;

    // 5. Publish domain event if level changed
    if (levelChanged && eventBus) {
      await eventBus.publish({
        type: 'mastery.level_changed',
        payload: { concept: dto.concept, oldLevel: existingLevel, newLevel },
      });
    }

    return Result.ok({ mastery, level: newLevel, levelChanged });
  };
}
