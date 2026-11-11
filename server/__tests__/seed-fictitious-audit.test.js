/**
 * Fictitious-seed audit (public repo gate).
 *
 * server/seed/*.json ships in the public repository so anyone (TFM panel
 * included) can clone and see populated dashboards. These tests pin the
 * publish contract: tracked seeds are generated demo fixtures, never
 * personal study history. RED-style by design: if a future edit introduces
 * real scores, personal names/paths, or unmarked entries, the suite fails
 * before anything reaches the public repo.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const load = (name) => JSON.parse(readFileSync(resolve(here, '..', 'seed', name), 'utf8'))
const raw = (name) => readFileSync(resolve(here, '..', 'seed', name), 'utf8')

const PERSONAL_PATTERNS = [
  [/\/home\/[a-z]/i, 'personal POSIX home path'],
  [/\/Users\/[a-z]/i, 'macOS user path'],
  [/[A-Z]:\\/, 'Windows drive path'],
  [/\bkaal/i, 'household username'],
  [/\bsora\b/i, 'household pet name'],
  [/[\w.+-]+@[\w-]+\.[\w.]+/, 'email address'],
]

const STUDY_SEEDS = ['mastery-seed.json', 'active-recall-seed.json']
const ALL_SEEDS = [...STUDY_SEEDS, 'market-data.json']

describe('mastery-seed.json is generated demo data', () => {
  const data = load('mastery-seed.json')

  it('has the store contract shape (concepts + scores + version)', () => {
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['concepts', 'scores', 'version']))
  })

  it('every score entry is explicitly marked as a demo seed entry', () => {
    for (const [id, scores] of Object.entries(data.scores)) {
      expect(scores.length, `scores for ${id}`).toBeGreaterThan(0)
      for (const entry of scores) {
        const details = typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)
        expect(details, `score for ${id} carries the demo marker`).toContain('Demo seed entry')
      }
    }
  })
})

describe('active-recall-seed.json is generated demo data', () => {
  const data = load('active-recall-seed.json')

  it('has the store contract shape (questions + version)', () => {
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['questions', 'version']))
  })

  it('every question and every review is marked demo-seed', () => {
    for (const [id, question] of Object.entries(data.questions)) {
      expect(question.sourceNote, `question ${id} sourceNote`).toBe('demo-seed')
      for (const review of question.reviews ?? []) {
        expect(review.sessionId, `review of ${id}`).toBe('demo-seed')
      }
    }
  })
})

describe('tracked seeds contain no personal artifacts', () => {
  for (const name of ALL_SEEDS) {
    it(`${name} sweeps clean`, () => {
      const content = raw(name)
      for (const [pattern, label] of PERSONAL_PATTERNS) {
        expect(content, `${name} leaks ${label}`).not.toMatch(pattern)
      }
    })
  }
})
