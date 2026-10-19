/**
 * DTO Validators — Lightweight input validation without external deps.
 *
 * Each DTO function validates + transforms raw input into a typed object.
 * Returns Result<Dto> — never throws.
 *
 * Pattern: pure functions, no I/O, no side effects.
 */
import { Result, ValidationError } from '#domain';

/**
 * Validate and normalize a quiz review submission.
 * @param {object} raw - req.body from POST /api/active-recall/review
 * @returns {Result<QuizReviewDto>}
 */
export function QuizReviewDto(raw) {
  if (!raw || typeof raw !== 'object') {
    return Result.fail(new ValidationError('Request body is required', 'body'));
  }

  const { question, type, answer, score, concept, definition, sourceNote, sourceBloque, agentFeedback, sessionId } = raw;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return Result.fail(new ValidationError('question is required (non-empty string)', 'question'));
  }
  if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 100)) {
    return Result.fail(new ValidationError('score must be 0-100', 'score'));
  }

  return Result.ok({
    question: question.trim(),
    type: type || 'question',
    answer: answer || '',
    score: typeof score === 'number' ? score : 0,
    concept: concept || '',
    definition: definition || '',
    sourceNote: sourceNote || '',
    sourceBloque: sourceBloque || '',
    agentFeedback: agentFeedback || null,
    sessionId: sessionId || null,
  });
}

/**
 * Validate a capture note creation.
 * @param {object} raw - req.body from POST /api/capture
 * @returns {Result<CaptureNoteDto>}
 */
export function CaptureNoteDto(raw) {
  if (!raw || typeof raw !== 'object') {
    return Result.fail(new ValidationError('Request body is required', 'body'));
  }

  const { entity_type, title, tags, content, source_url, priority, energy, focus } = raw;

  if (!entity_type || typeof entity_type !== 'string') {
    return Result.fail(new ValidationError('entity_type is required', 'entity_type'));
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return Result.fail(new ValidationError('title is required', 'title'));
  }

  return Result.ok({
    entityType: entity_type.trim(),
    title: title.trim(),
    tags: typeof tags === 'string' ? tags : Array.isArray(tags) ? tags.join(', ') : '',
    content: content || '',
    sourceUrl: source_url || '',
    priority: priority || 'medium',
    energy: energy || 'medium',
    focus: focus || 'general',
  });
}

/**
 * Validate a study quiz session completion.
 * @param {object} raw - req.body from POST /api/quiz/complete
 * @returns {Result<QuizCompleteDto>}
 */
export function QuizCompleteDto(raw) {
  if (!raw || typeof raw !== 'object') {
    return Result.fail(new ValidationError('Request body is required', 'body'));
  }

  const { concept, results } = raw;

  if (!concept || typeof concept !== 'string' || concept.trim().length === 0) {
    return Result.fail(new ValidationError('concept is required', 'concept'));
  }
  if (!Array.isArray(results) || results.length === 0) {
    return Result.fail(new ValidationError('results must be a non-empty array', 'results'));
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r || typeof r !== 'object') {
      return Result.fail(new ValidationError(`results[${i}] must be an object`, `results[${i}]`));
    }
    if (!['correct', 'incorrect', 'partial'].includes(r.score)) {
      return Result.fail(new ValidationError(`results[${i}].score must be correct|incorrect|partial`, `results[${i}].score`));
    }
  }

  return Result.ok({
    concept: concept.trim(),
    results: results.map(r => ({
      score: r.score,
      question: r.question || '',
      answer: r.answer || '',
    })),
  });
}
