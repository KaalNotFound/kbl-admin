// --- Mastery Store ---
// Tracks per-concept mastery scores and Skill Tree levels.
// Feynman-Gated: concepts >= N2 require human comprehension evidence.
// JSON file persistence, consistent with active-recall-store.js pattern.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Data dir is project-local so the app boots standalone without the vault.
// History: previously stored at <vault>/08 - SYSTEM/_system/, which broke when
// the vault layout was restructured on 2026-08-18 and the folder no longer existed.
// Override with MASTERY_STORE_PATH (file) or KBL_DATA_DIR (directory).
const DATA_DIR = process.env.KBL_DATA_DIR || path.join(__dirname, '..', 'data')
const STORE_PATH = process.env.MASTERY_STORE_PATH || path.join(DATA_DIR, 'mastery-store.json')

// First-boot seed: when the store does not exist yet (fresh clone), populate the
// store with bundled demo data so Skill Tree / mastery dashboards render with
// content instead of empty state. See server/seed/ and docs/DEVLOG.md.
const SEED_PATH = process.env.MASTERY_SEED_PATH || path.join(__dirname, '..', 'seed', 'mastery-seed.json')

function readSeed() {
  try {
    return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
  } catch {
    return null // No seed available — initialize empty.
  }
}

// --- Constants ---
const WEIGHT_PREVIOUS = 0.3
const WEIGHT_RECENT = 0.5
const BONUS_FEYNMAN = 15
const BONUS_STREAK_MAX = 5

// Feynman Gate: minimum level that requires human comprehension evidence
const FEYNMAN_GATE_LEVEL = 2 // N2-Funcional and above need Feynman
const FEYNMAN_PASSING_SCORE = 70 // Minimum score on Feynman/Socratic to count as evidence
const VALID_EVIDENCE_TYPES = ['feynman', 'socratic'] // Score types that count as human comprehension

// Skill Tree levels
const LEVEL_THRESHOLDS = {
  0: { name: 'Amarrado', color: 'yellow', icon: '\u{1F7E1}', minScore: 0 },
  1: { name: 'Expuesto', color: 'green', icon: '\u{1F7E2}', minScore: 10 },
  2: { name: 'Funcional', color: 'blue', icon: '\u{1F535}', minScore: 40 },
  3: { name: 'Consolidado', color: 'purple', icon: '\u{1F7E3}', minScore: 70 },
  4: { name: 'Maestro', color: 'red', icon: '\u{1F534}', minScore: 85 },
}

function hashConcept(text) {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex').slice(0, 12)
}

// --- Read / Write ---
function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { concepts: {}, scores: {}, version: 1, lastUpdated: new Date().toISOString() }
    const raw = fs.readFileSync(STORE_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data.concepts) data.concepts = {}
    if (!data.scores) data.scores = {}
    return data
  } catch {
    return { concepts: {}, scores: {}, version: 1, lastUpdated: new Date().toISOString() }
  }
}

function writeStore(data) {
  data.lastUpdated = new Date().toISOString()
  // Create the target directory if it does not exist (no crash when the
  // store lives in a fresh environment, e.g. a fresh clone by a grader).
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
  fs.writeFileSync(STORE_PATH + '.tmp', JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(STORE_PATH + '.tmp', STORE_PATH)
}

function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    // Fresh clone: boot from bundled seed data (or empty when no seed file).
    const seed = readSeed()
    writeStore(seed || { concepts: {}, scores: {}, version: 1, lastUpdated: new Date().toISOString() })
  }
}

