// --- NotebookLM Proxy ---
// Forwards requests to notebooklm-mcp running on localhost:3000.
// Handles auth headers, error mapping, and timeout management.

import http from 'http'

const NLM_BASE = process.env.NOTEBOOKLM_URL || 'http://localhost:3000'
const TIMEOUT_MS = 60_000
// Hard wall-clock bound: the socket `timeout` above only fires on inactivity,
// so a slow-drip LLM/NotebookLM response could hang a consumer forever (LLM05).
const ABORT_MS = 30_000

/**
 * Send a request to notebooklm-mcp and return the parsed JSON response.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} endpoint - Path on NLM server (e.g. '/ask', '/notebooks')
 * @param {object|null} body - Request body (for POST/PUT)
 * @returns {Promise<object>} Parsed JSON response
 */
export async function nlmRequest(method, endpoint, body = null) {
  const url = new URL(endpoint, NLM_BASE)

  return new Promise((resolve, reject) => {
    const reqOpts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUT_MS,
      signal: AbortSignal.timeout(ABORT_MS),
    }

    const req = http.request(reqOpts, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          // notebooklm-mcp wraps responses in { success, data } or { success, error }
          if (res.statusCode >= 400) {
            const errMsg = parsed.error || `NLM ${res.statusCode}`
            reject(new Error(errMsg))
          } else {
            resolve(parsed)
          }
        } catch {
          reject(new Error(`NLM returned invalid JSON: ${data.slice(0, 200)}`))
        }
      })
    })

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('NotebookLM MCP no está corriendo. Ejecutá: cd notebooklm-mcp && npm run start:http'))
      } else {
        reject(new Error(`NLM connection error: ${err.message}`))
      }
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`NLM request timeout (${TIMEOUT_MS}ms)`))
    })

    if (body && (method === 'POST' || method === 'PUT')) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

/**
 * Quick health check against NLM server.
 * @returns {Promise<{ authenticated: boolean, sessions: number }>}
 */
export async function nlmHealth() {
  return nlmRequest('GET', '/health')
}
