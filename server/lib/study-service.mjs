// study-service.mjs — Study data parsing, enrichment, caching
// Extracted from routes/study.mjs Phase 2 CSR refactor.
import fs from 'fs'
import path from 'path'
import { VAULT_ROOT, STUDY_PATH, ACTIVE_RECALL_DIR, FEEDBACK_DIR, readFile, collectStudyFiles, ensureDir, generateSlug, buildFrontmatter, parseFrontmatter } from '../infrastructure/vault-fs-adapter.mjs'

// --- Study block parser (JSON blocks with {bloque: N}) ---

export function parseStudyBlocks(content) {
  const blocks = []
  let stack = []
  let start = -1
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (ch === '{') {
      if (stack.length === 0) start = i
      stack.push(i)
    } else if (ch === '}') {
      stack.pop()
      if (stack.length === 0 && start >= 0) {
        try {
          const block = JSON.parse(content.slice(start, i + 1))
          if (block.bloque !== undefined) blocks.push(block)
        } catch (e) { console.warn('[study] parseStudyBlocks: malformed JSON block at pos', start, e.message) }
        start = -1
      }
    }
  }
  return blocks
}

// --- Note format detection ---

export function detectNoteFormat(content) {
  if (content.trimStart().startsWith('{')) return 'json-blocks'
  if (content.includes('entity_type::')) return 'inline-fields'
  if (content.includes('---\n')) return 'yaml-frontmatter'
  return 'markdown'
}

// --- Semantic enrichment ---

const STOP_WORDS = new Set(['de','la','el','los','las','del','al','por','para','con','sin','en','un','una','y','e','o','a','que','es','se','no','su','lo','le','como','más','pero','todo','esta','este','entre','cada','cuando','muy','qué','cómo','por qué','tiene','son','sea','fue','era'])

