import { useState, useEffect, useCallback } from 'react'
import type { StudyData } from '../types'
import { fetchStudyData } from '../api'
import AnkiDashboard from './AnkiDashboard'
import PomodoroTimer from './PomodoroTimer'
import { PROMPT_CARDS, CATEGORY_META, type PromptCategory } from '../data/prompts'
import MisTutores from './MisTutores'
import ConceptDictionary from './ConceptDictionary'
import ShadowStudy from './ShadowStudy'
import StudyHashmap from './StudyHashmap'
import SkillTree from './SkillTree'
import CognitiveDebtChart from './CognitiveDebt'
import BiasRadar from './BiasRadar'
import SocraticAudit from './SocraticAudit'

type Section = 'notes' | 'hashmap' | 'anki' | 'pomodoro' | 'cognitivo'

type CognitiveTab = 'skill-tree' | 'debt' | 'bias' | 'socratic'

const SECTION_META: Record<Section, { label: string; icon: string }> = {
  notes:     { label: 'Notas',      icon: '📄' },
  cognitivo: { label: 'Cognitivo',  icon: '🧠' },
  hashmap:   { label: 'Mapa',       icon: '🗺️' },
  anki:      { label: 'Anki',       icon: '🗂️' },
  pomodoro:  { label: 'Pomodoro',   icon: '🍅' },
}

const COGNITIVE_TAB_META: Record<CognitiveTab, { label: string; icon: string }> = {
  'skill-tree': { label: 'Skill Tree',  icon: '🌳' },
  'debt':       { label: 'Deuda',       icon: '📈' },
  'bias':       { label: 'Sesgos',      icon: '🎯' },
  'socratic':   { label: 'Socrático',   icon: '💬' },
}