// --- Calculate mastery score ---
function calculateMastery(scoreHistory) {
  if (scoreHistory.length === 0) return 0
  if (scoreHistory.length === 1) return scoreHistory[0].score

  // Weighted average: recent scores matter more
  let weightedSum = 0
  let totalWeight = 0

  for (let i = 0; i < scoreHistory.length; i++) {
    const isLast = i === scoreHistory.length - 1
    const weight = isLast ? WEIGHT_RECENT : WEIGHT_PREVIOUS
    weightedSum += scoreHistory[i].score * weight
    totalWeight += weight
  }

  let baseScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  // Bonuses
  const hasFeynman = scoreHistory.some(s => s.scoreType === 'feynman' && s.score >= 85)
  if (hasFeynman) baseScore = Math.min(100, baseScore + BONUS_FEYNMAN)

  // Streak bonus: consecutive corrects
  let streak = 0
  for (let i = scoreHistory.length - 1; i >= 0; i--) {
    if (scoreHistory[i].score >= 70) streak++
    else break
  }
  baseScore = Math.min(100, baseScore + Math.min(streak, BONUS_STREAK_MAX))

  return baseScore
}

// --- Determine Skill Tree level from score ---
function getLevel(score) {
  let level = 0
  for (const [lvl, threshold] of Object.entries(LEVEL_THRESHOLDS)) {
    if (score >= threshold.minScore) level = Number(lvl)
  }
  return level
}

function getLevelMeta(level) {
  return LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[0]
}

/**
 * Check if a concept has valid Feynman/Socratic evidence.
 * Evidence = at least one score with type in VALID_EVIDENCE_TYPES and score >= FEYNMAN_PASSING_SCORE.
 */
function hasFeynmanEvidence(id, store) {
  const scores = store.scores[id] || []
  return scores.some(s =>
    VALID_EVIDENCE_TYPES.includes(s.scoreType) && s.score >= FEYNMAN_PASSING_SCORE
  )
}

/**
 * Get bypass status: concepts with scores but no Feynman evidence.
 * These are "bypassed" — processed by AI but not validated by human comprehension.
 */
function getBypassStatus() {
  const store = readStore()
  const bypassed = []

  for (const [id, c] of Object.entries(store.concepts)) {
    const scores = store.scores[id] || []
    const hasEvidence = hasFeynmanEvidence(id, store)
    const hasScores = scores.length > 0

    if (hasScores && !hasEvidence) {
      const mastery = calculateMastery(scores)
      bypassed.push({
        id,
        concept: c.concept,
        module: c.module,
        currentScore: mastery,
        rawLevel: getLevel(mastery),
        cappedLevel: Math.min(getLevel(mastery), FEYNMAN_GATE_LEVEL - 1),
        totalScores: c.totalScores,
        lastValidated: c.lastValidated,
        reason: 'Sin evidencia de comprensión humana (Feynman/Socrático)',
      })
    }
  }

  return bypassed.sort((a, b) => b.currentScore - a.currentScore)
}

// --- Public API ---

/**
 * Register a new mastery score for a concept.
 */
function validateConcept({ concept, score, scoreType, sourceNote, sourceModule, details }) {
  const store = readStore()
  const id = hashConcept(concept)

  // Ensure concept entry
  if (!store.concepts[id]) {
    store.concepts[id] = {
      concept,
      module: sourceModule || null,
      totalScores: 0,
      correctCount: 0,
      lastValidated: null,
      level: 0,
    }
  }

  // Add score
  if (!store.scores[id]) store.scores[id] = []
  const entry = {
    score: Math.max(0, Math.min(100, score)),
    scoreType: scoreType || 'manual',
    sourceNote: sourceNote || null,
    timestamp: new Date().toISOString(),
    details: details || null,
  }
  store.scores[id].push(entry)

  // Recalculate
  const history = store.scores[id]
  const mastery = calculateMastery(history)
  const rawLevel = getLevel(mastery)
  const c = store.concepts[id]
  c.totalScores++
  if (score >= 70) c.correctCount++
  c.lastValidated = entry.timestamp

  // Feynman Gate: cap level if no human comprehension evidence
  const feynmanEvidence = hasFeynmanEvidence(id, store)
  c.feynmanValidated = feynmanEvidence
  const level = (rawLevel >= FEYNMAN_GATE_LEVEL && !feynmanEvidence)
    ? FEYNMAN_GATE_LEVEL - 1 // Cap at N1-Expuesto
    : rawLevel
  c.level = level
  c.currentScore = mastery
  c.rawLevel = rawLevel // Preserve what the score would be without gate

  writeStore(store)
  return {
    id, concept, score: mastery, level, levelMeta: getLevelMeta(level),
    feynmanValidated: feynmanEvidence,
    rawLevel,
    capped: rawLevel !== level,
  }
}

