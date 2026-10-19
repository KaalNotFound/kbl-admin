import { useState, useMemo, useCallback, useEffect } from 'react'
import type { StudyData, SelfScore, ActiveRecallStoreStats } from '../types'
import { submitActiveRecall, fetchActiveRecallStats, fetchActiveRecallAll, seedActiveRecallQuestions, requestStudyFeedback } from '../api'

// ─── Types ───

interface Props {
  data: StudyData
  filter: 'all' | 'questions' | 'doubts'
}

interface ShadowCard {
  id: string
  type: 'question' | 'doubt'
  text: string
  note: string
  bloque: number
  linkedConcept: string | null
  linkedDefinition: string | null
}

// ─── Mini-components ───

function CardTypeIcon({ type }: { type: 'question' | 'doubt' }) {
  return (
    <span className={`text-sm mt-0.5 shrink-0 ${type === 'doubt' ? 'text-orange-400' : 'text-yellow-400'}`}>
      {type === 'doubt' ? '💡' : '❓'}
    </span>
  )
}

function SelfScoreButtons({ onScore, compact }: { onScore: (s: SelfScore) => void; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex gap-1.5 mt-3">
        {(['correct', 'partial', 'incorrect'] as const).map((s) => (
          <button key={s} className={`px-2.5 py-1 text-[0.65rem] font-medium rounded-lg transition-colors ${
            s === 'correct' ? 'bg-success/10 text-success hover:bg-success/20'
            : s === 'partial' ? 'bg-warning/10 text-warning hover:bg-warning/20'
            : 'bg-danger/10 text-danger hover:bg-danger/20'
          }`} onClick={() => onScore(s)}>
            {s === 'correct' ? '✅ Lo sabía' : s === 'partial' ? '🟡 Casi' : '❌ No'}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="flex gap-2 mt-5">
      {(['correct', 'partial', 'incorrect'] as const).map((s) => (
        <button key={s} className={`flex-1 px-3 py-2.5 text-xs font-medium rounded-lg transition-all ${
          s === 'correct' ? 'bg-success/10 text-success hover:bg-success/20'
          : s === 'partial' ? 'bg-warning/10 text-warning hover:bg-warning/20'
          : 'bg-danger/10 text-danger hover:bg-danger/20'
        }`} onClick={() => onScore(s)}>
          {s === 'correct' ? '✅ Lo sabía' : s === 'partial' ? '🟡 Casi' : '❌ No'}
        </button>
      ))}
    </div>
  )
}

function DefinitionBlock({ concept, definition }: { concept: string | null; definition: string | null }) {
  return (
    <>
      {concept && <p className="text-accent text-xs font-medium mb-1">🔗 {concept}</p>}
      {definition ? (
        <p className="text-text-secondary text-sm leading-relaxed">{definition}</p>
      ) : (
        <p className="text-text-tertiary text-xs italic">No hay definición asociada. Evaluá según tu memoria.</p>
      )}
    </>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1.5 bg-card rounded-full mb-6 overflow-hidden">
      <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  )
}

// ─── Helper ───

function computeCards(data: StudyData, filter: Props['filter']): ShadowCard[] {
  const cards: ShadowCard[] = []

  const pushItems = <T extends { note: string; bloque: number }>(
    items: T[],
    type: 'question' | 'doubt',
    textKey: keyof T,
    linkedConcept: (item: T) => string | null,
    linkedDefinition: (item: T) => string | null,
  ) => {
    for (const item of items) {
      const text = String(item[textKey] ?? '')
      if (!text.trim()) continue
      cards.push({
        id: `${type}-${cards.length}-${item.note}-${item.bloque}`,
        type,
        text,
        note: item.note,
        bloque: item.bloque,
        linkedConcept: linkedConcept(item),
        linkedDefinition: linkedDefinition(item),
      })
    }
  }

  if (filter === 'all' || filter === 'questions') {
    pushItems(
      data.questions, 'question', 'question' as keyof typeof data.questions[0],
      (q: typeof data.questions[0]) => q.linkedConcept ?? null,
      (q: typeof data.questions[0]) => q.linkedDefinition ?? null,
    )
  }
  if (filter === 'all' || filter === 'doubts') {
    pushItems(
      data.doubts, 'doubt', 'doubt' as keyof typeof data.doubts[0],
      (d: typeof data.doubts[0]) => d.linkedConcept ?? null,
      (d: typeof data.doubts[0]) => d.linkedDefinition ?? null,
    )
  }

  return cards
}

// ─── Component ───

export default function ShadowStudy({ data, filter }: Props) {
  const [mode, setMode] = useState<'list' | 'repaso' | 'flow'>('list')
  const [sessionResults, setSessionResults] = useState<Map<string, SelfScore>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())
  const [answerText, setAnswerText] = useState('')
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [showEndScreen, setShowEndScreen] = useState(false)
  const [storeStats, setStoreStats] = useState<ActiveRecallStoreStats | null>(null)
  const [cardAnswers, setCardAnswers] = useState<Map<string, string>>(new Map()) // list mode: cardId → answer text

  // ─── Flow config toggles (replaces standalone shadow mode) ───
  const [activeRecall, setActiveRecall] = useState(true)   // ON → write/skip before reveal (strict), OFF → flashcard tap-to-reveal
  const [autoAdvance, setAutoAdvance] = useState(true)       // OFF → show "Siguiente" after score, ON → advance immediately

  // ─── Flow mode state ───
  type FlowPhase = 'question' | 'answering' | 'scoring' | 'reveal'
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('question')
  const [flowAnswer, setFlowAnswer] = useState('')
  const [flowAnswers, setFlowAnswers] = useState<Map<string, { answer?: string; skipped: boolean; score?: SelfScore }>>(new Map())
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [flowAnswerStatus, setFlowAnswerStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  const cards = useMemo(() => computeCards(data, filter), [data, filter])

  // Seed store with cards from this view + hydrate sessionResults
  useEffect(() => {
    const seedAndHydrate = async () => {
      // 1. Seed missing questions from current cards
      if (cards.length > 0) {
        await seedActiveRecallQuestions(cards.map(c => ({
          question: c.text,
          type: c.type,
          concept: c.linkedConcept,
          definition: c.linkedDefinition,
          sourceNote: c.note,
          sourceBloque: c.bloque,
        }))).catch(() => {})
      }

      // 2. Fetch fresh stats after seeding
      const stats = await fetchActiveRecallStats().catch(() => null)
      if (stats) setStoreStats(stats)

      // 3. Fetch all store questions to hydrate sessionResults
      const all = await fetchActiveRecallAll().catch(() => null)
      if (all?.questions?.length) {
        const storeByQuestion = new Map<string, { lastScore: string | null; due: boolean }>()
        for (const q of all.questions) {
          storeByQuestion.set(q.question.trim().toLowerCase(), { lastScore: q.lastScore, due: q.due })
        }
        // Pre-populate sessionResults for cards that were reviewed and NOT due
        const prePopulated = new Map<string, SelfScore>()
        for (const card of cards) {
          const storeQ = storeByQuestion.get(card.text.trim().toLowerCase())
          if (storeQ && storeQ.lastScore && !storeQ.due &&
              (storeQ.lastScore === 'correct' || storeQ.lastScore === 'partial' || storeQ.lastScore === 'incorrect')) {
            prePopulated.set(card.id, storeQ.lastScore)
          }
        }
        if (prePopulated.size > 0) {
          setSessionResults(prev => {
            const n = new Map(prev)
            for (const [id, score] of prePopulated) n.set(id, score)
            return n
          })
        }
      }
    }
    seedAndHydrate()
  }, [data, filter, cards])
  const pendingCards = cards.filter(c => !sessionResults.has(c.id))
  const currentCard = mode === 'flow' && currentIndex < cards.length ? cards[currentIndex] : null

  const scoreCounts = { correct: 0, partial: 0, incorrect: 0 }
  for (const s of sessionResults.values()) scoreCounts[s]++

  // ─── Actions ───

  const advanceToNext = useCallback(() => {
    if (currentIndex + 1 >= cards.length) {
      setShowEndScreen(true)
    } else {
      setCurrentIndex(p => p + 1)
      setRevealedIds(new Set())
    }
  }, [currentIndex, cards.length])

  const handleScore = useCallback(async (card: ShadowCard, score: SelfScore) => {
    setSessionResults(prev => { const n = new Map(prev); n.set(card.id, score); return n })

    // Save to persistent store (includes legacy fallback)
    const answer = cardAnswers.get(card.id) || flowAnswers.get(card.id)?.answer || undefined
    submitActiveRecall({
      question: card.text,
      type: card.type,
      score,
      answer,
      concept: card.linkedConcept,
      definition: card.linkedDefinition,
      sourceNote: card.note,
      sourceBloque: card.bloque,
    }).catch(() => {})

    setFlowAnswers(prev => {
      const n = new Map(prev)
      const existing = n.get(card.id) ?? { skipped: false }
      n.set(card.id, { ...existing, score })
      return n
    })

    if (autoAdvance) {
      setFlowPhase('question')
      setFlowAnswer('')
      advanceToNext()
    }
    // When autoAdvance=false: score is saved, render shows "Siguiente" button
    // User clicks it to call handleFlowNext()
  }, [autoAdvance, advanceToNext, cardAnswers, flowAnswers])

  const handleFlowNext = useCallback(() => {
    setFlowPhase('question')
    setFlowAnswer('')
    advanceToNext()
  }, [advanceToNext])

  const toggleReveal = (id: string) => {
    setRevealedIds(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const handleSaveAnswer = (card: ShadowCard) => {
    if (!answerText.trim()) return
    setCardAnswers(prev => { const n = new Map(prev); n.set(card.id, answerText); return n })
    setRespondingId(null)
    setAnswerText('')
    setRevealedIds(p => new Set(p).add(card.id))
  }

  const resetSession = () => {
    setSessionResults(new Map()); setCurrentIndex(0)
    setRevealedIds(new Set()); setShowEndScreen(false)
    setFlowPhase('question'); setFlowAnswer('')
    setFlowAnswers(new Map()); setFeedbackStatus('idle'); setFlowAnswerStatus('idle')
    setCardAnswers(new Map())
  }

  const switchMode = (m: typeof mode) => {
    setMode(m)
    if (m === 'flow') setShowEndScreen(false)
    // Reset per-card state on mode switch
    setCurrentIndex(0)
    setRevealedIds(new Set())
    setRespondingId(null)
    setAnswerText('')
    setFlowPhase('question')
    setFlowAnswer('')
    setFlowAnswerStatus('idle')
  }

  // ─── End screen ───
  if (showEndScreen) {
    const incorrectCards = cards.filter(c => sessionResults.get(c.id) === 'incorrect')
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">🎉</p>
        <p className="text-xl font-semibold text-text-primary mb-2">Sesión completada</p>
        <div className="flex justify-center gap-8 my-6">
          {(['correct', 'partial', 'incorrect'] as const).map((k, i) => (
            <div key={k} className="text-center">
              <p className={`text-2xl font-bold ${i === 0 ? 'text-success' : i === 1 ? 'text-warning' : 'text-danger'}`}>{scoreCounts[k]}</p>
              <p className="text-xs text-text-secondary">{k === 'correct' ? 'Correctas' : k === 'partial' ? 'Parciales' : 'Incorrectas'}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <button className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80" onClick={resetSession}>🔁 Repasar de nuevo</button>
          <button className="px-4 py-2 text-sm font-medium bg-card text-text-secondary border border-border-light rounded-lg hover:text-text-primary" onClick={() => { setMode('list'); resetSession() }}>📋 Volver a lista</button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              feedbackStatus === 'saved'
                ? 'bg-success/10 text-success border border-success/30'
                : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
            }`}
            onClick={async () => {
              if (feedbackStatus === 'saved') return
              setFeedbackStatus('saving')
              try {
                const result = await requestStudyFeedback({
                  sessionId: new Date().toISOString(),
                  total: cards.length,
                  results: cards.map(c => ({
                    id: c.id,
                    type: c.type,
                    text: c.text,
                    concept: c.linkedConcept,
                    answer: flowAnswers.get(c.id)?.answer,
                    skipped: flowAnswers.get(c.id)?.skipped ?? false,
                    score: sessionResults.get(c.id) ?? null,
                  })),
                })
                if (result.success) setFeedbackStatus('saved')
                else setFeedbackStatus('error')
              } catch { setFeedbackStatus('error') }
            }}
            disabled={feedbackStatus === 'saving'}
          >
            {feedbackStatus === 'idle' ? '🤖 Pedir feedback Kali' : feedbackStatus === 'saving' ? 'Guardando...' : feedbackStatus === 'saved' ? '✅ Feedback solicitado' : '❌ Error'}
          </button>
        </div>
        {incorrectCards.length > 0 && (
          <div className="mt-8 text-left max-w-lg mx-auto space-y-2">
            <p className="text-sm font-medium text-text-primary mb-2">Para repasar:</p>
            {incorrectCards.map(c => (
              <div key={c.id} className="bg-card rounded-lg p-3">
                <p className="text-sm text-text-primary">{c.text}</p>
                {c.linkedConcept && <p className="text-xs text-accent mt-1">🔗 {c.linkedConcept}</p>}
                {c.linkedDefinition && <p className="text-xs text-text-secondary mt-0.5">{c.linkedDefinition}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Empty state ───
  if (cards.length === 0) {
    const msg = filter === 'questions' ? 'preguntas' : filter === 'doubts' ? 'dudas' : 'preguntas ni dudas'
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-3">{filter === 'doubts' ? '💡' : '❓'}</p>
        <p className="font-medium text-text-primary">No hay {msg}</p>
        <p className="text-sm text-text-secondary mt-2">Aparecen automáticamente desde las notas con <code className="text-accent">pregunta::</code> o <code className="text-accent">duda::</code></p>
      </div>
    )
  }

  // ─── Mode: List ───
  function renderList() {
    return (
      <div className="space-y-3">
        {cards.map(card => {
          const isReplying = respondingId === card.id
          const isRevealed = revealedIds.has(card.id)
          const score = sessionResults.get(card.id)

          return (
            <div key={card.id} className={`bg-card rounded-xl p-4 ${score ? 'border-l-4 border-success/50' : ''}`}>
              <div className="flex items-start gap-3">
                <CardTypeIcon type={card.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm">{card.text}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <p className="text-text-tertiary text-[0.6rem]">{card.note} · B{card.bloque}</p>
                    {card.linkedConcept && <p className="text-accent text-[0.6rem]">🔗 {card.linkedConcept}</p>}
                    {score && <p className={`text-[0.6rem] font-medium ${score === 'correct' ? 'text-success' : score === 'partial' ? 'text-warning' : 'text-danger'}`}>
                      {score === 'correct' ? '✅ Lo sabía' : score === 'partial' ? '🟡 Casi' : '❌ No lo sabía'}
                    </p>}
                  </div>

                  {isRevealed && (
                    <div className="border-l-2 mt-2 pl-3" style={{ borderColor: card.linkedDefinition ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)' }}>
                      <DefinitionBlock concept={card.linkedConcept} definition={card.linkedDefinition} />
                    </div>
                  )}

                  {isReplying && (
                    <div className="mt-3">
                      <textarea className="w-full px-3 py-2 text-sm bg-surface border border-border-light rounded-lg focus:outline-none focus:border-accent resize-none" rows={3} placeholder={card.type === 'doubt' ? 'Escribí cómo resolviste esta duda...' : 'Escribí tu respuesta para Active Recall...'} value={answerText} onChange={e => setAnswerText(e.target.value)} autoFocus />
                      <div className="flex items-center gap-2 mt-2">
                        <button className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-50" onClick={() => handleSaveAnswer(card)} disabled={!answerText.trim()}>
                          Guardar respuesta
                        </button>
                        <button className="px-3 py-1.5 text-xs font-medium bg-card text-text-secondary border border-border-light rounded-lg hover:text-text-primary" onClick={() => { setRespondingId(null); setAnswerText('') }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                  {!score && !isReplying && (
                    <button className="px-2.5 py-1 text-[0.65rem] font-medium bg-accent/10 text-accent hover:bg-accent/20 rounded-lg transition-colors" onClick={() => { setRespondingId(card.id); setAnswerText('') }}>
                      Responder
                    </button>
                  )}
                  {!score && !isRevealed && card.linkedDefinition && (
                    <button className="px-2.5 py-1 text-[0.65rem] font-medium bg-surface text-text-secondary hover:text-text-primary rounded-lg transition-colors" onClick={() => toggleReveal(card.id)}>
                      🔍 Revelar
                    </button>
                  )}
                  {isRevealed && !score && (
                    <SelfScoreButtons onScore={s => handleScore(card, s)} compact />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── Mode: Repaso (flashcard list) ───
  function renderRepaso() {
    if (pendingCards.length === 0) {
      return (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium text-text-primary">¡Repaso completado!</p>
          <p className="text-sm text-text-secondary mt-2">{scoreCounts.correct} correctas · {scoreCounts.partial} parciales · {scoreCounts.incorrect} incorrectas</p>
          <button className="mt-4 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80" onClick={resetSession}>Repasar de nuevo</button>
        </div>
      )
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-text-secondary">{scoreCounts.correct} correctas · {scoreCounts.partial} parciales · {scoreCounts.incorrect} incorrectas · {pendingCards.length} pendientes</span>
        </div>
        <div className="space-y-2">
          {cards.filter(c => !sessionResults.has(c.id)).map(card => {
            const isRevealed = revealedIds.has(card.id)
            return (
              <div key={card.id}
                className="bg-card rounded-xl p-4 cursor-pointer hover:bg-surface/50 transition-colors"
                onClick={() => toggleReveal(card.id)}
                onKeyDown={e => { if (e.key === 'Enter') toggleReveal(card.id) }}
                role="button" tabIndex={0}
              >
                <div className="flex items-start gap-3">
                  <CardTypeIcon type={card.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium">{card.text}</p>
                    {card.linkedConcept && <p className="text-text-tertiary text-[0.6rem] mt-1">🔗 {card.linkedConcept} · {card.note}</p>}
                    {isRevealed ? (
                      <>
                        <div className="border-t border-border-light pt-3 mt-3">
                          <DefinitionBlock concept={card.linkedConcept} definition={card.linkedDefinition} />
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          <SelfScoreButtons onScore={s => handleScore(card, s)} compact />
                        </div>
                      </>
                    ) : (
                      <p className="text-text-tertiary text-xs italic mt-1">Click para revelar definición</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Mode: Flow (unificado: flashcard + active recall) ───
  function renderFlow() {
    if (!currentCard) return null
    const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0
    const flowCard = currentCard
    const flowEntry = flowAnswers.get(flowCard.id)
    const isFlashcard = !activeRecall

    // Flashcard mode: tap to reveal
    const handleTapReveal = () => {
      if (flowPhase === 'question' && isFlashcard) {
        setFlowPhase('reveal')
      }
    }

    // Active recall: skip = no sé = incorrecto (Regla 3: Fuente Zero-Trust)
    const handleSkip = () => {
      setFlowAnswers(prev => {
        const n = new Map(prev)
        n.set(flowCard.id, { skipped: true, score: 'incorrect' })
        return n
      })
      // Siempre incorrecto. Skip no es "casi" ni "voy a ver". Es "no sé".
      setSessionResults(prev => { const n = new Map(prev); n.set(flowCard.id, 'incorrect'); return n })
      submitActiveRecall({
        question: flowCard.text,
        type: flowCard.type,
        score: 'incorrect',
        concept: flowCard.linkedConcept,
        definition: flowCard.linkedDefinition,
        sourceNote: flowCard.note,
        sourceBloque: flowCard.bloque,
      }).catch(() => {})
      if (autoAdvance) {
        setFlowPhase('question')
        setFlowAnswer('')
        advanceToNext()
      } else {
        setFlowPhase('reveal')
      }
    }

    // Active recall: submit written answer (saved locally, sent to store with score)
    const handleSubmitAnswer = () => {
      if (!flowAnswer.trim()) return
      setFlowAnswers(prev => {
        const n = new Map(prev)
        n.set(flowCard.id, { answer: flowAnswer, skipped: false })
        return n
      })
      setFlowAnswer('')
      setFlowPhase('scoring')
    }

    // Shared score handler for flow mode
    const onFlowScore = (score: SelfScore) => {
      // Save score + answer to persistent store
      const answer = flowAnswers.get(flowCard.id)?.answer || undefined
      setSessionResults(prev => { const n = new Map(prev); n.set(flowCard.id, score); return n })
      submitActiveRecall({
        question: flowCard.text,
        type: flowCard.type,
        score,
        answer,
        concept: flowCard.linkedConcept,
        definition: flowCard.linkedDefinition,
        sourceNote: flowCard.note,
        sourceBloque: flowCard.bloque,
      }).catch(() => {})
      setFlowAnswers(prev => {
        const n = new Map(prev)
        const existing = n.get(flowCard.id) ?? { skipped: false }
        n.set(flowCard.id, { ...existing, score })
        return n
      })
      if (autoAdvance) {
        // autoAdvance: score committed → advance immediately (definition optional)
        setFlowPhase('question')
        setFlowAnswer('')
        advanceToNext()
      } else {
        // manual: show definition as feedback after scoring
        setFlowPhase('reveal')
      }
    }

    return (
      <div className="max-w-xl mx-auto">
        {/* Header with progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-text-primary">🎯 Flow Study</span>
          <span className="text-xs text-text-secondary">{currentIndex + 1}/{cards.length}</span>
        </div>

        {/* Flow toggles */}
        <div className="flex gap-4 mb-4 items-center">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={activeRecall} onChange={e => { setActiveRecall(e.target.checked); resetSession() }}
              className="w-3.5 h-3.5 rounded border-border-light bg-surface accent-accent" />
            <span className="text-[0.65rem] text-text-secondary">Responder antes de revelar</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border-light bg-surface accent-accent" />
            <span className="text-[0.65rem] text-text-secondary">Auto-avanzar</span>
          </label>
        </div>

        <ProgressBar value={progress} />

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {cards.map((_, i) => (
            <div key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i < currentIndex ? 'bg-accent' : i === currentIndex ? 'bg-accent ring-2 ring-accent/40' : 'bg-card'
              }`}
            />
          ))}
        </div>

        {/* Card: flashcard mode clickable to reveal */}
        <div className={`bg-card rounded-xl p-6 ${isFlashcard && flowPhase === 'question' && !flowEntry?.score ? 'cursor-pointer hover:bg-surface/50' : ''} transition-colors`}
          onClick={isFlashcard && flowPhase === 'question' ? handleTapReveal : undefined}
          onKeyDown={isFlashcard && flowPhase === 'question' ? e => { if (e.key === 'Enter') handleTapReveal() } : undefined}
          role={isFlashcard && flowPhase === 'question' ? 'button' : undefined}
          tabIndex={isFlashcard && flowPhase === 'question' ? 0 : undefined}
        >
          <div className="flex items-start gap-3">
            <CardTypeIcon type={flowCard.type} />
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-base font-medium mb-2">{flowCard.text}</p>

              {flowCard.linkedConcept && flowPhase !== 'reveal' && (
                <p className="text-text-tertiary text-xs mb-4">📎 {flowCard.linkedConcept}</p>
              )}

              {/* Phase: QUESTION — flashcard tap hint or active recall buttons */}
              {flowPhase === 'question' && !flowEntry?.score && (
                <>
                  {isFlashcard ? (
                    <p className="text-text-tertiary text-sm italic text-center py-8">Tap para revelar la definición</p>
                  ) : (
                    <div className="flex gap-3 mt-6">
                      <button className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface text-text-secondary border border-border-light hover:text-text-primary hover:border-accent/30 transition-all"
                        onClick={e => { e.stopPropagation(); handleSkip() }}>
                        🤔 No sé
                      </button>
                      <button className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/80 transition-all"
                        onClick={e => { e.stopPropagation(); setFlowPhase('answering') }}>
                        ✍️ Responder
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Phase: ANSWERING (active recall only) */}
              {flowPhase === 'answering' && (
                <div className="mt-4" onClick={e => e.stopPropagation()}>
                  <textarea
                    className="w-full px-4 py-3 text-sm bg-surface border border-border-light rounded-lg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none transition-all"
                    rows={4}
                    placeholder={flowCard.type === 'doubt' ? '¿Cómo resolverías esta duda?...' : 'Escribí tu respuesta antes de ver la definición...'}
                    value={flowAnswer}
                    onChange={e => setFlowAnswer(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80 disabled:opacity-40 transition-all"
                      onClick={handleSubmitAnswer}
                      disabled={!flowAnswer.trim() || flowAnswerStatus === 'saving'}
                    >
                      {flowAnswerStatus === 'saving' ? 'Guardando...' : 'Enviar respuesta'}
                    </button>
                    <button className="px-3 py-2 text-sm font-medium bg-surface text-text-secondary border border-border-light rounded-lg hover:text-text-primary transition-all"
                      onClick={() => setFlowPhase('question')}>
                      Volver
                    </button>
                    {flowAnswerStatus === 'error' && (
                      <span className="text-xs text-danger">Error al guardar</span>
                    )}
                  </div>
                </div>
              )}

              {/* Phase: SCORING — self-evaluate BEFORE seeing the definition (Fuente Zero-Trust) */}
              {flowPhase === 'scoring' && (
                <div className="border-t border-border-light pt-4 mt-4">
                  {/* Show user's answer so they can evaluate themselves */}
                  {flowAnswer && (
                    <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-[0.65rem] font-medium text-text-secondary mb-1 uppercase tracking-wider">Tu respuesta</p>
                      <p className="text-sm text-text-primary leading-relaxed">{flowAnswer}</p>
                    </div>
                  )}
                  <p className="text-xs font-medium text-text-secondary mb-1">Evaluá tu respuesta antes de ver la definición:</p>
                  <p className="text-[0.6rem] text-text-tertiary mb-2">Si no recordás la fuente exacta, no la adivinés. Sé honesto.</p>
                  <SelfScoreButtons onScore={onFlowScore} />
                </div>
              )}

              {/* Phase: REVEAL — definition shown ONLY after scoring (feedback) */}
              {flowPhase === 'reveal' && (
                <div className="border-t border-border-light pt-4 mt-4">
                  {/* Show what user answered (if active recall) */}
                  {flowEntry?.answer && (
                    <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-[0.65rem] font-medium text-text-secondary mb-1 uppercase tracking-wider">Tu respuesta</p>
                      <p className="text-sm text-text-primary leading-relaxed">{flowEntry.answer}</p>
                    </div>
                  )}
                  {flowEntry?.skipped && (
                    <div className="mb-4 p-3 bg-warning/5 rounded-lg border border-warning/10">
                      <p className="text-[0.65rem] font-medium text-warning mb-1 uppercase tracking-wider">No respondida</p>
                      <p className="text-xs text-text-secondary">Elegiste no responder. El score ya se registró como incorrecto.</p>
                    </div>
                  )}

                  {/* Score result */}
                  {flowEntry?.score && (
                    <div className={`mb-4 p-3 rounded-lg border ${
                      flowEntry.score === 'correct' ? 'bg-success/5 border-success/20' :
                      flowEntry.score === 'partial' ? 'bg-warning/5 border-warning/20' :
                      'bg-danger/5 border-danger/20'
                    }`}>
                      <p className="text-sm font-medium text-center">
                        {flowEntry.score === 'correct' ? '✅ Lo sabías' : flowEntry.score === 'partial' ? '🟡 Casi' : '❌ A repasar'}
                      </p>
                      {flowEntry.score !== 'correct' && (
                        <p className="text-[0.6rem] text-text-tertiary text-center mt-0.5">Ahora revisá la definición para consolidar.</p>
                      )}
                    </div>
                  )}

                  {/* Definition (feedback — ya se evaluó) */}
                  <DefinitionBlock concept={flowCard.linkedConcept} definition={flowCard.linkedDefinition} />
                  {flowCard.note && (
                    <p className="text-text-tertiary text-[0.55rem] mt-3">Fuente: {flowCard.note} · B{flowCard.bloque}</p>
                  )}

                  {/* Flashcard mode (activeRecall OFF): score buttons shown here since there was no scoring phase */}
                  {isFlashcard && !flowEntry?.score && (
                    <SelfScoreButtons onScore={onFlowScore} />
                  )}

                  {/* Siguiente button (manual mode only; score already set) */}
                  {!autoAdvance && (
                    <div className="mt-5 flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        flowEntry?.score === 'correct' ? 'text-success' : flowEntry?.score === 'partial' ? 'text-warning' : 'text-danger'
                      }`}>
                        {flowEntry?.score === 'correct' ? '✅ Lo sabías' : flowEntry?.score === 'partial' ? '🟡 Casi' : '❌ A repasar'}
                      </span>
                      <button className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/80 transition-all" onClick={handleFlowNext}>
                        {currentIndex + 1 >= cards.length ? 'Ver resultados' : 'Siguiente →'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ───
  return (
    <div>
      {/* Store stats + Mode toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['list', 'repaso', 'flow'] as const).map(m => (
            <button key={m}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${mode === m ? 'bg-accent text-white shadow-sm' : 'bg-card text-text-secondary hover:text-text-primary'}`}
              onClick={() => switchMode(m)}
            >
              {m === 'list' ? '📋 Lista' : m === 'repaso' ? `🔁 Repaso (${pendingCards.length})` : `🎯 Flow (${cards.length})`}
            </button>
          ))}
        </div>
        {storeStats && (
          <div className="flex items-center gap-3 text-[0.6rem] text-text-tertiary">
            <span>🔥 {storeStats.streak}d racha</span>
            <span>📅 {storeStats.reviewedToday} hoy</span>
            {storeStats.dueCount > 0 && (
              <span className="text-warning font-medium">⏰ {storeStats.dueCount} pendientes</span>
            )}
            <button className="px-2 py-0.5 bg-card border border-border-light rounded hover:text-text-primary transition-colors"
              onClick={async () => {
                const s = await fetchActiveRecallStats()
                setStoreStats(s)
              }}
            >↻</button>
          </div>
        )}
      </div>

      {mode === 'list' && renderList()}
      {mode === 'repaso' && renderRepaso()}
      {mode === 'flow' && renderFlow()}
    </div>
  )
}
