import { useState, useEffect, useCallback } from 'react'
import type { MarketData } from '../types'
import { fetchMarketData } from '../api'

export default function MarketDashboard() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'trends' | 'ceos' | 'strategy' | 'motivation'>('trends')
  const [phraseIdx, setPhraseIdx] = useState(0)

  const load = useCallback(async () => {
    try {
      const d = await fetchMarketData()
      setData(d)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Rotate motivational phrase every 8 seconds
  useEffect(() => {
    if (!data?.motivational_phrases?.length) return
    const iv = setInterval(() => {
      setPhraseIdx(i => (i + 1) % data.motivational_phrases.length)
    }, 8000)
    return () => clearInterval(iv)
  }, [data?.motivational_phrases?.length])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-card/50 rounded-lg animate-pulse w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-card/50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-4xl mb-3">📊</p>
        <p className="font-medium">No hay datos de mercado disponibles</p>
      </div>
    )
  }

  return (
    <div>
      {/* Motivational Phrase Rotator (always visible at top) */}
      {data.motivational_phrases.length > 0 && (
        <div className="bg-gradient-to-r from-accent/10 to-blue-500/10 rounded-xl p-5 mb-6 border border-accent/20">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">💬</span>
            <div>
              <p className="text-text-primary italic font-medium leading-relaxed animate-fade-in">
                {data.motivational_phrases[phraseIdx]}
              </p>
              <div className="flex gap-1.5 mt-3">
                {data.motivational_phrases.map((_, i) => (
                  <button
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${i === phraseIdx ? 'bg-accent w-4' : 'bg-text-tertiary/40'}`}
                    onClick={() => setPhraseIdx(i)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card rounded-lg p-1">
        {([
          { id: 'trends' as const, label: '📈 Tendencias', count: data.trends.length },
          { id: 'ceos' as const, label: '🎤 CEOs', count: data.ceo_quotes.length },
          { id: 'strategy' as const, label: '🎯 Estrategia', count: data.recommendations.length },
          { id: 'motivation' as const, label: '💪 Frases', count: data.motivational_phrases.length },
        ]).map(t => (
          <button
            key={t.id}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setTab(t.id)}
          >
            <span className="max-lg:hidden">{t.label}</span>
            <span className="lg:hidden">{t.label.split(' ')[0]}</span>
            <span className="ml-1.5 text-[0.65rem] opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Trends */}
      {tab === 'trends' && (
        <div className="space-y-3">
          {data.trends.map((t, i) => (
            <div key={i} className="bg-card rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className={`text-lg mt-0.5 shrink-0 ${
                  t.priority === 'alta' ? 'text-red-400' : t.priority === 'media' ? 'text-yellow-400' : 'text-blue-400'
                }`}>
                  {t.priority === 'alta' ? '🔴' : t.priority === 'media' ? '🟡' : '🔵'}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-semibold text-text-primary text-sm">{t.title}</h4>
                    <span className="text-[0.6rem] text-text-tertiary bg-surface px-2 py-0.5 rounded-full">
                      {t.source}
                    </span>
                  </div>
                  <p className="text-text-secondary text-sm">{t.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CEO Quotes */}
      {tab === 'ceos' && (
        <div className="space-y-4">
          {data.ceo_quotes.map((q, i) => (
            <div key={i} className="bg-card rounded-xl p-5 border-l-4 border-accent">
              <p className="text-text-primary text-sm leading-relaxed italic mb-2">"{q.quote}"</p>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="font-medium text-accent">— {q.person}</span>
                <span className="text-text-tertiary">{q.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy Recommendations */}
      {tab === 'strategy' && (
        <div className="space-y-3">
          {data.recommendations.map((r, i) => (
            <div key={i} className="bg-card rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-accent font-bold text-sm mt-0.5 shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                <div className="min-w-0">
                  <h4 className="font-semibold text-text-primary text-sm mb-1">{r.skill}</h4>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[0.6rem] text-text-tertiary bg-surface px-2 py-0.5 rounded-full">
                      🔎 {r.focus}
                    </span>
                  </div>
                  <p className="text-text-secondary text-xs">{r.porque}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All phrases (grid) */}
      {tab === 'motivation' && (
        <div className="space-y-3">
          {data.motivational_phrases.map((p, i) => (
            <div key={i} className={`bg-card rounded-xl p-4 ${i === phraseIdx ? 'ring-2 ring-accent/40' : ''}`}>
              <p className="text-text-primary text-sm leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-[0.6rem] text-text-tertiary text-center mt-8">
        Datos curados manualmente · Última actualización: {data.last_updated || 'N/A'}
      </p>
    </div>
  )
}