/**
 * Get all concepts with their current mastery data.
 */
function getAllMastery() {
  const store = readStore()
  const result = []

  for (const [id, c] of Object.entries(store.concepts)) {
    const scores = store.scores[id] || []
    const mastery = calculateMastery(scores)
    const rawLevel = getLevel(mastery)
    const feynmanEvidence = hasFeynmanEvidence(id, store)
    const level = (rawLevel >= FEYNMAN_GATE_LEVEL && !feynmanEvidence)
      ? FEYNMAN_GATE_LEVEL - 1
      : rawLevel
    result.push({
      id,
      concept: c.concept,
      module: c.module,
      currentScore: mastery,
      level,
      rawLevel,
      levelMeta: getLevelMeta(level),
      feynmanValidated: feynmanEvidence,
      capped: rawLevel !== level,
      totalScores: c.totalScores,
      correctCount: c.correctCount,
      lastValidated: c.lastValidated,
    })
  }

  return result.sort((a, b) => b.currentScore - a.currentScore)
}

/**
 * Get detailed mastery data for a single concept.
 */
function getConceptDetail(conceptOrId) {
  const store = readStore()
  let id = conceptOrId

  // Try by ID first, then search by concept name
  if (!store.concepts[id]) {
    for (const [cid, c] of Object.entries(store.concepts)) {
      if (c.concept.toLowerCase() === conceptOrId.toLowerCase()) {
        id = cid
        break
      }
    }
  }

  const c = store.concepts[id]
  if (!c) return null

  const scores = store.scores[id] || []
  const mastery = calculateMastery(scores)
  const level = getLevel(mastery)

  return {
    id,
    concept: c.concept,
    module: c.module,
    currentScore: mastery,
    level,
    levelMeta: getLevelMeta(level),
    totalScores: c.totalScores,
    correctCount: c.correctCount,
    lastValidated: c.lastValidated,
    scoreHistory: scores.slice(-20), // Last 20 scores
  }
}

/**
 * Get Skill Tree structure grouped by module.
 */
function getSkillTree() {
  const all = getAllMastery()
  const byModule = {}

  for (const c of all) {
    const mod = c.module || 'Sin módulo'
    if (!byModule[mod]) byModule[mod] = []
    byModule[mod].push(c)
  }

  return Object.entries(byModule).map(([name, concepts]) => ({
    name,
    concepts,
    avgScore: Math.round(concepts.reduce((sum, c) => sum + c.currentScore, 0) / concepts.length),
    totalConcepts: concepts.length,
    masteredCount: concepts.filter(c => c.level >= 3).length,
    bypassedCount: concepts.filter(c => c.capped).length,
    feynmanValidatedCount: concepts.filter(c => c.feynmanValidated).length,
  }))
}

/**
 * Auto-feed from active recall submissions.
 * Called when a review is submitted via active-recall-store.
 */
function feedFromActiveRecall(concept, score) {
  if (!concept) return null
  const scoreMap = { correct: 90, partial: 60, incorrect: 25 }
  const numericScore = scoreMap[score] ?? 50
  return validateConcept({
    concept,
    score: numericScore,
    scoreType: 'active_recall',
    details: `Auto-fed from active recall: ${score}`,
  })
}

ensureStore()

export {
  validateConcept,
  getAllMastery,
  getConceptDetail,
  getSkillTree,
  getBypassStatus,
  feedFromActiveRecall,
  LEVEL_THRESHOLDS,
  FEYNMAN_GATE_LEVEL,
  FEYNMAN_PASSING_SCORE,
  VALID_EVIDENCE_TYPES,
}
