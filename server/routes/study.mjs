import { Router } from 'express'

const router = Router()

/**
 * POST /study/start-session
 * Body: { moduleId, conceptHashes? }
 * Creates a study session with due concepts.
 */
router.post('/study/start-session', async (req, res) => {
  try {
    const { moduleId, conceptHashes } = req.body || {}
    if (!moduleId) {
      return res.status(400).json({ error: 'moduleId is required' })
    }

    const mastery = req.useCases.mastery.getMastery()
    const module = mastery.modules?.[moduleId]
    if (!module) {
      return res.status(404).json({ error: `Module "${moduleId}" not found` })
    }

    // Filter to requested concepts or all in module
    const concepts = conceptHashes
      ? Object.entries(module.concepts || {}).filter(([hash]) => conceptHashes.includes(hash))
      : Object.entries(module.concepts || {})

    const session = {
      sessionId: `session-${Date.now()}`,
      moduleId,
      startedAt: new Date().toISOString(),
      concepts: concepts.map(([hash, data]) => ({
        conceptHash: hash,
        conceptName: data.conceptName || hash,
        currentMastery: data.mastery || 0,
      })),
    }

    req.log?.info('study_session_started', { sessionId: session.sessionId, moduleId, conceptCount: session.concepts.length })
    res.status(201).json(session)
  } catch (error) {
    req.log?.error('study_session_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /study/record-quiz
 * Body: { moduleId, conceptHash, correct, score }
 * Records quiz result and updates mastery.
 */
router.post('/study/record-quiz', async (req, res) => {
  try {
    const { moduleId, conceptHash, correct, score } = req.body || {}
    if (!moduleId || !conceptHash || correct === undefined) {
      return res.status(400).json({ error: 'moduleId, conceptHash, and correct are required' })
    }

    const mastery = req.useCases.mastery.getMastery()
    const module = mastery.modules?.[moduleId]
    if (!module) {
      return res.status(404).json({ error: `Module "${moduleId}" not found` })
    }

    const concept = module.concepts?.[conceptHash]
    if (!concept) {
      return res.status(404).json({ error: `Concept "${conceptHash}" not found in module "${moduleId}"` })
    }

    // Update mastery score
    const currentMastery = concept.mastery || 0
    const newMastery = correct
      ? Math.min(100, currentMastery + (score || 10))
      : Math.max(0, currentMastery - 5)

    concept.mastery = newMastery
    concept.lastReviewed = new Date().toISOString()
    concept.reviewCount = (concept.reviewCount || 0) + 1

    req.log?.info('quiz_recorded', { moduleId, conceptHash, correct, newMastery })
    res.json({
      conceptHash,
      previousMastery: currentMastery,
      newMastery,
      correct,
    })
  } catch (error) {
    req.log?.error('quiz_record_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

// --- Study data endpoints (restored 2026-10-19) ---
// The frontend StudyDashboard consumes these (src/api/study.ts); they were
// orphaned by the DI refactor and answered 404. They delegate to
// req.useCases.studyData — no lib/ imports in the router (boundary §2.1).

/**
 * GET /study/data — parsed study notes, concepts, questions, doubts.
 */
router.get('/study/data', async (req, res) => {
  try {
    res.json(req.useCases.studyData.getData())
  } catch (error) {
    req.log?.error('study_data_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /study/history — answer history from the active-recall dirs.
 */
router.get('/study/history', async (req, res) => {
  try {
    res.json(req.useCases.studyData.getHistory())
  } catch (error) {
    req.log?.error('study_history_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /study/answer — persist an answer to a study question as a markdown
 * file in the active-recall directory.
 */
router.post('/study/answer', async (req, res) => {
  try {
    const { question, answer, sourceNote, answerType } = req.body || {}
    if (!question) return res.status(400).json({ error: 'question is required' })
    const result = req.useCases.studyData.saveAnswer({ question, answer, sourceNote, answerType })
    res.status(201).json({ success: true, ...result })
  } catch (error) {
    req.log?.error('study_answer_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /study/self-score — persist a self-evaluation (correct/partial/incorrect).
 */
router.post('/study/self-score', async (req, res) => {
  try {
    const { questionOrDoubt, type, score, linkedConcept } = req.body || {}
    if (!questionOrDoubt) return res.status(400).json({ error: 'questionOrDoubt is required' })
    const result = req.useCases.studyData.saveSelfScore({ questionOrDoubt, type, score, linkedConcept })
    res.status(201).json({ success: true, ...result })
  } catch (error) {
    req.log?.error('study_self_score_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /study/feedback-request — queue a feedback session for offline processing.
 */
router.post('/study/feedback-request', async (req, res) => {
  try {
    const session = req.body || {}
    if (!session.sessionId) return res.status(400).json({ error: 'sessionId is required' })
    const result = req.useCases.studyData.saveFeedbackRequest(session)
    res.status(201).json({ success: true, ...result })
  } catch (error) {
    req.log?.error('study_feedback_request_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

export default router
