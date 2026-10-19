import { useState, useEffect } from 'react'
import type { SkillTreeModule, ConceptMastery } from '../types'
import { fetchSkillTree } from '../api'

const LEVEL_COLORS: Record<number, { bg: string; border: string; text: string; glow: string }> = {
  0: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', glow: '' },
  1: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', glow: '' },
  2: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', glow: 'shadow-blue-500/10 shadow-lg' },
  3: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', glow: 'shadow-purple-500/10 shadow-lg' },
  4: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', glow: 'shadow-red-500/20 shadow-xl' },
}

const LEVEL_NAMES = ['Amarrado', 'Expuesto', 'Funcional', 'Consolidado', 'Maestro']
const LEVEL_ICONS = ['\u{1F7E1}', '\u{1F7E2}', '\u{1F535}', '\u{1F7E3}', '\u{1F534}']

export default function SkillTree() {
  const [modules, setModules] = useState<SkillTreeModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedConcept, setSelectedConcept] = useState<ConceptMastery | null>(null)

  useEffect(() => {
    fetchSkillTree()
      .then(r => setModules(r.modules))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-text-secondary text-sm py-8 text-center">Cargando Skill Tree...</div>
  if (error) return <div className="text-danger text-sm py-8 text-center">Error: {error}</div>

  const totalConcepts = modules.reduce((sum, m) => sum + m.totalConcepts, 0)
  const totalMastered = modules.reduce((sum, m) => sum + m.masteredCount, 0)
  const avgScore = totalConcepts > 0
    ? Math.round(modules.reduce((sum, m) => sum + m.avgScore * m.totalConcepts, 0) / totalConcepts)
    : 0

  return (
    <div>
      {/* Global stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-accent">{totalConcepts}</p>
          <p className="text-xs text-text-secondary">Conceptos totales</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{totalMastered}</p>
          <p className="text-xs text-text-secondary">Consolidados (3+)</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{avgScore}</p>
          <p className="text-xs text-text-secondary">Score promedio</p>
        </div>
      </div>

      {/* Level legend */}
      <div className="flex flex-wrap gap-2 mb-6 text-xs">
        {LEVEL_NAMES.map((name, i) => (
          <span key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${LEVEL_COLORS[i].bg} ${LEVEL_COLORS[i].border} ${LEVEL_COLORS[i].text}`}>
            {LEVEL_ICONS[i]} {name}
          </span>
        ))}
      </div>

      {/* Modules */}
      {modules.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-3xl mb-2">{'\u{1F333}'}</p>
          <p className="font-medium">Sin conceptos registrados</p>
          <p className="text-sm mt-1">Hacé Active Recall o un Feynman Audit para empezar a subir de nivel</p>
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map(mod => {
            const isOpen = expanded[mod.name] !== false
            return (
              <div key={mod.name} className="bg-card rounded-xl overflow-hidden">
                {/* Module header */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface/50 transition-colors"
                  onClick={() => setExpanded(prev => ({ ...prev, [mod.name]: !isOpen }))}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{'\u{1F4DA}'}</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-text-primary">{mod.name}</p>
                      <p className="text-[0.65rem] text-text-secondary">
                        {mod.masteredCount}/{mod.totalConcepts} consolidados
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all"
                        style={{ width: `${mod.avgScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-text-secondary w-8 text-right">{mod.avgScore}</span>
                    <span className="text-text-tertiary text-xs">{isOpen ? '\u25B2' : '\u25BC'}</span>
                  </div>
                </button>

                {/* Concepts grid */}
                {isOpen && (
                  <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {mod.concepts.map(c => {
                      const lc = LEVEL_COLORS[c.level] || LEVEL_COLORS[0]
                      const isSelected = selectedConcept?.id === c.id
                      return (
                        <button
                          key={c.id}
                          className={`relative p-3 rounded-lg border text-left transition-all hover:scale-[1.02] ${lc.bg} ${lc.border} ${lc.glow} ${isSelected ? 'ring-2 ring-accent' : ''}`}
                          onClick={() => setSelectedConcept(isSelected ? null : c)}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-sm">{LEVEL_ICONS[c.level]}</span>
                            <span className={`text-[0.55rem] font-medium ${lc.text}`}>
                              N{c.level}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-text-primary truncate">{c.concept}</p>
                          <div className="mt-1.5 w-full h-1 bg-surface/50 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.level >= 3 ? 'bg-purple-400' : c.level >= 2 ? 'bg-blue-400' : 'bg-text-tertiary'}`}
                              style={{ width: `${c.currentScore}%` }}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Selected concept detail */}
      {selectedConcept && (
        <div className="mt-4 bg-card rounded-xl p-4 border-l-4 border-accent">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">{selectedConcept.concept}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {LEVEL_ICONS[selectedConcept.level]} Nivel {selectedConcept.level} — {LEVEL_NAMES[selectedConcept.level]}
              </p>
              {selectedConcept.module && (
                <p className="text-[0.65rem] text-text-tertiary mt-1">Módulo: {selectedConcept.module}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-accent">{selectedConcept.currentScore}</p>
              <p className="text-[0.6rem] text-text-secondary">/ 100</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface/50 rounded-lg p-2">
              <p className="text-sm font-bold text-text-primary">{selectedConcept.totalScores}</p>
              <p className="text-[0.55rem] text-text-secondary">Evaluaciones</p>
            </div>
            <div className="bg-surface/50 rounded-lg p-2">
              <p className="text-sm font-bold text-success">{selectedConcept.correctCount}</p>
              <p className="text-[0.55rem] text-text-secondary">Correctas</p>
            </div>
            <div className="bg-surface/50 rounded-lg p-2">
              <p className="text-sm font-bold text-text-secondary">
                {selectedConcept.lastValidated ? new Date(selectedConcept.lastValidated).toLocaleDateString() : 'Nunca'}
              </p>
              <p className="text-[0.55rem] text-text-secondary">Última vez</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
