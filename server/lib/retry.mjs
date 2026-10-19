/**
 * retry.mjs - Retry with exponential backoff
 * Created: 2026-07-27 (fix for brave.mjs dependency)
 */

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {string} options.label - Log label (default: 'retry')
 * @returns {Promise<*>} Result of fn()
 */
export async function retryWithBackoff(fn, { maxRetries = 3, baseDelay = 1000, label = 'retry' } = {}) {
  let lastError
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`[${label}] attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error(`[${label}] all ${maxRetries + 1} attempts failed: ${error.message}`)
      }
    }
  }
  
  throw lastError
}

export default retryWithBackoff
