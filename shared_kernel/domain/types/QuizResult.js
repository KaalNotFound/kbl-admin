/**
 * QuizResult — Single quiz answer outcome.
 * Values: 'correct', 'incorrect', 'partial'
 */
import { ValueObject } from '../ValueObject.js';
import { ValidationError } from '../Result.js';

const VALID_RESULTS = ['correct', 'incorrect', 'partial'];

export class QuizResult extends ValueObject {
  validate(value) {
    if (!VALID_RESULTS.includes(value)) {
      throw new ValidationError(`QuizResult must be one of: ${VALID_RESULTS.join(', ')}`, 'quizResult');
    }
  }

  get isCorrect() { return this.value === 'correct'; }
  get isIncorrect() { return this.value === 'incorrect'; }
  get isPartial() { return this.value === 'partial'; }

  /** Convert to numeric score for weighted calculations */
  toScore() {
    if (this.value === 'correct') return 100;
    if (this.value === 'partial') return 50;
    return 0;
  }
}
