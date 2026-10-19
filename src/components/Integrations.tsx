import { useState, useEffect } from 'react'
import { fetchFinanzas, fetchAnkiStats } from '../api'
import type { FinanzasData, AnkiStats } from '../types'

export default function Integrations() {
  const [finanzas, setFinanzas] = useState<FinanzasData | null>(null)
  const [anki, setAnki] = useState<AnkiStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchFinanzas().then(setFinanzas).catch(() => setFinanzas(null)),
      fetchAnkiStats().then(setAnki).catch(() => setAnki(null)),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSkeleton />

  return (
    <div className="space-y-6">
      {/* Finanzas (local, desde KBL_Admin) */}
      {finanzas && !(finanzas as any).error ? (
        <FinanzasCard data={finanzas} />
      ) : (
        <div className="card p-5 text-center">
          <p className="text-3xl mb-2">$</p>
          <p className="text-sm text-text-secondary">Datos financieros no disponibles</p>
          <p className="text-xs text-text-tertiary mt-1">{(finanzas as any)?.error || 'Error al leer presupuesto'}</p>
        </div>
      )}

      {/* Anki Stats (local, desde KBL_Admin) */}
      {anki ? (
        <AnkiCard data={anki} />
      ) : (
        <div className="card p-5 text-center">
          <p className="text-3xl mb-2">🗂️</p>
          <p className="text-sm text-text-secondary">Anki no disponible</p>
          <p className="text-xs text-text-tertiary mt-1">Asegurate de que Anki esté abierto con AnkiConnect</p>
        </div>
      )}

      <div className="card p-5 bg-success/5 border border-success/20">
        <p className="text-xs text-text-secondary">
          ✅ Todos los datos se sirven desde KBL_Admin <code className="text-accent">:3002</code>.
          Sin dependencia de servidores externos.
        </p>
      </div>
    </div>
  )
}

function FinanzasCard({ data }: { data: FinanzasData }) {
  const balance = data.saldo
  const ingresos = data.ingresos
  const gastos = data.gastos_fijos
  const flujo = data.flujo_neto
  const isDeficit = flujo < 0

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Resumen Financiero</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricBox label="Saldo Actual" value={formatCurrency(balance)} color={balance >= 0 ? 'text-success' : 'text-danger'} />
        <MetricBox label="Ingresos" value={formatCurrency(ingresos)} color="text-success" />
        <MetricBox label="Gastos Fijos" value={formatCurrency(gastos)} color="text-danger" />
        <MetricBox label="Flujo Neto" value={formatCurrency(flujo)} color={isDeficit ? 'text-danger' : 'text-success'} />
      </div>

      {/* Runway info — always present */}
      {data.runway && (
        <div className={`mb-4 p-3 rounded-lg border ${isDeficit ? 'bg-warning/10 border-warning/20' : 'bg-success/10 border-success/20'}`}>
          <p className={`text-xs font-semibold ${isDeficit ? 'text-warning' : 'text-success'}`}>
            {typeof data.runway.meses === 'number'
              ? `⚠️ Runway: ${data.runway.meses} meses (hasta ${data.runway.fecha_fin})`
              : `✅ Runway: ${data.runway.meses} — flujo positivo`}
          </p>
        </div>
      )}

      {/* Budget categories from presupuesto */}
      {data.presupuesto && Object.keys(data.presupuesto.limites).length > 0 && (
        <div className="pt-4 border-t border-border-light">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Límites por categoría</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(data.presupuesto.limites).map(([cat, limite]) => (
              <div key={cat} className="flex justify-between text-xs bg-surface rounded-lg px-3 py-2">
                <span className="text-text-primary capitalize">{cat.replace(/_/g, ' ')}</span>
                <span className="font-mono text-text-primary">{formatCurrency(limite)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border-light text-[0.65rem] text-text-tertiary">
        {data.reconciliacion && <span>Último saldo registrado: {data.reconciliacion.desde_fecha}</span>}
      </div>
    </div>
  )
}

function AnkiCard({ data }: { data: AnkiStats }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">Progreso de Estudio (Anki)</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox label="Revisadas Hoy" value={String(data.reviewed ?? 0)} color="text-accent" />
        <MetricBox label="Pendientes" value={String(data.due ?? 0)} color="text-accent" />
        <MetricBox label="Total Cartas" value={String(data.total ?? 0)} color="text-accent" />
        <MetricBox label="Racha (días)" value={String(data.streak ?? 0)} color="text-accent" />
      </div>

      {data.decks && data.decks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border-light">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Decks</h4>
          <div className="space-y-2">
            {[...data.decks]
              .sort((a, b) => (b.due + (b.studied || 0)) - (a.due + (a.studied || 0)))
              .slice(0, 10)
              .map(d => {
                const total = d.total || 1
                const done = d.studied || 0
                const pct = Math.round((done / total) * 100)
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="text-xs text-text-primary w-40 truncate" title={d.name}>{d.name}</span>
                    <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent/40 to-accent/20" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-text-secondary w-16 text-right">{d.due} due</span>
                    <span className="text-xs font-mono text-text-tertiary w-10 text-right">{pct}%</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-lg p-4">
      <p className="text-[0.65rem] text-text-secondary uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
    </div>
  )
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount)
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-5 animate-pulse">
        <div className="h-3 bg-surface rounded w-1/3 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-surface rounded-lg" />)}
        </div>
      </div>
      <div className="card p-5 animate-pulse">
        <div className="h-3 bg-surface rounded w-1/4 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-surface rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}
