/**
 * ConceptHash — 16-char lowercase hex hash.
 * Used as unique identifier for concepts in mastery store.
 */
import { ValueObject } from '../ValueObject.js';
import { ValidationError } from '../Result.js';

const HASH_PATTERN = /^[a-f0-9]{16}$/;

export class ConceptHash extends ValueObject {
  validate(value) {
    if (typeof value !== 'string') {
      throw new ValidationError('ConceptHash must be a string', 'hash');
    }
    if (!HASH_PATTERN.test(value)) {
      throw new ValidationError('ConceptHash must be 16 lowercase hex chars', 'hash');
    }
  }
}
