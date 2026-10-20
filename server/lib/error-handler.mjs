/**
 * Exception Handling Harness — Shared Utilities
 *
 * Capa 2 (Strategy) + Capa 3 (Structure) helpers for route modules.
 * Used by all routes to standardize error handling.
 *
 * @see PROTOCOLS/exception-handling.md
 */

/**
 * Retry an async function with exponential backoff.
 * Strategy: retry for network/timeout errors (Capa 2: "Reintentar").
 *
 * @param {Function} fn - Async function to retry
 * @param {Object} opts
 * @param {number} opts.maxRetries - Max attempts (default: 3)
 * @param {number} opts.baseDelay - Base delay in ms (default: 1000)
 * @param {string} opts.label - Human-readable label for logs
 * @returns {Promise<*>} Result of fn
 * @throws {Error} Last error after all retries exhausted
 */
export async function retryWithBackoff(fn, { maxRetries = 3, baseDelay = 1000, label = 'operation' } = {}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`[retry] ${label} FAILED after ${maxRetries} attempts: ${error.message}`)
        throw error
      }
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.warn(`[retry] ${label} attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

/**
 * Log a route error with standardized format and return user-friendly message.
 * Capa 3: errors have context (route + method + what failed).
 *
 * @param {string} route - Route name (e.g., 'overview', 'capture')
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @param {Error} error - Original error
 * @param {string} userMessage - User-friendly message
 * @returns {{ error: string }} Response body for res.json()
 */
// Throttled logging: identical error signatures (route|method|path|message)
// log the full stack ONCE; repeats log a compact summary every 10 occurrences.
// Without this, dashboard polling against a down external service (Anki on
// :8765, Brave CDP on :9222) floods the console with hundreds of equal stacks.
const SUMMARY_EVERY = 10

const __logThrottle = new Map() // signature -> repeat count

/** Test seam: clear throttling state between test runs. */
export function _resetLogThrottle() {
  __logThrottle.clear()
}

export function logAndRespond(route, method, path, error, userMessage) {
  const signature = `${route}|${method}|${path}|${error.message}`
  const repeat = (__logThrottle.get(signature) ?? 0) + 1
  __logThrottle.set(signature, repeat)

  if (repeat === 1) {
    console.error(`[${route}] ${method} ${path} failed: ${error.message}`)
    if (error.stack && process.env.NODE_ENV !== 'production') {
      console.error(`[${route}] Stack:`, error.stack)
    }
  } else if (repeat % SUMMARY_EVERY === 0) {
    console.error(
      `[${route}] ${method} ${path} failed ${repeat - 1} repeated times (${error.message}) - logs suppressed`,
    )
  }
  return { error: userMessage || 'Error interno del servidor' }
}