function tokenize(str) {
  return str.toLowerCase()
    .replace(/[¿?()\[\]"'¡!.,:;]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
}

export function findBestConceptForText(concepts, note, bloque, text) {
  const matches = concepts.filter(c => c.note === note && c.bloque === bloque)
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  const textLower = text.toLowerCase()
  for (const c of matches) {
    if (textLower.includes(c.concepto.toLowerCase())) return c
  }

  const textTokens = new Set(tokenize(text))
  let bestMatch = null, bestOverlap = 0
  for (const c of matches) {
    const conceptTokens = tokenize(c.concepto)
    const overlap = conceptTokens.filter(t => textTokens.has(t)).length
    if (overlap > bestOverlap) { bestOverlap = overlap; bestMatch = c }
  }
  if (bestOverlap > 0) return bestMatch

  return matches.sort((a, b) => {
    const scoreA = a.definicion ? 2 : a.analogia ? 1 : 0
    const scoreB = b.definicion ? 2 : b.analogia ? 1 : 0
    return scoreB - scoreA
  })[0]
}

// --- Cache ---

let studyDataCache = { data: null, ts: 0 }
const STUDY_CACHE_TTL = 10000

function getStudyDataCached() {
  const now = Date.now()
  if (studyDataCache.data && (now - studyDataCache.ts) < STUDY_CACHE_TTL) return studyDataCache.data
  return null
}

function setStudyDataCache(data) {
  studyDataCache.data = data
  studyDataCache.ts = Date.now()
}

// --- Core: build study data from all files ---

export function buildStudyData() {
  const cached = getStudyDataCached()
  if (cached) return cached

  const notes = []
  const concepts = []
  const questions = []
  const doubts = []

  if (!fs.existsSync(STUDY_PATH)) {
    return { notes: [], concepts: [], questions: [], doubts: [] }
  }

  const files = collectStudyFiles(STUDY_PATH)

  for (const { name, fullPath } of files) {
    const stat = fs.statSync(fullPath)
    const content = fs.readFileSync(fullPath, 'utf8')
    const blocks = parseStudyBlocks(content)
    const format = detectNoteFormat(content)

    const inlineConcepts = []
    const inlineQuestions = []
    const inlineDoubts = []
    const inlineDefiniciones = []

    if (format === 'inline-fields') {
      parseInlineFields(content, name, { inlineConcepts, inlineQuestions, inlineDoubts, inlineDefiniciones })
    }

    const hasQuestions = inlineQuestions.length > 0 || blocks.some(b => (b.preguntas_activas || []).length > 0)

    notes.push({
      name, size: stat.size, modified: stat.mtime.toISOString(),
      bloques: blocks.length + inlineConcepts.length + inlineQuestions.length + inlineDoubts.length,
      format, hasQuestions
    })

    for (const b of blocks) {
      for (const c of (b.conceptos_capturados || [])) {
        concepts.push({ note: name, bloque: b.bloque, concepto: c.concepto || '', analogia: c.tu_analogia || '' })
      }
      for (const q of (b.preguntas_activas || [])) {
        questions.push({ note: name, bloque: b.bloque, question: q })
      }
      const d = b.dudas
      if (d && d !== 'Ninguna en este bloque. Todo resonó.') {
        doubts.push({ note: name, bloque: b.bloque, doubt: d })
      }
    }

    for (const c of inlineConcepts) {
      concepts.push({ note: c.note, bloque: c.bloque, concepto: c.concepto, analogia: c.analogia || '', definicion: c.definicion || undefined })
    }
    for (const q of inlineQuestions) {
      questions.push({ note: q.note, bloque: q.bloque, question: q.question })
    }
    for (const d of inlineDoubts) {
      doubts.push({ note: d.note, bloque: d.bloque, doubt: d.doubt })
    }
  }

  // Enrich questions and doubts with linked concepts
  for (const q of questions) {
    const match = findBestConceptForText(concepts, q.note, q.bloque, q.question)
    q.linkedConcept = match ? match.concepto : null
    q.linkedDefinition = match ? (match.definicion || match.analogia || null) : null
  }
  for (const d of doubts) {
    const match = findBestConceptForText(concepts, d.note, d.bloque, d.doubt)
    d.linkedConcept = match ? match.concepto : null
    d.linkedDefinition = match ? (match.definicion || match.analogia || null) : null
  }

  const response = {
    notes: notes.sort((a, b) => a.name.localeCompare(b.name)),
    concepts, questions, doubts
  }
  setStudyDataCache(response)
  return response
}

// --- Inline field parser ---

function parseInlineFields(content, name, output) {
  const body = content.replace(/^---[\s\S]*?---\n*/, '')
  const fieldRegex = /([a-zA-Z_]+)::\s*(.+?)(?:\n|$)/g
  let match
  while ((match = fieldRegex.exec(body)) !== null) {
    const key = match[1].trim()
    const val = match[2].trim()
    if (key === 'conceptos_clave') {
      output.inlineConcepts.push(...val.split(',').map(s => ({
        concepto: s.trim(), note: name, bloque: 0
      })).filter(c => c.concepto))
    } else if (key === 'conceptos') {
      const segments = val.split(/\.\s+/).filter(s => s.trim())
      for (const seg of segments) {
        const dashIdx = seg.indexOf(' — ')
        if (dashIdx !== -1) {
          output.inlineConcepts.push({ concepto: seg.slice(0, dashIdx).trim(), analogia: seg.slice(dashIdx + 3).trim(), note: name, bloque: 0 })
        } else {
          output.inlineConcepts.push({ concepto: seg.trim(), analogia: '', note: name, bloque: 0 })
        }
      }
    } else if (key === 'definicion') {
      const segments = val.split(/\.\s+/).filter(s => s.trim())
      for (const seg of segments) {
        const dashIdx = seg.indexOf(' — ')
        if (dashIdx !== -1) {
          output.inlineDefiniciones.push({ concepto: seg.slice(0, dashIdx).trim(), definicion: seg.slice(dashIdx + 3).trim() })
        }
      }
    } else if (key === 'pregunta') {
      const subQuestions = val.split(/(?<=\?)\s+(?=¿)/).filter(s => s.trim())
      for (const sq of subQuestions) {
        output.inlineQuestions.push({ note: name, bloque: 0, question: sq.trim() })
      }
    } else if (key === 'duda') {
      output.inlineDoubts.push({ note: name, bloque: 0, doubt: val })
    }
  }

  if (output.inlineDefiniciones.length > 0) {
    for (const c of output.inlineConcepts) {
      const defMatch = output.inlineDefiniciones.find(d => d.concepto === c.concepto)
      if (defMatch) c.definicion = defMatch.definicion
    }
  }

  const seen = new Map()
  for (const c of output.inlineConcepts) {
    const key = `${c.note}|${c.concepto}`
    const existing = seen.get(key)
    const score = c.definicion ? 2 : (c.analogia ? 1 : 0)
    if (!existing || score >= (existing.definicion ? 2 : (existing.analogia ? 1 : 0))) {
      seen.set(key, c)
    }
  }
  output.inlineConcepts.length = 0
  output.inlineConcepts.push(...seen.values())
}

// --- Active recall history ---

function findActiveRecallDirs(basePath) {
  const dirs = []
  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(basePath, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '_active_recall') dirs.push(fullPath)
        else dirs.push(...findActiveRecallDirs(fullPath))
      }
    }
  } catch {} // skip inaccessible dirs
  return dirs
}

