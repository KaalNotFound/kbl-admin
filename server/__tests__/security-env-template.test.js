/**
 * Shipped env-template hygiene (audit WU1).
 *
 * .env.example previously shipped `CORS_ORIGINS=*`, and the security
 * middleware honors that wildcard (security.mjs treats '*' as open CORS).
 * A user copying the template would silently open every /api read to any
 * cross-origin site. The template must ship same-origin (empty) by default.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

describe('.env.example CORS template', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const envExample = readFileSync(resolve(here, '../../.env.example'), 'utf8')

  it('does not ship an un-commented wildcard CORS default', () => {
    const active = envExample
      .split('\n')
      .filter((line) => /^CORS_ORIGINS=/.test(line.trim()))
    expect(active, 'CORS_ORIGINS declared exactly once').toHaveLength(1)
    expect(active[0].trim()).not.toBe('CORS_ORIGINS=*')
  })
})
