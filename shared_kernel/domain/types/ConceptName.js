/**
 * ConceptName — Validated concept identifier.
 * Rules: non-empty string, max 200 chars, trimmed.
 */
import { ValueObject } from '../ValueObject.js';
import { ValidationError } from '../Result.js';

export class ConceptName extends ValueObject {
  validate(value) {
    if (typeof value !== 'string') throw new ValidationError('ConceptName must be a string', 'concept');
    const trimmed = value.trim();
    if (trimmed.length === 0) throw new ValidationError('ConceptName cannot be empty', 'concept');
    if (trimmed.length > 200) throw new ValidationError('ConceptName max 200 chars', 'concept');
  }

  get trimmed() { return this.value.trim(); }
}
