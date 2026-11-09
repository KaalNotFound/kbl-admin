// --- Active Recall Store v2.0 ---
// Persistent JSON store with spaced repetition, answer history, and agent feedback.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Data dir is project-local so the app boots standalone without the vault.
// History: previously stored at <vault>/08 - SYSTEM/_system/, which broke when
// the vault layout was restructured on 2026-08-18 and the folder no longer existed.
// Override with ACTIVE_RECALL_STORE_PATH (file) or KBL_DATA_DIR (directory).
const DATA_DIR = process.env.KBL_DATA_DIR || path.join(__dirname, '..', 'data')
const STORE_PATH = process.env.ACTIVE_RECALL_STORE_PATH || path.join(DATA_DIR, 'active-recall-store.json')

// First-boot seed: when the store does not exist yet (fresh clone), populate the
// store with bundled demo questions so Active Recall dashboards render with
// content instead of empty state. See server/seed/ and docs/DEVLOG.md.
const SEED_PATH = process.env.ACTIVE_RECALL_SEED_PATH || path.join(__dirname, '..', 'seed', 'active-recall-seed.json')

function readSeed() {
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
  } catch {
    return null // No seed available — initialize empty.
  }
}

// --- Hash a question to a stable ID ---
function hashQuestion(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 12)
}

// --- Read store (empty if missing or corrupt) ---
function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { questions: {}, version: 2, lastUpdated: new Date().toISOString() }
    const raw = fs.readFileSync(STORE_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data.questions) data.questions = {}
    if (!data.version) data.version = 2
    return data
  } catch {
    return { questions: {}, version: 2, lastUpdated: new Date().toISOString() }
  }
}

// --- Write store atomically ---
function writeStore(data) {
  data.lastUpdated = new Date().toISOString()
  // Create the target directory if it does not exist (no crash on fresh clones).
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  fs.writeFileSync(STORE_PATH + '.tmp', JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(STORE_PATH + '.tmp', STORE_PATH)
}

// --- Initialize empty store ---
function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    // Fresh clone: boot from bundled seed data (or empty when no seed file).
    const seed = readSeed()
    writeStore(seed || { questions: {}, version: 2, lastUpdated: new Date().toISOString() })
  }
}

// --- Calculate next review (simplified SM-2) ---
//   correct  → interval * 2
//   partial  → interval stays
//   incorrect → interval = 0 (due tomorrow)
function calcNextReview(interval, score, previousScore) {
  let newInterval
  if (score === 'correct') {
    newInterval = Math.max(1, Math.round((interval || 0) * 1.5))
  } else if (score === 'partial') {
    newInterval = Math.max(1, interval || 1)
  } else {
    newInterval = 0  // due immediately
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + newInterval)
  // Due at start of day
  nextDate.setHours(0, 0, 0, 0)

  return {
    interval: newInterval,
    nextReview: nextDate.toISOString().slice(0, 10),
    due: newInterval === 0
  }
}

// --- Get all questions due for review ---
function getDueQuestions(dateStr) {
  return dueQuestionsFrom(readStore(), dateStr)
}

// --- Due list derived from an ALREADY-READ store snapshot (pure) ---
// B7-4: GET /api/active-recall/due used to parse the store file 3x per
// request (getDueQuestions + getStats + the getDueQuestions nested inside
// getStats). These helpers derive both results from ONE readStore() call,
// still request-scoped — no module cache.
function dueQuestionsFrom(store, dateStr) {
  const today = dateStr || new Date().toISOString().slice(0, 10)
  const due = []

  for (const [id, q] of Object.entries(store.questions)) {
    // Due if: nextReview <= today OR never reviewed OR flagged as due
    if (!q.nextReview || q.due || q.nextReview <= today) {
      due.push({
        id,
        question: q.question,
        type: q.type,
        concept: q.concept,
        definition: q.definition,
        sourceNote: q.sourceNote,
        sourceBloque: q.sourceBloque,
        createdAt: q.createdAt,
        lastReview: q.reviews.length > 0 ? q.reviews[q.reviews.length - 1] : null,
        reviewCount: q.reviews.length,
        lastScore: q.reviews.length > 0 ? q.reviews[q.reviews.length - 1].score : null,
        interval: q.interval || 0,
        nextReview: q.nextReview || today,
        due: true
      })
    }
  }

  // Sort: most overdue first, then by interval (shorter = higher priority)
  due.sort((a, b) => {
    const aNext = a.nextReview || '0000-00-00'
    const bNext = b.nextReview || '0000-00-00'
    if (aNext !== bNext) return aNext.localeCompare(bNext)
    return (a.interval || 0) - (b.interval || 0)
  })

  return due
}

