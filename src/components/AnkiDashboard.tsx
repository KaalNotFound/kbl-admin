import { useState, useEffect, useCallback } from 'react'
import type { AnkiStats } from '../types'
import { fetchAnkiStats } from '../api'

export default function AnkiDashboard() {
  const [stats, setStats] = useState<AnkiStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const s = await fetchAnkiStats()
      setStats(s)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv) }, [load])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-24 bg-card/50 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-medium">Error al conectar con AnkiConnect</p>
        <p className="text-sm mt-2">Verificá que Anki esté abierto con el plugin AnkiConnect instalado</p>
      </div>
    )
  }

  if (!stats.connected) {
    return (
      <div className="text-center py-16 text-text-secondary">
        <p className="text-4xl mb-3">🔌</p>
        <p className="font-medium">Anki no está disponible</p>
        <p className="text-sm mt-2">Abrí Anki y asegurate de que AnkiConnect esté funcionando en :8765</p>
        <div className="mt-6 inline-block bg-card rounded-xl px-5 py-3 text-left text-sm space-y-1">
          <p>🔹 Anki abierto → Tools → Add-ons → AnkiConnect</p>
          <p>🔹 Puerto por defecto: <code className="text-accent">localhost:8765</code></p>
          <p>🔹 Después de abrir Anki, refrescá esta página</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon="📖" label="Revisadas Hoy" value={String(stats.reviewed)} color="text-green-400" />
        <SummaryCard icon="📌" label="Pendientes" value={String(stats.due)} color="text-yellow-400" />
        <SummaryCard icon="🗂️" label="Total Tarjetas" value={String(stats.total)} color="text-blue-400" />
        <SummaryCard icon="🔥" label="Racha (días)" value={String(stats.streak)} color="text-orange-400" />
      </div>

      {/* Deck Progress */}
      <div className="bg-card rounded-xl p-5 mb-8">
        <h3 className="font-semibold text-text-primary mb-4">🗂️ Progreso por Mazo</h3>
        {stats.decks.length === 0 ? (
          <p className="text-text-secondary text-sm">No se encontraron mazos</p>
        ) : (
          <div className="space-y-3">
            {stats.decks.map(d => (
              <div key={d.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-primary font-medium truncate mr-2">{d.name}</span>
                  <span className="text-text-secondary shrink-0">
                    {d.studied}/{d.total}
                    <span className="ml-2 text-accent">{d.pct}%</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(d.pct, 100)}%` }}
                  />
                </div>
                {d.due > 0 && (
                  <p className="text-xs text-yellow-400 mt-0.5">
                    ⏳ {d.due} tarjetas pendientes de repaso
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review History (last 14 days) */}
      {stats.history.length > 0 && (
        <div className="bg-card rounded-xl p-5">
          <h3 className="font-semibold text-text-primary mb-4">📊 Historial de Repasos (últimos 14 días)</h3>
          <div className="flex items-end gap-2 h-24">
            {stats.history.slice(-14).map(([date, count]) => {
              const max = Math.max(...stats.history.map(([, c]) => c), 1)
              const height = Math.max(4, (count / max) * 80)
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-accent/80 rounded-t"
                    style={{ height: `${height}px`, minHeight: '4px' }}
                    title={`${date}: ${count} repasos`}
                  />
                  <span className="text-[0.55rem] text-text-tertiary rotate-45 origin-left whitespace-nowrap">
                    {date.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-card rounded-xl p-4 flex items-center gap-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-text-secondary">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  )
}
