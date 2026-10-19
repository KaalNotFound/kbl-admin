import { useState, useEffect, useCallback, useRef } from 'react'
import type { PomodoroStatus } from '../types'
import { fetchPomodoroStatus, startPomodoro, stopPomodoro, skipPomodoro, pausePomodoro, resumePomodoro } from '../api'

function fmtTime(ms: number): string {
  if (ms <= 0) return '00:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function playAlarm() {
  try {
    const ctx = new AudioContext()
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.5)
    })
  } catch {}
}

const PHASE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  work: { label: 'ENFOQUE', color: 'text-green-400', icon: '🎯' },
  break: { label: 'DESCANSO', color: 'text-yellow-400', icon: '☕' },
  long_break: { label: 'DESCANSO LARGO', color: 'text-blue-400', icon: '🌊' },
}

export default function PomodoroTimer() {
  const [status, setStatus] = useState<PomodoroStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workMin, setWorkMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [actionLoading, setActionLoading] = useState(false)
  const wasActiveRef = useRef(false)
  const wasPhaseRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const s = await fetchPomodoroStatus()
      setStatus(s)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 1000) // refresh every second for countdown
    return () => clearInterval(interval)
  }, [load])

  // Alarm: play sound on phase transitions or active → inactive
  useEffect(() => {
    if (status) {
      // Phase change (work→break or break→work)
      if (status.phase !== wasPhaseRef.current && wasPhaseRef.current !== null) {
        playAlarm()
      }
      // Manual stop (active → false)
      if (wasActiveRef.current && !status.active) {
        playAlarm()
      }
    }
    wasActiveRef.current = !!status?.active
    wasPhaseRef.current = status?.phase || null
  }, [status])

  const handleStart = async () => {
    setActionLoading(true)
    try {
      const res = await startPomodoro(workMin, breakMin)
      if (res.success) await load()
      else setError('No se pudo iniciar')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleStop = async () => {
    setActionLoading(true)
    try {
      await stopPomodoro()
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleSkip = async () => {
    setActionLoading(true)
    try {
      await skipPomodoro()
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePause = async () => {
    setActionLoading(true)
    try {
      await pausePomodoro()
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleResume = async () => {
    setActionLoading(true)
    try {
      await resumePomodoro()
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error && !status) return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <p className="text-red-400 text-sm font-medium">Error al cargar pomodoro</p>
      <p className="text-red-400/60 text-xs mt-1">{error}</p>
    </div>
  )

  const active = status?.active
  const phase = active ? status!.phase : null
  const cfg = phase ? PHASE_CONFIG[phase] || PHASE_CONFIG.work : PHASE_CONFIG.work
  const timer = status?.current_timer

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Main Timer Display */}
      <div className="bg-card border border-border-light rounded-2xl p-8 text-center">
        {/* Phase indicator */}
        {active && phase ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-lg">{status?.paused ? '⏸️' : cfg.icon}</span>
            <span className={`text-xs font-bold uppercase tracking-[0.2em] ${status?.paused ? 'text-yellow-400' : cfg.color}`}>
              {status?.paused ? 'PAUSADO' : cfg.label}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-lg">⏸️</span>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-tertiary">INACTIVO</span>
          </div>
        )}

        {/* Time display */}
        <div className="text-[5rem] font-bold tracking-tight leading-none mt-2 mb-4 text-text-primary tabular-nums">
          {timer ? fmtTime(timer.remaining_ms) : '— — : — —'}
        </div>

        {/* Progress ring */}
        {timer && timer.total_ms > 0 && (
          <div className="w-full bg-surface rounded-full h-2 mb-6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-linear ${
                phase === 'work' ? 'bg-green-500' : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(100, timer.progress)}%` }}
            />
          </div>
        )}

        {/* Sessions counter */}
        {active && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mb-6">
            {Array.from({ length: status?.completed_sessions || 0 }).map((_, i) => (
              <span key={i} className="text-green-400">🍅</span>
            ))}
            <span className="text-text-tertiary text-xs ml-1">
              {status?.completed_sessions || 0} sesiones completadas
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          {active ? (
            <>
              {status?.paused ? (
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-sm font-medium text-green-400 hover:bg-green-500/20 transition-all disabled:opacity-40"
                >
                  ▶ Reanudar
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm font-medium text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-40"
                >
                  ⏸ Pausa
                </button>
              )}
              <button
                onClick={handleSkip}
                disabled={actionLoading}
                className="px-5 py-2.5 bg-card border border-border-light rounded-xl text-sm font-medium text-text-secondary hover:bg-surface hover:text-text-primary transition-all disabled:opacity-40"
              >
                ⏭ Saltar
              </button>
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
              >
                ⏹ Detener
              </button>
            </>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="px-8 py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-40"
            >
              ▶ Iniciar Pomodoro
            </button>
          )}
        </div>
      </div>

      {/* Configuration (only when inactive) */}
      {!active && (
        <div className="bg-card border border-border-light rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Configuración</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Trabajo (min)</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setWorkMin(Math.max(1, workMin - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-surface rounded-lg text-text-secondary hover:text-text-primary"
                >−</button>
                <span className="w-12 text-center text-lg font-semibold text-text-primary tabular-nums">{workMin}</span>
                <button
                  onClick={() => setWorkMin(Math.min(120, workMin + 1))}
                  className="w-8 h-8 flex items-center justify-center bg-surface rounded-lg text-text-secondary hover:text-text-primary"
                >+</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Descanso (min)</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBreakMin(Math.max(1, breakMin - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-surface rounded-lg text-text-secondary hover:text-text-primary"
                >−</button>
                <span className="w-12 text-center text-lg font-semibold text-text-primary tabular-nums">{breakMin}</span>
                <button
                  onClick={() => setBreakMin(Math.min(60, breakMin + 1))}
                  className="w-8 h-8 flex items-center justify-center bg-surface rounded-lg text-text-secondary hover:text-text-primary"
                >+</button>
              </div>
            </div>
          </div>
          <p className="text-xs text-text-tertiary">
            Cada 4 sesiones → descanso largo de 15 min. Usa el mismo timer-state.json que los overlays de cocina.
          </p>
          <button
            onClick={playAlarm}
            className="text-xs text-accent hover:text-accent/80 underline underline-offset-2"
          >
            🔊 Probar sonido de alarma
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && status && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          <p className="text-red-400/80 text-xs">{error}</p>
        </div>
      )}

      {/* Quick Tips */}
      <div className="bg-card border border-border-light rounded-xl p-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Tips</h4>
        <ul className="space-y-1.5 text-xs text-text-tertiary">
          <li>🍅 Los timers se sincronizan con el overlay de cocina (kbl_cooking.py)</li>
          <li>⏭ Skip avanza a la siguiente fase (work → break → work)</li>
          <li>📊 Las sesiones completadas se acumulan hasta que detenés</li>
          <li>⚙️ Configurá duración antes de iniciar</li>
        </ul>
      </div>
    </div>
  )
}
