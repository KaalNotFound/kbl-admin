/**
 * Mastery — Use Cases
 *
 * Re-capetización Torre mastery (ADR-025, 2026-08-04): unifica la lógica que
 * vivía en lib/mastery-service.mjs (eliminado en esta torre) en un use-case de
 * aplicación con dependencias inyectadas por factory. Los routers
 * routes/mastery.mjs y routes/study.mjs reciben la lógica por DI
 * (req.useCases.mastery) y NO importan lib/ (boundary §2.1 — AGENTS §2.2).
 *
 * Todo el I/O (fs, http, paths) entra por deps: el use-case es puro respecto
 * a la infraestructura (mismo patrón que createFinanzasUseCases, torre finanzas).
 *
 * @param {object} deps
 * @param {object} deps.store — store legacy de mastery (lib/mastery-store.js)
 *   { getAllMastery, getConceptDetail, getSkillTree, getBypassStatus, validateConcept }
 * @param {object} deps.vault — helpers de vault (lib/vault-helpers.mjs)
 *   { studyPath, collectStudyFiles, readFile }
 * @param {object} deps.nlm — proxy NotebookLM (lib/notebooklm-proxy.mjs)
 *   { request: nlmRequest }
 */
function extractModule(noteName) {
  const match = noteName.match(/^(\d+)\.\s/)
  return match ? `M${match[1]}` : null
}

function calculateBurnDown(mastery, days) {
  const result = []
  const now = new Date()
  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const threshold = d.getTime()
    const remaining = mastery.filter(c => {
      if (!c.lastValidated) return true
      return new Date(c.lastValidated).getTime() < threshold
    }).length
    result.push({ date: dateStr, remaining })
  }
  return result
}

function buildSocraticPrompt(concept, explanation, sourceNote) {
  return `Eres un tutor experto en programación y ciencias de la computación.

Evalúa la siguiente explicación de un concepto técnico.

**Concepto:** ${concept}
${sourceNote ? `**Fuente:** ${sourceNote}` : ''}
**Explicación del estudiante:**
${explanation}

Evalúa en 4 dimensiones (cada una 0-25 puntos, total 0-100):
1. **Precisión:** ¿La explicación es técnicamente correcta?
2. **Completitud:** ¿Cubre los aspectos fundamentales del concepto?
3. **Simplicidad:** ¿Usa lenguaje claro o depende excesivamente de jerga técnica?
4. **Conexiones:** ¿Relaciona el concepto con otros temas o con ejemplos reales?

Responde EXCLUSIVAMENTE con este JSON (sin texto adicional):
{"score": N, "feedback": "...", "strengths": ["..."], "gaps": ["..."], "challenge": "Pregunta desafiante si score < 85"}`
}

function parseSocraticEvaluation(answer) {
  try {
    const jsonMatch = answer.match(/\{[\s\S]*"score"[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        score: Math.max(0, Math.min(100, parsed.score || 0)),
        feedback: parsed.feedback || answer,
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
        challenge: parsed.challenge || '',
      }
    }
  } catch { /* fall through */ }

  return {
    score: 50,
    feedback: answer.slice(0, 500),
    strengths: [],
    gaps: ['No se pudo parsear la evaluación de NLM'],
    challenge: '',
  }
}

function basicEvaluation(concept, explanation) {
  const len = explanation.length
  const hasTechnicalTerms = /[\w]+\([\)]|function|class|return|const|let|var|if|for|while/i.test(explanation)
  const hasAnalogies = /como|parece|similar|imagina|supongamos|ejemplo/i.test(explanation)

  let score = 30
  if (len > 50) score += 10
  if (len > 150) score += 10
  if (len > 300) score += 10
  if (hasTechnicalTerms) score += 10
  if (hasAnalogies) score += 15

  return {
    score: Math.max(0, Math.min(100, score)),
    feedback: 'Evaluación básica (NotebookLM no disponible). Subí el score manualmente si es necesario.',
    strengths: len > 100 ? ['Explicación extensa'] : [],
    gaps: len < 100 ? ['Explicación muy corta'] : ['NotebookLM offline — evaluación limitada'],
    challenge: '',
  }
}

// ─── LLM output boundary (LLM01/LLM09) ──────────────────────────────────────
// The prompt is data, not authority: user text shapes it (injection can drive
// arbitrary verdicts), and the model's answer is untrusted input. Everything
// parsed from it is validated and clamped HERE, before it reaches the store
// or the response — a persisted score ALWAYS satisfies
// 0 <= score <= 100 && Number.isFinite(score).

const EVAL_LIMITS = { feedback: 2000, listItems: 10, listItem: 300, challenge: 500 }

function clampStringList(value, maxItemLen) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => typeof item === 'string')
    .slice(0, EVAL_LIMITS.listItems)
    .map((item) => item.slice(0, maxItemLen))
}

