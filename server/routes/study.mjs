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

export default router
