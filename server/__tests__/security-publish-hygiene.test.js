/**
 * Slice 6 (issue KaalNotFound/kbl-admin#3) — publish hygiene.
 *
 * Before this repository goes public it must not ship personal artifacts or
 * reveal personal filesystem layout. Assertions are RED-style: they inspect
 * git-tracked contents, so they fail until the offending files are untracked,
 * the ignore rules exist, and personal paths are sanitized.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = process.cwd()

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
}

// Personal absolute paths: POSIX home dirs, macOS /Users, and Windows drive
// roots (checked per line). Kept as constructed patterns so they never
// self-match this file's own source.
const PERSONAL_PATH_RE = /\/(home|Users)\/[a-zA-Z0-9._-]+\//
const WINDOWS_DRIVE_RE = /^[A-Za-z]:\\/

// Not scanned: mechanical lockfile, binary/font assets, historical devlog and
// planning docs, and this scanner itself.
function isExcludedFromScan(file) {
  return (
    file === 'package-lock.json' ||
    file === 'server/__tests__/security-publish-hygiene.test.js' ||
    file === 'docs/DEVLOG.md' ||
    file.startsWith('docs/planning-') ||
    file.startsWith('public/fonts/')
  )
}

function trackedFiles() {
  return git(['ls-files']).split('\n').filter(Boolean)
}

describe('publish hygiene (issue #3 slice 6)', () => {
  it('does not track backup or personal market-data artifacts', () => {
    const tracked = trackedFiles()
    const offenders = tracked.filter(
      (f) => f === 'server/_MARKET_DATA.json' || f.endsWith('.bak'),
    )
    expect(offenders).toEqual([])
  })

  it('tracks no file containing personal absolute paths', () => {
    const offenders = []
    for (const file of trackedFiles()) {
      if (isExcludedFromScan(file)) continue
      const abs = path.join(REPO_ROOT, file)
      let content
      try {
        content = fs.readFileSync(abs, 'utf8')
      } catch {
        continue // binary or unreadable asset (e.g. images)
      }
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (PERSONAL_PATH_RE.test(lines[i]) || WINDOWS_DRIVE_RE.test(lines[i])) {
          offenders.push(`${file}:${i + 1}`)
          break
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('ignores local agent traces, backups, and personal market data', () => {
    const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8')
    expect(gitignore).toMatch(/^\.atl\/$/m)
    expect(gitignore).toMatch(/^\*\.bak$/m)
    expect(gitignore).toMatch(/^server\/_MARKET_DATA\.json$/m)
  })

  it('serves market data from the configurable data dir, not a tracked personal copy', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'server/routes/market.mjs'), 'utf8')
    expect(source).toContain('KBL_DATA_DIR')
    expect(source).not.toContain('_MARKET_DATA.json')
  })
})
