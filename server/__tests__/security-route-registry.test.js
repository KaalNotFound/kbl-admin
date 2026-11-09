/**
 * Route registry lock (OWASP API9 regression guard).
 *
 * Issue KaalNotFound/kbl-admin#3: every router file in server/routes/ must be
 * mounted exactly once in apiRouters, and no method+path pair may be served by
 * two routers (shadowing). A new orphan router file fails this test until it
 * is imported and added to the barrel.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { apiRouters } from '../routes/index.mjs'

const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'routes')
const routeFileCount = readdirSync(routesDir).filter(
  (f) => f.endsWith('.mjs') && f !== 'index.mjs',
).length

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options'])

function collectRouteKeys() {
  const byKey = new Map()
  for (const router of apiRouters) {
    for (const layer of router.stack) {
      if (!layer.route) continue
      const { path: routePath, methods } = layer.route
      for (const method of Object.keys(methods)) {
        if (!HTTP_METHODS.has(method)) continue // skip express `_method` internals
        const key = `${method.toUpperCase()} ${routePath}`
        if (!byKey.has(key)) byKey.set(key, [])
        byKey.get(key).push(key)
      }
    }
  }
  return byKey
}

describe('API route registry lock (API9)', () => {
  it('mounts every router file plus the finanzas barrel (no orphans)', () => {
    // +1: ../_finanzas.mjs lives outside server/routes/ and is mounted manually.
    expect(apiRouters.length).toBe(routeFileCount + 1)
    expect(apiRouters.length).toBe(21)
  })

  it('registers >80 distinct method+path keys with zero duplicates', () => {
    const byKey = collectRouteKeys()
    expect(byKey.size).toBeGreaterThan(80)
    const duplicates = [...byKey.entries()].filter(([, hits]) => hits.length > 1)
    expect(duplicates).toEqual([])
  })

  it('only declares real HTTP methods on every route layer', () => {
    for (const router of apiRouters) {
      for (const layer of router.stack) {
        if (!layer.route) continue
        for (const method of Object.keys(layer.route.methods)) {
          expect(HTTP_METHODS.has(method)).toBe(true)
        }
      }
    }
  })
})
