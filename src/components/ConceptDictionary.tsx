import { useState, useEffect } from 'react'
import type { StudyData, SelfScore, ActiveRecallDueItem } from '../types'
import { submitActiveRecall, fetchActiveRecallAll } from '../api'

interface Props {
  data: StudyData
  search: string
}

interface SessionReview {
  score: SelfScore
  prevReview: ActiveRecallDueItem | null  // store state before this session
}

export default function ConceptDictionary({ data, search }: Props) {
  const [mode, setMode] = useState<'diccionario' | 'repaso'>('diccionario')
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [revealLocked, setRevealLocked] = useState<Set<number>>(new Set()) // revealed + scored, no re-reveal
  const [sessionReviews, setSessionReviews] = useState<Map<number, SessionReview>>(new Map())
  const [storeConcepts, setStoreConcepts] = useState<Map<string, ActiveRecallDueItem>>(new Map())
  const [submitting, setSubmitting] = useState<Set<number>>(new Set())

  // Load existing concept reviews from SM-2 store on mount
  useEffect(() => {
    fetchActiveRecallAll().then(resp => {
      const map = new Map<string, ActiveRecallDueItem>()
      for (const q of resp.questions) {
        // Store items whose type === 'concept' OR whose question matches a concept name
        if (q.type === 'concept' || data.concepts.some(c => c.concepto === q.question || c.concepto === q.concept)) {
          map.set(q.question || q.concept || '', q)
        }
      }
      setStoreConcepts(map)
    }).catch(() => { /* store may be empty */ })
  }, [data.concepts])

  // --- Derived state ---
  // Filter out already-reviewed-in-session concepts when repaso mode
  const filtered = data.concepts.filter((c, i) => {
    if (mode === 'repaso' && sessionReviews.has(i) && sessionReviews.get(i)!.score === 'correct') return false
    if (!search) return true
    const term = search.toLowerCase()
    return (
      c.concepto.toLowerCase().includes(term) ||
      (c.definicion || c.analogia).toLowerCase().includes(term)
    )
  })

  const getDefinition = (c: typeof data.concepts[0]) => c.definicion || c.analogia

  const toggleReveal = (idx: number) => {
    if (revealLocked.has(idx)) return // already scored
    setRevealed(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const submitScore = async (conceptIdx: number, score: SelfScore) => {
    const c = data.concepts[conceptIdx]
    if (!c) return

    setSubmitting(prev => new Set(prev).add(conceptIdx))

    try {
      await submitActiveRecall({
        question: c.concepto,
        type: 'concept' as any,
        score,
        concept: c.concepto,
        definition: getDefinition(c),
        sourceNote: c.note,
        sourceBloque: c.bloque,
      })

      // Lock reveal + store session result
      setRevealLocked(prev => new Set(prev).add(conceptIdx))
      setSessionReviews(prev => {
        const next = new Map(prev)
        next.set(conceptIdx, {
          score,
          prevReview: storeConcepts.get(c.concepto) || storeConcepts.get(`${c.concepto}`) || null
        })
        return next
      })
    } catch (e) {
      console.error('Failed to submit concept review:', e)
    } finally {
      setSubmitting(prev => {
        const next = new Set(prev)
        next.delete(conceptIdx)
        return next
      })
    }
  }

  // --- Stats ---
  const totalSession = sessionReviews.size
  const correctCount = [...sessionReviews.values()].filter(r => r.score === 'correct').length
  const partialCount = [...sessionReviews.values()].filter(r => r.score === 'partial').length
  const incorrectCount = [...sessionReviews.values()].filter(r => r.score === 'incorrect').length
  const pendingCount = filtered.length

  const getPrevScoreEmoji = (conceptIdx: number): string | null => {
    const sessionReview = sessionReviews.get(conceptIdx)
    const prevFromStore = sessionReview?.prevReview
    if (!prevFromStore?.lastScore) return null
    return prevFromStore.lastScore === 'correct' ? '✅' : prevFromStore.lastScore === 'partial' ? '🟡' : '❌'
  }

  const getPrevScoreDays = (conceptIdx: number): string | null => {
    const sessionReview = sessionReviews.get(conceptIdx)
    const prevFromStore = sessionReview?.prevReview
    if (!prevFromStore?.lastReview?.date) return null
    const days = Math.round((Date.now() - new Date(prevFromStore.lastReview.date).getTime()) / 86400000)
    if (days === 0) return 'hoy'
    if (days === 1) return 'ayer'
    return `hace ${days} días`
  }

  // --- Completion screen ---
  if (mode === 'repaso' && pendingCount === 0 && totalSession > 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🎉</p>
        <p className="font-medium text-text-primary">¡Repaso completado!</p>
        <div className="flex justify-center gap-6 mt-6 mb-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{correctCount}</p>
            <p className="text-xs text-text-secondary">✅ Lo sabía</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-warning">{partialCount}</p>
            <p className="text-xs text-text-secondary">🟡 Casi</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-danger">{incorrectCount}</p>
            <p className="text-xs text-text-secondary">❌ No</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary mb-6">
          {totalSession} conceptos revisados · {Math.round(correctCount / Math.max(totalSession, 1) * 100)}% precisión
        </p>
        <button
          className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80"
          onClick={() => { setMode('diccionario'); setRevealed(new Set()); setRevealLocked(new Set()); setSessionReviews(new Map()) }}
        >
          Volver al diccionario
        </button>
      </div>
    )
  }

  if (mode === 'repaso' && pendingCount === 0 && totalSession === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">📖</p>
        <p className="font-medium text-text-primary">No hay conceptos para repasar</p>
        <button
          className="mt-4 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80"
          onClick={() => setMode('diccionario')}
        >
          Volver al diccionario
        </button>
      </div>
    )
  }

  if (filtered.length === 0) {
    return <p className="text-text-secondary text-sm text-center py-8">Sin resultados{search ? ` para "${search}"` : ''}</p>
  }

  return (
    <div>
      {/* Header + Mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              mode === 'diccionario' ? 'bg-accent text-white shadow-sm' : 'bg-card text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('diccionario')}
          >
            📖 Diccionario
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              mode === 'repaso' ? 'bg-accent text-white shadow-sm' : 'bg-card text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setMode('repaso')}
          >
            🔁 Repaso {mode === 'repaso' && pendingCount > 0 && `(${pendingCount})`}
          </button>
        </div>
        {mode === 'repaso' && (
          <span className="text-xs text-text-secondary">
            {correctCount}✅ · {partialCount}🟡 · {incorrectCount}❌ · {pendingCount} pendientes
          </span>
        )}
      </div>

      {/* Concept entries */}
      <div className="space-y-2">
        {filtered.map((c, i) => {
          const originalIdx = data.concepts.indexOf(c)
          const definition = getDefinition(c)
          const isRevealed = revealed.has(originalIdx)
          const isLocked = revealLocked.has(originalIdx)
          const sessionReview = sessionReviews.get(originalIdx)
          const isCorrectLocked = isLocked && sessionReview?.score === 'correct'
          const prevScoreEmoji = getPrevScoreEmoji(originalIdx)
          const prevScoreDays = getPrevScoreDays(originalIdx)
          const isSubmitting = submitting.has(originalIdx)

          // Repaso mode: conceptos correctos se atenúan y no son clickeables
          if (mode === 'repaso' && isCorrectLocked) {
            return (
              <div key={originalIdx} className="bg-card rounded-xl p-3 opacity-50">
                <div className="flex items-start gap-3">
                  <span className="text-accent font-mono text-xs mt-0.5 shrink-0">B{c.bloque}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text-primary text-sm font-medium">{c.concepto}</p>
                    <p className="text-text-tertiary text-[0.6rem] mt-0.5">✅ Completado · {c.note}</p>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div
              key={originalIdx}
              className={`bg-card rounded-xl p-4 transition-colors ${
                mode === 'repaso' && !isLocked ? 'cursor-pointer hover:bg-surface/50' : ''
              } ${isLocked ? 'border border-success/30' : ''}`}
              onClick={() => mode === 'repaso' && !isLocked && !isSubmitting && toggleReveal(originalIdx)}
              onKeyDown={e => { if (mode === 'repaso' && !isLocked && e.key === 'Enter') toggleReveal(originalIdx) }}
              role={mode === 'repaso' && !isLocked ? 'button' : undefined}
              tabIndex={mode === 'repaso' && !isLocked ? 0 : undefined}
            >
              <div className="flex items-start gap-3">
                <span className="text-accent font-mono text-xs mt-0.5 shrink-0">B{c.bloque}</span>
                <div className="min-w-0 flex-1">
                  {/* Concept name + previous review indicator */}
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-text-primary text-sm font-semibold">{c.concepto}</p>
                    {prevScoreEmoji && mode === 'repaso' && (
                      <span className="text-[0.6rem] text-text-tertiary" title="Último repaso">
                        {prevScoreEmoji} {prevScoreDays}
                      </span>
                    )}
                  </div>

                  {/* Definition (dictionary: always; repaso: hidden until reveal) */}
                  {mode === 'diccionario' ? (
                    <p className="text-text-secondary text-xs leading-relaxed">{definition}</p>
                  ) : isRevealed || isLocked ? (
                    <p className="text-text-secondary text-xs leading-relaxed animate-fade-in">{definition}</p>
                  ) : (
                    <p className="text-text-tertiary text-xs italic">Click para revelar definición</p>
                  )}

                  {/* Source line */}
                  <p className="text-text-tertiary text-[0.6rem] mt-1.5">{c.note}</p>
                </div>

                {/* Repaso: scoring buttons (visible after reveal, replaced by score badge after submission) */}
                {mode === 'repaso' && isRevealed && !isLocked && (
                  <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                    <button
                      className={`px-2.5 py-1 text-[0.65rem] font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors ${isSubmitting ? 'opacity-50' : ''}`}
                      onClick={e => { e.stopPropagation(); submitScore(originalIdx, 'correct') }}
                      disabled={isSubmitting}
                      title="Lo sabía"
                    >
                      ✅ Lo sabía
                    </button>
                    <button
                      className={`px-2.5 py-1 text-[0.65rem] font-medium rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors ${isSubmitting ? 'opacity-50' : ''}`}
                      onClick={e => { e.stopPropagation(); submitScore(originalIdx, 'partial') }}
                      disabled={isSubmitting}
                      title="Casi"
                    >
                      🟡 Casi
                    </button>
                    <button
                      className={`px-2.5 py-1 text-[0.65rem] font-medium rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors ${isSubmitting ? 'opacity-50' : ''}`}
                      onClick={e => { e.stopPropagation(); submitScore(originalIdx, 'incorrect') }}
                      disabled={isSubmitting}
                      title="No lo sabía"
                    >
                      ❌ No
                    </button>
                  </div>
                )}

                {/* After scoring: show badge */}
                {mode === 'repaso' && isLocked && sessionReview && (
                  <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                    <span className={`px-2.5 py-1 text-[0.65rem] font-medium rounded-lg text-center ${
                      sessionReview.score === 'correct' ? 'bg-success/10 text-success'
                      : sessionReview.score === 'partial' ? 'bg-warning/10 text-warning'
                      : 'bg-danger/10 text-danger'
                    }`}>
                      {sessionReview.score === 'correct' ? '✅' : sessionReview.score === 'partial' ? '🟡' : '❌'}
                    </span>
                  </div>
                )}

                {/* Submitting indicator */}
                {isSubmitting && (
                  <div className="flex flex-col gap-1.5 shrink-0 ml-2 justify-center">
                    <span className="text-[0.65rem] text-text-tertiary animate-pulse">⏳</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