// --- Get a single question with full history ---
function getQuestion(id) {
  const store = readStore()
  const q = store.questions[id]
  if (!q) return null
  return {
    id,
    question: q.question,
    type: q.type,
    concept: q.concept,
    definition: q.definition,
    sourceNote: q.sourceNote,
    sourceBloque: q.sourceBloque,
    createdAt: q.createdAt,
    reviews: q.reviews,
    interval: q.interval || 0,
    nextReview: q.nextReview || null,
    due: q.due || false
  }
}

// --- Upsert a question with a new review ---
function submitReview({ question, type, answer, score, concept, definition, sourceNote, sourceBloque, agentFeedback, sessionId }) {
  const store = readStore()
  const id = hashQuestion(question)

  // Create or update question entry
  if (!store.questions[id]) {
    store.questions[id] = {
      question,
      type: type || 'question',
      concept: concept || null,
      definition: definition || null,
      sourceNote: sourceNote || null,
      sourceBloque: sourceBloque || 0,
      createdAt: new Date().toISOString(),
      reviews: [],
      interval: 0,
      nextReview: null,
      due: true
    }
  }

  const q = store.questions[id]
  const previousScore = q.reviews.length > 0 ? q.reviews[q.reviews.length - 1].score : null

  // Add review entry
  const review = {
    date: new Date().toISOString(),
    answer: answer || null,
    score,
    agentFeedback: agentFeedback || null,
    sessionId: sessionId || null
  }
  q.reviews.push(review)

  // Update concept/definition if provided (in case notes were updated)
  if (concept) q.concept = concept
  if (definition) q.definition = definition

  // Calculate spaced repetition
  const { interval, nextReview, due } = calcNextReview(q.interval, score, previousScore)
  q.interval = interval
  q.nextReview = nextReview
  q.due = due

  writeStore(store)
  return { id, review, interval, nextReview, due }
}

// --- Backfill from existing _active_recall/ files ---
export const INGEST_CAPS = Object.freeze({
  maxDepth: 12,
  maxFiles: 2000,
  maxBytesPerFile: 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
})

/**
 * Backfill questions from markdown files.
 *
 * Returns the number of newly imported questions (legacy numeric contract).
 * Truncation caused by a cap is reported through the optional `onTruncated`
 * out-param so existing callers keep their numeric return value.
 */
function ingestFromActiveRecall(recallDir, { caps = {}, onTruncated } = {}) {
  const limits = { ...INGEST_CAPS, ...caps }
  const store = readStore()
  let imported = 0
  let files = 0
  let totalBytes = 0
  let truncated = false

  function markTruncated() {
    if (truncated) return
    truncated = true
    if (typeof onTruncated === 'function') onTruncated()
  }

  function scanDir(dir, depth) {
    if (truncated || !fs.existsSync(dir)) return
    if (depth > limits.maxDepth) {
      markTruncated()
      return
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (truncated) return
      // Skip symlinks entirely: a link inside the vault may point anywhere,
      // and following it would defeat the containment guard.
      if (entry.isSymbolicLink()) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '_feedback_requests') continue
        scanDir(fullPath, depth + 1)
        continue
      }
      if (!entry.name.endsWith('.md')) continue

      if (files >= limits.maxFiles) {
        markTruncated()
        return
      }
      files++

      const size = fs.statSync(fullPath).size
      if (size > limits.maxBytesPerFile) {
        markTruncated()
        continue
      }
      if (totalBytes + size > limits.maxTotalBytes) {
        markTruncated()
        return
      }
      totalBytes += size

      const content = fs.readFileSync(fullPath, 'utf8')
      // Parse frontmatter (inline fields)
      const fm = {}
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        for (const line of fmMatch[1].split('\n')) {
          const idx = line.indexOf('::')
          if (idx !== -1) fm[line.slice(0, idx).trim()] = line.slice(idx + 2).trim()
        }
      }

      // Extract question from title (# Shadow Study: ... or # Active Recall: ...)
      const titleMatch = content.match(/^# (?:Shadow Study|Active Recall): (.+)$/m)
      if (!titleMatch) continue
      const question = titleMatch[1].trim()
      if (!question) continue

      // Extract answer from body
      const answerMatch = content.match(/## Mi respuesta(?: \(analogía\))?\n\n([\s\S]*?)(?:\n---|\n\*Evaluado|\n\*Respondido)/)
      const answer = answerMatch ? answerMatch[1].trim() : null

      // Extract self-evaluation from body (if not in frontmatter)
      let score = fm.auto_score || null
      if (!score) {
        const scoreMatch = content.match(/\*\*Autoevaluación:\*\*\s*(✅|🟡|❌)/)
        if (scoreMatch) {
          const emoji = scoreMatch[1]
          if (emoji === '✅') score = 'correct'
          else if (emoji === '🟡') score = 'partial'
          else if (emoji === '❌') score = 'incorrect'
        }
      }

      const id = hashQuestion(question)

      // Create question entry if not exists
      if (!store.questions[id]) {
        store.questions[id] = {
          question,
          type: fm.tipo || 'question',
          concept: fm.linked_concept || null,
          definition: null,
          sourceNote: fm.fuente || null,
          sourceBloque: 0,
          createdAt: fm.fecha ? new Date(fm.fecha).toISOString() : new Date().toISOString(),
          reviews: [],
          interval: 0,
          nextReview: null,
          due: true
        }
        imported++
      }

      // Add review from this file
      const q = store.questions[id]
      const existingReview = q.reviews.find(r => {
        const rDate = r.date.slice(0, 10)
        const fDate = fm.fecha || ''
        return rDate === fDate && r.score === (fm.auto_score || null)
      })

      if (!existingReview) {
        q.reviews.push({
          date: fm.fecha ? new Date(fm.fecha).toISOString() : new Date().toISOString(),
          answer: answer || null,
          score: score,
          agentFeedback: null,
          sessionId: 'backfill'
        })
      }
    }
  }

  scanDir(recallDir, 0)
  writeStore(store)
  return imported
}

