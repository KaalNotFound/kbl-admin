/**
 * Error disclosure guard for the finanzas router (LOW-001 audit fix).
 *
 * Every finanzas handler returned `e.message` raw on 500, leaking internal
 * filesystem paths / exception details to any client that can reach /api.
 * The rest of the codebase standardizes on logAndRespond (throttled
 * server-side log + generic user-facing message); this pins that contract.
 */
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import finanzasRouter from '../finanzas-router.mjs'

const INTERNAL =
  "EACCES: permission denied, open '/srv/kbl-private/server/data/_contract-secret.json'"

function buildApp() {
  const app = express()
  app.use((req, _res, next) => {
    req.useCases = {
      finanzas: new Proxy(
        {},
        { get: () => async () => { throw new Error(INTERNAL) } },
      ),
    }
    next()
  })
  app.use(finanzasRouter)
  return app
}

describe('finanzas router error discipline', () => {
  const routes = [
    ['get', '/summary'],
    ['get', '/insights'],
    ['get', '/search'],
    ['get', '/compare'],
    ['get', '/food-sora/stats'],
    ['get', '/food-sora'],
    ['get', '/finanzas'],
    ['get', '/patrimonio'],
  ]

  for (const [method, path] of routes) {
    it(`${method.toUpperCase()} ${path} responds with a generic error, never the raw exception`, async () => {
      // /compare short-circuits to 200 on an empty query; force the use-case path.
      const url = path === '/compare' ? `${path}?q=term` : path
      const res = await request(buildApp())[method](url)
      expect(res.status).toBe(500)
      expect(typeof res.body.error).toBe('string')
      expect(res.body.error).not.toContain('EACCES')
      expect(res.body.error).not.toContain('/')
    })
  }
})
