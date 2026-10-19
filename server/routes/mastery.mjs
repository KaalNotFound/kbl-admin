import { Router } from 'express'

const router = Router()

/**
 * GET /mastery — All mastery data
 */
router.get('/mastery', async (req, res) => {
  try {
    const mastery = req.useCases.mastery.getMastery()
    req.log?.info('mastery_query', { moduleCount: Object.keys(mastery.modules || {}).length })
    res.json(mastery)
  } catch (error) {
    req.log?.error('mastery_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /mastery/modules — Module summaries
 */
router.get('/mastery/modules', async (req, res) => {
  try {
    const modules = req.useCases.mastery.getModules()
    res.json({ modules })
  } catch (error) {
    req.log?.error('mastery_modules_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /mastery/module/:moduleId — Single module detail
 */
router.get('/mastery/module/:moduleId', async (req, res) => {
  try {
    const module = req.useCases.mastery.getModule(req.params.moduleId)
    if (!module) {
      return res.status(404).json({ error: 'Module not found' })
    }
    res.json({ moduleId: req.params.moduleId, ...module })
  } catch (error) {
    req.log?.error('mastery_module_error', { moduleId: req.params.moduleId, error: error.message })
    res.status(500).json({ error: error.message })
  }
})

// ============================================================
// Contrato /api/study/* — consumidores: src/api/mastery.ts y
// mastery-routes.test.js (SPEC). Delegan al use-case mastery.
// ============================================================

/**
 * GET /study/mastery — All concepts (fetchMasteryAll)
 */
router.get('/study/mastery', async (req, res) => {
  try {
    const concepts = req.useCases.mastery.getAllMastery()
    res.json({ success: true, concepts, count: concepts.length })
  } catch (error) {
    req.log?.error('mastery_study_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /study/mastery/:concept — Concept detail (fetchMasteryConcept)
 */
router.get('/study/mastery/:concept', async (req, res) => {
  try {
    const data = req.useCases.mastery.getConceptDetail(req.params.concept)
    if (!data) {
      return res.status(404).json({ error: 'Concept not found' })
    }
    res.json({ success: true, data })
  } catch (error) {
    req.log?.error('mastery_concept_error', { concept: req.params.concept, error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /study/mastery/validate — Validate a concept (validateMasteryConcept)
 * Body: { concept, score, scoreType?, sourceNote?, sourceModule?, details? }
 */
router.post('/study/mastery/validate', async (req, res) => {
  try {
    const { concept, score, scoreType, sourceNote, sourceModule, details } = req.body || {}
    if (!concept) {
      return res.status(400).json({ error: 'concept is required' })
    }
    if (score === undefined || score === null) {
      return res.status(400).json({ error: 'score is required' })
    }
    const data = req.useCases.mastery.validateConcept({ concept, score, scoreType, sourceNote, sourceModule, details })
    res.json({ success: true, data })
  } catch (error) {
    req.log?.error('mastery_validate_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /study/skill-tree — Skill tree by module (fetchSkillTree)
 */
router.get('/study/skill-tree', async (req, res) => {
  try {
    const modules = req.useCases.mastery.getSkillTree()
    res.json({ success: true, modules })
  } catch (error) {
    req.log?.error('mastery_skilltree_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /study/debt — Cognitive debt (fetchCognitiveDebt)
 */
router.get('/study/debt', async (req, res) => {
  try {
    const data = req.useCases.mastery.calculateDebt()
    res.json({ success: true, data })
  } catch (error) {
    req.log?.error('mastery_debt_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /study/bias — Bias detection (fetchBiasData)
 */
router.get('/study/bias', async (req, res) => {
  try {
    const data = req.useCases.mastery.calculateBias()
    res.json({ success: true, data })
  } catch (error) {
    req.log?.error('mastery_bias_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /study/socratic — Socratic audit (submitSocraticAudit)
 * Body: { concept, operator_explanation, source_note? }
 */
router.post('/study/socratic', async (req, res) => {
  try {
    const { concept, operator_explanation, source_note } = req.body || {}
    if (!concept) {
      return res.status(400).json({ error: 'concept is required' })
    }
    if (!operator_explanation) {
      return res.status(400).json({ error: 'operator_explanation is required' })
    }
    const data = await req.useCases.mastery.evaluateSocratic(concept, operator_explanation, source_note)
    res.json({ success: true, data })
  } catch (error) {
    req.log?.error('mastery_socratic_error', { error: error.message })
    res.status(500).json({ error: error.message })
  }
})

export default router
