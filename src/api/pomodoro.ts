// pomodoro.ts — dominio Pomodoro Timer (ADR-026)
import { fetchJSON } from './client'
import type { PomodoroStatus } from '../types'

export function fetchPomodoroStatus(signal?: AbortSignal): Promise<PomodoroStatus> {
  return fetchJSON<PomodoroStatus>(`/api/pomodoro/status`, signal)
}

export function startPomodoro(workMin: number, breakMin: number): Promise<{ success: boolean; phase: string }> {
  return fetch(`/api/pomodoro/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ work_min: workMin, break_min: breakMin }),
  }).then(r => r.json())
}

export function stopPomodoro(): Promise<{ success: boolean; completed_sessions: number }> {
  return fetch(`/api/pomodoro/stop`, { method: 'POST' }).then(r => r.json())
}

export function skipPomodoro(): Promise<{ success: boolean; phase: string }> {
  return fetch(`/api/pomodoro/skip`, { method: 'POST' }).then(r => r.json())
}

export function pausePomodoro(): Promise<{ success: boolean }> {
  return fetch(`/api/pomodoro/pause`, { method: 'POST' }).then(r => r.json())
}

export function resumePomodoro(): Promise<{ success: boolean }> {
  return fetch(`/api/pomodoro/resume`, { method: 'POST' }).then(r => r.json())
}
