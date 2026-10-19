/**
 * ValueObject — Base class for immutable, validated value types.
 * Subclasses define `validate()` which must return true or throw ValidationError.
 *
 * Usage:
 *   class Email extends ValueObject {
 *     validate() { if (!this.value.includes('@')) throw new ValidationError(...); }
 *   }
 *   const email = new Email('test@example.com'); // validates on construction
 */
import { ValidationError } from './Result.js';

export class ValueObject {
  #value;

  constructor(value) {
    this.validate(value);
    this.#value = Object.freeze(value); // immutable
  }

  get value() { return this.#value; }

  /** Override in subclass. Throw ValidationError or return true. */
  validate(value) {
    if (value === undefined || value === null) {
      throw new ValidationError(`${this.constructor.name} cannot be null/undefined`, this.constructor.name);
    }
    return true;
  }

  equals(other) {
    if (!other || !(other instanceof ValueObject)) return false;
    return this.constructor.name === other.constructor.name
      && JSON.stringify(this.#value) === JSON.stringify(other.#value);
  }

  toString() { return String(this.#value); }
  toJSON() { return this.#value; }
}