export function getStudyHistory() {
  const results = []
  const recallDirs = findActiveRecallDirs(STUDY_PATH)
  for (const dir of recallDirs) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const content = readFile(path.join(dir, file))
      if (!content) continue
      const fm = parseFrontmatter(content)
      results.push({
        file,
        path: path.relative(VAULT_ROOT, path.join(dir, file)),
        fecha: fm.fecha || file.slice(0, 8).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
        tipo: fm.tipo || 'question',
        score: fm.auto_score || null,
        concepto: fm.linked_concept || null,
        pregunta: fm.pregunta || '',
        hasAnswer: content.includes('## Mi respuesta'),
      })
    }
  }
  return results
}

// --- File writers (answer, self-score, feedback) ---

export function saveAnswer({ question, answer, sourceNote, answerType }) {
  ensureDir(ACTIVE_RECALL_DIR)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const slug = generateSlug(question)
  const fileName = `${dateStr}_${slug}.md`
  const filePath = path.join(ACTIVE_RECALL_DIR, fileName)

  const content = [
    buildFrontmatter({
      'entity_type::': 'active_recall',
      'fecha::': new Date().toISOString().slice(0, 10),
      'tipo::': answerType || 'question',
      'fuente::': sourceNote || '',
      'pregunta::': question.replace(/\n/g, ' '),
    }),
    '',
    `# Active Recall: ${question}`, '',
    `**Fuente:** ${sourceNote || 'Desconocida'}`,
    `**Tipo:** ${answerType === 'doubt' ? 'Duda' : 'Pregunta'}`, '',
    '## Mi respuesta (analogía)', '', answer, '',
    '---', `*Respondido el ${new Date().toLocaleDateString()}*`
  ].join('\n')

  fs.writeFileSync(filePath, content, 'utf8')
  return { success: true, path: filePath }
}

export function saveSelfScore({ questionOrDoubt, type, score, linkedConcept }) {
  ensureDir(ACTIVE_RECALL_DIR)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const slug = generateSlug(questionOrDoubt)
  const fileName = `${dateStr}_${slug}.md`
  const filePath = path.join(ACTIVE_RECALL_DIR, fileName)

  const fmFields = {
    'entity_type::': 'active_recall',
    'fecha::': new Date().toISOString().slice(0, 10),
    'tipo::': type || 'question',
    'auto_score::': score,
  }
  if (linkedConcept) fmFields['linked_concept::'] = linkedConcept

  const content = [
    buildFrontmatter(fmFields),
    '',
    `# Shadow Study: ${questionOrDoubt}`, '',
    `**Tipo:** ${type === 'doubt' ? 'Duda' : 'Pregunta'}`,
    `**Autoevaluación:** ${score === 'correct' ? '✅ Lo sabía' : score === 'partial' ? '🟡 Casi' : '❌ No lo sabía'}`,
    linkedConcept ? `**Concepto relacionado:** ${linkedConcept}` : '', '',
    `*Evaluado el ${new Date().toLocaleDateString()}*`
  ].filter(l => l).join('\n')

  fs.writeFileSync(filePath, content, 'utf8')
  return { success: true, path: filePath }
}

export function saveFeedbackRequest(session) {
  ensureDir(FEEDBACK_DIR)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const fileName = `${dateStr}_${session.sessionId.slice(0, 8)}.json`
  const filePath = path.join(FEEDBACK_DIR, fileName)
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf8')
  return { success: true, path: filePath }
}
