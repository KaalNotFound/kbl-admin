/**
 * Slice 5 (issue KaalNotFound/kbl-admin#3) — OWASP A03 supply chain + CI hardening:
 * prod dependency audit gate (high/critical = 0), SHA-pinned GitHub Actions,
 * self-hosted fonts (zero external third-party origins, offline-capable).
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('security: supply chain and CI hardening (slice 5)', () => {
  it('production dependency tree passes npm audit at --audit-level=high', () => {
    const result = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    })
    expect(result.status, `npm audit should exit 0\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0)
  })

  it('ci.yml SHA-pins actions/checkout to a full 40-char commit SHA', () => {
    const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(ci, 'expected actions/checkout@<40-char-sha>').toMatch(/actions\/checkout@[0-9a-f]{40}/)
  })

  it('ci.yml SHA-pins actions/setup-node to a full 40-char commit SHA', () => {
    const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(ci, 'expected actions/setup-node@<40-char-sha>').toMatch(/actions\/setup-node@[0-9a-f]{40}/)
  })

  it('ci.yml gates merges on a high-severity production audit', () => {
    const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8')
    expect(ci).toContain('npm audit --omit=dev --audit-level=high')
  })

  it('index.html loads no external font origins', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
    expect(html, 'fonts.googleapis.com must not be referenced').not.toContain('fonts.googleapis.com')
    expect(html, 'fonts.gstatic.com must not be referenced').not.toContain('fonts.gstatic.com')
  })

  it('public/fonts contains at least one self-hosted .woff2 file', () => {
    const dir = join(ROOT, 'public', 'fonts')
    expect(existsSync(dir), 'public/fonts/ should exist').toBe(true)
    const woff2 = readdirSync(dir).filter((f) => f.endsWith('.woff2'))
    expect(woff2.length, `expected >=1 .woff2 file, found: ${woff2.join(', ') || '(none)'}`).toBeGreaterThanOrEqual(1)
  })

  it('local font stylesheet references the .woff2 files via url()', () => {
    const css = readFileSync(join(ROOT, 'public', 'fonts', 'fonts.css'), 'utf8')
    expect(css, 'expected @font-face url(...) pointing at local .woff2 files').toMatch(/url\([^)]*\.woff2\)/)
  })
})
