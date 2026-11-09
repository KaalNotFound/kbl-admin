import { useState } from 'react'
import type { SocraticResult, StudyConcept } from '../types'
import { submitSocraticAudit, fetchStudyData } from '../api'
import { useEffect } from 'react'

export default function SocraticAudit() {
  const [concepts, setConcepts] = useState<StudyConcept[]>([])
  const [selectedConcept, setSelectedConcept] = useState('')
  const [explanation, setExplanation] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [result, setResult] = useState<SocraticResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [conceptsLoading, setConceptsLoading] = useState(true)

  useEffect(() => {
    fetchStudyData()
      .then(d => setConcepts(d.concepts || []))
      .catch(() => {})
      .finally(() => setConceptsLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!selectedConcept || !explanation.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const r = await submitSocraticAudit({
        concept: selectedConcept,
        operator_explanation: explanation.trim(),
        source_note: sourceNote || undefined,
      })
      if (r.success) setResult(r.data)
    } catch (e: any) {
      setResult({
        score: 0,
        feedback: `Error: ${e.message}`,
        strengths: [],
        gaps: ['No se pudo conectar con el Auditor'],
        challenge_question: null,
        mastery: { id: '', concept: selectedConcept, module: null, currentScore: 0, level: 0, levelMeta: { name: '', color: '', icon: '', minScore: 0 }, totalScores: 0, correctCount: 0, lastValidated: null },
      })
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = result
    ? result.score >= 85 ? 'text-green-400' : result.score >= 60 ? 'text-yellow-400' : 'text-red-400'
    : 'text-text-secondary'

  // Unique concept names
  const conceptNames = [...new Set(concepts.map(c => c.concepto))].sort()

  return (
    <div>
      {/* Header */}
      <div className="bg-card rounded-xl p-4 border-l-4 border-accent mb-6">
        <p className="text-sm text-text-secondary">
          {'\u{1F9E0}'} <strong className="text-text-primary">Auditor Socrático</strong> — Explicá un concepto con tus palabras.
          El sistema evalúa tu comprensión usando la técnica Feynman y te da feedback.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4 mb-6">
        {/* Concept selector */}
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Concepto a evaluar</label>
          {conceptsLoading ? (
            <div className="h-10 bg-card rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedConcept}
              onChange={e => {
                setSelectedConcept(e.target.value)
                // Auto-fill source note
                const match = concepts.find(c => c.concepto === e.target.value)
                if (match) setSourceNote(match.note)
              }}
              className="w-full px-3 py-2.5 text-sm bg-card border border-border-light rounded-lg focus:outline-none focus:border-accent"
            >
              <option value="">Seleccionar concepto...</option>
              {conceptNames.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Explanation textarea */}
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">
            Tu explicación (Feynman) — como si le explicaras a alguien que no sabe del tema
          </label>
          <textarea
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            placeholder="Ejemplo: HTTP es como un mensajero que lleva cartas de un lado a otro. Cuando hacés un request, le decís al mensajero a dónde ir y qué querés. El servidor le responde con lo que pediste..."
            className="w-full px-3 py-2.5 text-sm bg-card border border-border-light rounded-lg text-text-primary font-mono leading-relaxed focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 resize-y min-h-[120px]"
            rows={6}
            spellCheck={false}
          />
          <p className="text-[0.6rem] text-text-tertiary mt-1">
            {explanation.length} caracteres
            {explanation.length < 50 ? ' — Muy corto para evaluar' : explanation.length < 150 ? ' — Bien' : ' — Completo'}
          </p>
        </div>

        {/* Source note (optional) */}
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Nota fuente (opcional)</label>
          <input
            type="text"
            value={sourceNote}
            onChange={e => setSourceNote(e.target.value)}
            placeholder="Nombre de la nota de estudio..."
            className="w-full px-3 py-2 text-sm bg-card border border-border-light rounded-lg focus:outline-none focus:border-accent"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedConcept || !explanation.trim() || loading}
          className="w-full py-3 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Evaluando...' : '\u{1F9E0} Evaluar mi comprensión'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-card rounded-xl p-5 border-l-4 border-accent">
          {/* Score header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="text-center">
              <p className={`text-4xl font-bold ${scoreColor}`}>{result.score}</p>
              <p className="text-[0.6rem] text-text-secondary">/ 100</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {result.score >= 85 ? '\u{1F525} Maestría validada' :
                 result.score >= 60 ? '\u{1F7E1} Comprensión funcional' :
                 '\u{1F534} Necesita más práctica'}
              </p>
              {result.mastery && (
                <p className="text-xs text-text-secondary mt-0.5">
                  Nivel {result.mastery.level} — {result.mastery.levelMeta.name}
                </p>
              )}
            </div>
          </div>

          {/* Feedback */}
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-1">Feedback</p>
            <p className="text-sm text-text-primary leading-relaxed">{result.feedback}</p>
          </div>

          {/* Strengths & Gaps */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {result.strengths.length > 0 && (
              <div>
                <p className="text-xs text-success mb-1.5">{'\u2705'} Fortalezas</p>
                <ul className="space-y-1">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-text-primary pl-3 border-l-2 border-success/30">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.gaps.length > 0 && (
              <div>
                <p className="text-xs text-warning mb-1.5">{'\u26A0\uFE0F'} Lagunas</p>
                <ul className="space-y-1">
                  {result.gaps.map((g, i) => (
                    <li key={i} className="text-xs text-text-primary pl-3 border-l-2 border-warning/30">{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Challenge question */}
          {result.challenge_question && (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
              <p className="text-xs text-accent font-medium mb-1">{'\u{1F3AF}'} Pregunta desafiante</p>
              <p className="text-sm text-text-primary">{result.challenge_question}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