/**
 * Pure: validate/clamp a parsed socratic evaluation. Returns null when the
 * score is not a finite number — the caller then uses the basic fallback.
 */
export function normalizeEvaluation(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { score } = raw
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  return {
    score: Math.max(0, Math.min(100, score)),
    feedback: typeof raw.feedback === 'string' ? raw.feedback.slice(0, EVAL_LIMITS.feedback) : '',
    strengths: clampStringList(raw.strengths, EVAL_LIMITS.listItem),
    gaps: clampStringList(raw.gaps, EVAL_LIMITS.listItem),
    challenge: typeof raw.challenge === 'string' && raw.challenge.trim()
      ? raw.challenge.slice(0, EVAL_LIMITS.challenge)
      : null,
  }
}

export function createMasteryUseCases({ store, vault, nlm }) {
  const getAllMastery = store.getAllMastery

  // --- Vault concept extraction (I/O por deps.vault, degradación silenciosa) ---

  function extractVaultConcepts() {
    const concepts = []
    try {
      const files = vault.collectStudyFiles(vault.studyPath)
      for (const { name, fullPath } of files) {
        try {
          const content = vault.readFile(fullPath)
          const fieldRegex = /conceptos?::\s*(.+?)(?:\n|$)/g
          let match
          while ((match = fieldRegex.exec(content)) !== null) {
            const segments = match[1].split(/\.\s+/).filter(s => s.trim())
            for (const seg of segments) {
              const dashIdx = seg.indexOf(' — ')
              const concepto = (dashIdx !== -1 ? seg.slice(0, dashIdx) : seg).trim()
              if (concepto) concepts.push({ concept: concepto, module: extractModule(name) })
            }
          }
        } catch { /* skip unreadable files */ }
      }
    } catch { /* STUDY_PATH inexistente → sin conceptos (degradación por diseño) */ }
    return concepts
  }

  // --- Lectura agregada (shape { modules } del contrato legacy) ---

  function getMastery() {
    const list = getAllMastery()
    const modules = {}
    for (const item of list) {
      const m = (modules[item.module] ??= { moduleName: item.module, concepts: {} })
      m.concepts[item.id] = {
        conceptName: item.concept,
        mastery: item.currentScore || 0,
        level: item.level ?? 0,
        lastReviewed: item.lastReviewed || null,
      }
    }
    return { modules }
  }

  // --- Resúmenes por módulo (endpoint GET /mastery/modules) ---

  function getModules() {
    const mastery = getMastery()
    return Object.entries(mastery.modules || {}).map(([id, data]) => ({
      moduleId: id,
      moduleName: data.moduleName || id,
      conceptCount: Object.keys(data.concepts || {}).length,
      avgMastery: Object.values(data.concepts || {}).reduce((sum, c) => sum + (c.mastery || 0), 0) / Math.max(Object.keys(data.concepts || {}).length, 1),
    }))
  }

  // --- Detalle de un módulo (endpoint GET /mastery/module/:moduleId) ---

  function getModule(moduleId) {
    const mastery = getMastery()
    return mastery.modules?.[moduleId] || null
  }

  // --- Deuda de conocimiento (cálculo puro + conceptos del vault) ---

  function calculateDebt() {
    const allMastery = getAllMastery()
    const vaultConcepts = extractVaultConcepts()
    const totalVaultConcepts = vaultConcepts.length
    const validatedConcepts = allMastery.filter(c => c.currentScore > 0).length
    const consolidatedConcepts = allMastery.filter(c => c.level >= 2).length

    const debtRatio = totalVaultConcepts > 0
      ? Math.round(((totalVaultConcepts - consolidatedConcepts) / totalVaultConcepts) * 100)
      : 0

    const burnDown = calculateBurnDown(allMastery, 30)

    const byModule = {}
    for (const c of allMastery) {
      const mod = c.module || 'Sin módulo'
      if (!byModule[mod]) byModule[mod] = { module: mod, total: 0, validated: 0, consolidated: 0 }
      byModule[mod].total++
      if (c.currentScore > 0) byModule[mod].validated++
      if (c.level >= 2) byModule[mod].consolidated++
    }

    const alert = debtRatio > 60
      ? 'Necesitás una sesión de validación — deuda > 60%'
      : debtRatio > 30
        ? 'Deuda moderada — Considerá hacer un Feynman Audit'
        : null

    return {
      total_concepts: totalVaultConcepts,
      validated: validatedConcepts,
      consolidated: consolidatedConcepts,
      debt_ratio: debtRatio,
      by_module: Object.values(byModule),
      burn_down_history: burnDown,
      alert,
    }
  }

  // --- Detección de sesgo (automation vs humano, ilusión, staleness) ---

  function calculateBias() {
    const allMastery = getAllMastery()

    const manualScores = allMastery.filter(c => c.totalScores > 0).length
    const autoFed = allMastery.filter(c => c.lastValidated && c.totalScores === 1).length
    const humanRatio = manualScores > 0
      ? Math.round(((manualScores - autoFed) / manualScores) * 100)
      : 100

    const illusionCount = allMastery.filter(c => {
      const hasCorrect = c.correctCount > 0
      const lowScore = c.currentScore < 40
      return hasCorrect && lowScore
    }).length

    const staleThreshold = Date.now() - 14 * 24 * 60 * 60 * 1000
    const staleConcepts = allMastery.filter(c => {
      if (!c.lastValidated) return true
      return new Date(c.lastValidated).getTime() < staleThreshold
    })

    const alerts = []
    if (humanRatio < 30) {
      alerts.push({
        type: 'automation', severity: 'high',
        message: `Ratio IA alto: ${humanRatio}% humano. Considerá hacer más Feynman audits.`,
      })
    }
    if (illusionCount > 0) {
      alerts.push({
        type: 'illusion', severity: 'medium',
        message: `${illusionCount} conceptos con posible ilusión de competencia (correctas en recall pero score bajo).`,
      })
    }
    if (staleConcepts.length > 0) {
      alerts.push({
        type: 'staleness', severity: staleConcepts.length > 5 ? 'high' : 'low',
        message: `${staleConcepts.length} conceptos sin validar en 14+ días.`,
      })
    }

    return {
      human_vs_ai_ratio: humanRatio,
      illusion_of_competence: illusionCount,
      staleness_index: staleConcepts.length,
      alerts,
      stale_concepts: staleConcepts.slice(0, 10).map(c => ({ concept: c.concept, lastValidated: c.lastValidated })),
    }
  }

  // --- Evaluación socrática (NLM vía deps.nlm, fallback básico) ---

  async function evaluateSocratic(concept, operatorExplanation, sourceNote) {
    let evaluation
    try {
      const prompt = buildSocraticPrompt(concept, operatorExplanation, sourceNote)
      const nlmResult = await nlm.request('POST', '/ask', { question: prompt })
      // Boundary: normalize (or reject) the LLM verdict before it persists.
      evaluation = normalizeEvaluation(parseSocraticEvaluation(nlmResult?.data?.answer || ''))
    } catch {
      evaluation = null
    }
    if (!evaluation) evaluation = basicEvaluation(concept, operatorExplanation)

    const result = store.validateConcept({
      concept,
      score: evaluation.score,
      scoreType: 'feynman',
      sourceNote: sourceNote,
      details: JSON.stringify({ explanation: operatorExplanation.slice(0, 500), feedback: evaluation.feedback }),
    })

    return {
      score: evaluation.score,
      feedback: evaluation.feedback,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      challenge_question: evaluation.score < 85 ? evaluation.challenge : null,
      mastery: result,
    }
  }

  return {
    getMastery,
    getAllMastery,
    getModules,
    getModule,
    getConceptDetail: store.getConceptDetail,
    getSkillTree: store.getSkillTree,
    getBypassStatus: store.getBypassStatus,
    validateConcept: store.validateConcept,
    calculateDebt,
    calculateBias,
    evaluateSocratic,
  }
}
