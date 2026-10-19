/**
 * Result<T> — Explicit success/failure pattern.
 * Replaces generic try/catch with typed, composable results.
 *
 * Usage:
 *   const result = Result.ok(data);
 *   const result = Result.fail(new ValidationError('bad input'));
 *   result.match(
 *     (value) => doSomething(value),
 *     (error) => handleError(error)
 *   );
 */
export class Result {
  #value;
  #error;
  #isSuccess;

  constructor(isSuccess, value, error) {
    this.#isSuccess = isSuccess;
    this.#value = value;
    this.#error = error;

    Object.freeze(this);
  }

  get isSuccess() { return this.#isSuccess; }
  get isFailure() { return !this.#isSuccess; }
  get value() {
    if (!this.#isSuccess) throw new Error('Cannot access value on a failed Result');
    return this.#value;
  }
  get error() {
    if (this.#isSuccess) throw new Error('Cannot access error on a successful Result');
    return this.#error;
  }

  /** Unwrap value or throw */
  unwrap() {
    if (this.#isSuccess) return this.#value;
    throw this.#error;
  }

  /** Map success value, pass through failure */
  map(fn) {
    if (!this.#isSuccess) return this;
    try {
      return Result.ok(fn(this.#value));
    } catch (e) {
      return Result.fail(e);
    }
  }

  /** FlatMap (chain operations that return Results) */
  flatMap(fn) {
    if (!this.#isSuccess) return this;
    return fn(this.#value);
  }

  /** Match: call onOk or onErr */
  match(onOk, onErr) {
    return this.#isSuccess ? onOk(this.#value) : onErr(this.#error);
  }

  /** Convert to plain object for serialization */
  toJSON() {
    return this.#isSuccess
      ? { ok: true, value: this.#value }
      : { ok: false, error: { message: this.#error.message, name: this.#error.name, code: this.#error.code } };
  }

  static ok(value = undefined) { return new Result(true, value, null); }
  static fail(error) { return new Result(false, null, error); }
}

// ─── Typed Error Base Classes ───────────────────────────────

export class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity, identifier) {
    super(`${entity} not found: ${identifier}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
    this.entity = entity;
    this.identifier = identifier;
  }
}

export class ConcurrencyError extends DomainError {
  constructor(message) {
    super(message || 'Optimistic concurrency conflict', 'CONCURRENCY_ERROR');
    this.name = 'ConcurrencyError';
  }
}

export class InfrastructureError extends DomainError {
  constructor(message, cause) {
    super(message, 'INFRASTRUCTURE_ERROR');
    this.name = 'InfrastructureError';
    this.cause = cause;
  }
}