// --- Seed questions from notes (create entries without reviews) ---
function seedQuestions(questions) {
  const store = readStore()
  let seeded = 0
  for (const q of questions) {
    const id = hashQuestion(q.question || q.text || '')
    if (!id) continue
    if (!store.questions[id]) {
      store.questions[id] = {
        question: q.question || q.text,
        type: q.type || 'question',
        concept: q.concept || null,
        definition: q.definition || null,
        sourceNote: q.sourceNote || null,
        sourceBloque: q.sourceBloque || 0,
        createdAt: new Date().toISOString(),
        reviews: [],
        interval: 0,
        nextReview: null,
        due: true
      }
      seeded++
    }
  }
  if (seeded > 0) writeStore(store)
  return seeded
}

// --- Get all questions with last review data ---
function getAllQuestions() {
  const store = readStore()
  const today = new Date().toISOString().slice(0, 10)
  return Object.entries(store.questions).map(([id, q]) => ({
    id,
    question: q.question,
    type: q.type,
    concept: q.concept,
    definition: q.definition,
    sourceNote: q.sourceNote,
    sourceBloque: q.sourceBloque,
    createdAt: q.createdAt,
    interval: q.interval || 0,
    nextReview: q.nextReview || null,
    due: q.due || (q.nextReview ? q.nextReview <= today : true),
    lastReview: q.reviews.length > 0 ? q.reviews[q.reviews.length - 1] : null,
    reviewCount: q.reviews.length,
    lastScore: q.reviews.length > 0 ? q.reviews[q.reviews.length - 1].score : null,
  }))
}

// --- Stats ---
function getStats() {
  const store = readStore()
  return statsFrom(store, dueQuestionsFrom(store))
}

// --- Stats derived from an ALREADY-READ store snapshot + its due list ---
// (see dueQuestionsFrom for the single-read rationale; dueCount comes from
// the same snapshot — multi-read inconsistency is impossible here).
function statsFrom(store, due) {
  const questions = Object.values(store.questions)
  const allReviews = questions.flatMap(q => q.reviews)

  const totalQuestions = questions.length
  const totalReviews = allReviews.length
  const dueCount = due.length
  const reviewedToday = allReviews.filter(r => r.date.slice(0, 10) === new Date().toISOString().slice(0, 10)).length

  // Streak: consecutive days with at least one review
  const reviewDates = [...new Set(allReviews.map(r => r.date.slice(0, 10)))].sort().reverse()
  let streak = 0
  const today = new Date()
  for (let i = 0; i < reviewDates.length; i++) {
    const d = new Date(reviewDates[i])
    const diff = Math.round((today - d) / 86400000)
    if (diff === streak) streak++
    else if (diff > streak) break
  }

  // Scores
  const lastScores = questions.map(q => q.reviews.length > 0 ? q.reviews[q.reviews.length - 1].score : null).filter(Boolean)
  const correct = lastScores.filter(s => s === 'correct').length
  const partial = lastScores.filter(s => s === 'partial').length
  const incorrect = lastScores.filter(s => s === 'incorrect').length

  return {
    totalQuestions,
    totalReviews,
    dueCount,
    reviewedToday,
    streak,
    scores: { correct, partial, incorrect },
    lastUpdated: store.lastUpdated
  }
}

// --- One readStore() serves both GET /due results (questions + stats) ---
function getDueWithStats(limit) {
  const store = readStore()
  const due = dueQuestionsFrom(store)
  const questions = Number.isFinite(limit) ? due.slice(0, limit) : due
  return { questions, stats: statsFrom(store, due) }
}

// --- Ensure store exists on import ---
ensureStore()

export {
  readStore,
  writeStore,
  hashQuestion,
  getDueQuestions,
  getAllQuestions,
  getQuestion,
  submitReview,
  getDueWithStats,
  seedQuestions,
  ingestFromActiveRecall,
  getStats
}