export default function StudyDashboard() {
  const [section, setSection] = useState<Section>('notes')

  // --- Study Notes state ---
  const [data, setData] = useState<StudyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'notes' | 'concepts' | 'prompts' | 'shadow' | 'questions' | 'doubts' | 'tutores'>('notes')
  const [cogTab, setCogTab] = useState<CognitiveTab>('skill-tree')
  const [search, setSearch] = useState('')
  const [promptCategory, setPromptCategory] = useState<PromptCategory | 'all'>('all')

  // --- Prompts state ---
  const [promptTexts, setPromptTexts] = useState<Record<string, string>>({})

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await fetchStudyData(signal)
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + auto-poll every 30s so new notes appear without manual
  // refresh. One controller covers both, so unmount aborts the in-flight call.
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    const interval = setInterval(() => load(controller.signal), 30000)
    return () => {
      clearInterval(interval)
      controller.abort()
    }
  }, [load])

  return (
    <div>
      {/* Top section tabs */}
      <div className="flex gap-1 mb-6 bg-card rounded-lg p-1">
        {(Object.entries(SECTION_META) as [Section, { label: string; icon: string }][]).map(([key, meta]) => (
          <button
            key={key}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              section === key
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setSection(key)}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>

      {/* Section: Study Notes */}
      {section === 'notes' && (
        <>
          {loading ? (
            <div className="space-y-4">
              <div className="h-8 bg-card/50 rounded-lg animate-pulse w-48" />
              <div className="h-64 bg-card/50 rounded-xl animate-pulse" />
            </div>
          ) : !data || data.notes.length === 0 ? (
            <div className="text-center py-16 text-text-secondary">
              <p className="text-4xl mb-3">📝</p>
              <p className="font-medium">No hay notas de estudio</p>
              <p className="text-sm mt-2">Las notas se leen de <code className="text-accent">02 - APRENDIZAJE/MoureDev-Master/</code></p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-card rounded-xl p-4">
                  <p className="text-xs text-text-secondary">Notas</p>
                  <p className="text-2xl font-bold text-blue-400">{data.notes.length}</p>
                </div>
                <div className="bg-card rounded-xl p-4">
                  <p className="text-xs text-text-secondary">Conceptos</p>
                  <p className="text-2xl font-bold text-green-400">{data.concepts.length}</p>
                </div>
                <div className="bg-card rounded-xl p-4">
                  <p className="text-xs text-text-secondary">Preguntas</p>
                  <p className="text-2xl font-bold text-yellow-400">{data.questions.length}</p>
                </div>
                <div className="bg-card rounded-xl p-4">
                  <p className="text-xs text-text-secondary">Dudas</p>
                  <p className="text-2xl font-bold text-orange-400">{data.doubts.length}</p>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 mb-4 bg-card rounded-lg p-1">
                {(['notes', 'concepts', 'prompts', 'tutores', 'shadow', 'questions', 'doubts'] as const).map(t => (
                  <button
                    key={t}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                      tab === t
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'notes' ? '📄 Notas' : t === 'concepts' ? '🧠 Conceptos' : t === 'prompts' ? '🤖 Prompts' : t === 'tutores' ? '🤖 Tutores' : t === 'shadow' ? '🔁 Shadow' : t === 'questions' ? '❓ Preguntas' : '💡 Dudas'}
                  </button>
                ))}
              </div>

              {/* Search */}
              {tab !== 'notes' && (
                <div className="mb-4">
                  <input
                    type="search"
                    placeholder="Buscar..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border-light rounded-lg focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Notes table */}
              {tab === 'notes' && (
                <div className="bg-card rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-light text-text-secondary text-xs uppercase">
                        <th className="text-left px-4 py-3 font-medium">Nota</th>
                        <th className="text-left px-4 py-3 font-medium">Formato</th>
                        <th className="text-left px-4 py-3 font-medium">Preguntas</th>
                        <th className="text-left px-4 py-3 font-medium">Tamaño</th>
                        <th className="text-left px-4 py-3 font-medium">Modificado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.notes.map(n => (
                        <tr key={n.name} className={`border-b border-border-light last:border-0 hover:bg-surface/50 ${n.hasQuestions === false ? 'bg-warning/5' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-text-primary font-medium">{n.name}</span>
                              {n.hasQuestions === false && (
                                <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning font-medium" title="Esta nota no tiene preguntas">
                                  ⚠️ sin preguntas
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              n.format === 'json-blocks'
                                ? 'bg-green-500/10 text-green-400'
                                : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {n.format || 'markdown'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${
                              n.hasQuestions === false ? 'text-warning' : 'text-success'
                            }`}>
                              {n.hasQuestions === false ? '❌' : '✅'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{(n.size / 1024).toFixed(1)} KB</td>
                          <td className="px-4 py-3 text-text-secondary">{new Date(n.modified).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Concepts */}
              {tab === 'concepts' && (
                <ConceptDictionary data={data} search={search} />
              )}

              {/* Prompts */}
              {tab === 'prompts' && renderPrompts(promptTexts, setPromptTexts, promptCategory, setPromptCategory)}

              {/* Tutores */}
              {tab === 'tutores' && <MisTutores />}

              {/* Shadow (modo unificado) */}
              {tab === 'shadow' && <ShadowStudy data={data} filter="all" />}

              {/* Questions (ahora con ShadowStudy) */}
              {tab === 'questions' && <ShadowStudy data={data} filter="questions" />}

              {/* Doubts (ahora con ShadowStudy) */}
              {tab === 'doubts' && <ShadowStudy data={data} filter="doubts" />}
            </>
          )}
        </>
      )}

      {/* Section: Cognitivo */}
      {section === 'cognitivo' && (
        <>
          {/* Cognitive sub-tabs */}
          <div className="flex gap-1 mb-6 bg-card rounded-lg p-1">
            {(Object.entries(COGNITIVE_TAB_META) as [CognitiveTab, { label: string; icon: string }][]).map(([key, meta]) => (
              <button
                key={key}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  cogTab === key
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                onClick={() => setCogTab(key)}
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>

          {/* Cognitive sub-sections */}
          {cogTab === 'skill-tree' && <SkillTree />}
          {cogTab === 'debt' && <CognitiveDebtChart />}
          {cogTab === 'bias' && <BiasRadar />}
          {cogTab === 'socratic' && <SocraticAudit />}
        </>
      )}

      {/* Section: Hashmap */}
      {section === 'hashmap' && <StudyHashmap />}

      {/* Section: Anki */}
      {section === 'anki' && <AnkiDashboard />}

      {/* Section: Pomodoro */}
      {section === 'pomodoro' && <PomodoroTimer />}
    </div>
  )
}

function renderPrompts(
  promptTexts: Record<string, string>,
  setPromptTexts: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  categoryFilter: PromptCategory | 'all',
  setCategoryFilter: React.Dispatch<React.SetStateAction<PromptCategory | 'all'>>,
) {
  const filtered = categoryFilter === 'all'
    ? PROMPT_CARDS
    : PROMPT_CARDS.filter(c => c.category === categoryFilter)

  const getText = (id: string) => {
    const card = PROMPT_CARDS.find(c => c.id === id)
    return promptTexts[id] !== undefined ? promptTexts[id] : (card?.template || '')
  }

  const copyToClipboard = async (id: string) => {
    const text = getText(id)
    try {
      await navigator.clipboard.writeText(text)
      const btn = document.getElementById(`copy-${id}`)
      if (btn) {
        btn.textContent = '✅ Copiado'
        setTimeout(() => { btn.textContent = '📋 Copiar' }, 1500)
      }
    } catch {
      const ta = document.getElementById(`ta-${id}`) as HTMLTextAreaElement
      if (ta) { ta.select(); document.execCommand('copy') }
    }
  }

  const restore = (id: string) => {
    const card = PROMPT_CARDS.find(c => c.id === id)
    if (card) {
      setPromptTexts(prev => ({ ...prev, [id]: card.template }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-xl p-4 border-l-4 border-accent mb-4">
        <p className="text-sm text-text-secondary">
          🎯 <strong className="text-text-primary">Kit de Prompts</strong> — Técnicas
          del campus para mejorar tus consultas a la IA. Completá los placeholders,
          copiá el prompt y usalo con cualquier modelo.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            categoryFilter === 'all'
              ? 'bg-accent text-white'
              : 'bg-card text-text-secondary hover:text-text-primary border border-border-light'
          }`}
        >
          🌐 Todas
        </button>
        {(Object.entries(CATEGORY_META) as [PromptCategory, { label: string; icon: string }][]).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              categoryFilter === key
                ? 'bg-accent text-white'
                : 'bg-card text-text-secondary hover:text-text-primary border border-border-light'
            }`}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {filtered.map(card => {
        const currentText = getText(card.id)
        const isModified = currentText !== card.template
        const catMeta = CATEGORY_META[card.category]

        return (
          <div key={card.id} className="bg-card rounded-xl overflow-hidden border border-border-light">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
              <div className="flex items-center gap-2">
                <span className="text-lg">{card.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{card.title}</h3>
                    <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-surface text-text-tertiary border border-border-light">
                      {catMeta.icon} {catMeta.label}
                    </span>
                  </div>
                  <p className="text-[0.65rem] text-text-tertiary mt-0.5">{card.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isModified && (
                  <button
                    onClick={() => restore(card.id)}
                    className="px-2.5 py-1 text-[0.65rem] font-medium rounded-lg bg-surface text-text-secondary hover:bg-border-light transition-colors"
                    title="Restaurar template original"
                  >
                    🔄 Original
                  </button>
                )}
                <button
                  id={`copy-${card.id}`}
                  onClick={() => copyToClipboard(card.id)}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  📋 Copiar
                </button>
              </div>
            </div>

            {/* Textarea */}
            <div className="p-4">
              <textarea
                id={`ta-${card.id}`}
                value={currentText}
                onChange={e => setPromptTexts(prev => ({ ...prev, [card.id]: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-page border border-border-light rounded-lg text-text-primary font-mono leading-relaxed focus:outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 resize-y min-h-[80px]"
                rows={card.minRows || 5}
                spellCheck={false}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}


