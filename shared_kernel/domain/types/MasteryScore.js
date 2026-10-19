/**
 * MasteryScore — Weighted mastery score 0-100.
 * Rules: number, integer, range [0, 100].
 */
import { ValueObject } from '../ValueObject.js';
import { ValidationError } from '../Result.js';

export class MasteryScore extends ValueObject {
  validate(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new ValidationError('MasteryScore must be a finite number', 'score');
    }
    if (!Number.isInteger(value)) {
      throw new ValidationError('MasteryScore must be an integer', 'score');
    }
    if (value < 0 || value > 100) {
      throw new ValidationError('MasteryScore must be 0-100', 'score');
    }
  }

  get isPassing() { return this.value >= 60; }
  get isExpert() { return this.value >= 80; }
}
