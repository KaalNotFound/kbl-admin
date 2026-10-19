/**
 * CircuitBreaker — Resilience pattern for I/O operations.
 *
 * States: CLOSED (normal) → OPEN (failing, skip calls) → HALF_OPEN (testing recovery)
 *
 * Configuration:
 *   failureThreshold: consecutive failures to trip (default: 5)
 *   resetTimeout: ms before trying again (default: 30000)
 *   halfOpenMax: calls in half-open before deciding (default: 3)
 */
export class CircuitBreaker {
  #state = 'CLOSED';
  #failureCount = 0;
  #successCount = 0;
  #lastFailureTime = 0;
  #options;

  constructor(options = {}) {
    this.#options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 30000,
      halfOpenMax: options.halfOpenMax ?? 3,
      name: options.name ?? 'CircuitBreaker',
    };
  }

  get state() { return this.#state; }
  get failureCount() { return this.#failureCount; }

  /**
   * Execute an operation through the circuit breaker.
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   * @throws {CircuitOpenError} if circuit is OPEN
   */
  async execute(operation) {
    if (this.#state === 'OPEN') {
      if (Date.now() - this.#lastFailureTime >= this.#options.resetTimeout) {
        this.#state = 'HALF_OPEN';
        this.#successCount = 0;
        console.log(`[${this.#options.name}] Circuit HALF_OPEN — testing recovery`);
      } else {
        throw new CircuitOpenError(this.#options.name, this.#options.resetTimeout - (Date.now() - this.#lastFailureTime));
      }
    }

    try {
      const result = await operation();
      this.#onSuccess();
      return result;
    } catch (error) {
      this.#onFailure();
      throw error;
    }
  }

  #onSuccess() {
    this.#failureCount = 0;
    if (this.#state === 'HALF_OPEN') {
      this.#successCount++;
      if (this.#successCount >= this.#options.halfOpenMax) {
        this.#state = 'CLOSED';
        console.log(`[${this.#options.name}] Circuit CLOSED — recovered`);
      }
    }
  }

  #onFailure() {
    this.#failureCount++;
    this.#lastFailureTime = Date.now();
    if (this.#state === 'HALF_OPEN') {
      this.#state = 'OPEN';
      console.log(`[${this.#options.name}] Circuit OPEN — half-open test failed`);
    } else if (this.#failureCount >= this.#options.failureThreshold) {
      this.#state = 'OPEN';
      console.warn(`[${this.#options.name}] Circuit OPEN — ${this.#failureCount} consecutive failures`);
    }
  }

  reset() {
    this.#state = 'CLOSED';
    this.#failureCount = 0;
    this.#successCount = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(name, retryInMs) {
    super(`Circuit "${name}" is OPEN. Retry in ${Math.round(retryInMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.retryInMs = retryInMs;
  }
}

/**
 * Retry with exponential backoff + jitter.
 * @param {() => Promise<T>} operation
 * @param {{ maxRetries?: number, baseDelayMs?: number, maxDelayMs?: number, jitterFactor?: number }} options
 * @returns {Promise<T>}
 */
export async function retryWithJitter(operation, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const jitterFactor = options.jitterFactor ?? 0.3;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = delay * jitterFactor * Math.random();
        const waitTime = Math.round(delay + jitter);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  throw lastError;
}

/**
 * Combined: CircuitBreaker + retry with jitter.
 * Use for all external I/O calls (filesystem, network, DB).
 */
export async function resilientCall(breaker, operation, retryOptions = {}) {
  return retryWithJitter(() => breaker.execute(operation), retryOptions);
}
