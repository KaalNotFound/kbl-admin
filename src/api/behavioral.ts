// behavioral.ts — dominio Behavioral Tracking (ADR-026)
import { fetchJSON } from './client'
import type {
  BlockType,
  DailySummary,
  WeeklySummary,
  BlockAdherence,
  Streaks,
  Timeline,
  CurrentBlock,
} from '../types'

export function startBehavioralSession(): Promise<{ success: boolean; session_id: string; started_at: string; block_type: BlockType }> {
  return fetch(`/api/behavioral/session/start`, { method: 'POST' }).then(r => r.json())
}

export function endBehavioralSession(sessionId: string): Promise<{ success: boolean; session_id: string; duration_minutes: number; block_type: string }> {
  return fetch(`/api/behavioral/session/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  }).then(r => r.json())
}

export function logBehavioralActivity(sessionId: string, params: { type: string; target?: string; tool_calls?: number }): Promise<{ success: boolean; activity_id: string }> {
  return fetch(`/api/behavioral/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ...params }),
  }).then(r => r.json())
}

export function fetchBehavioralDaily(date?: string): Promise<DailySummary> {
  const q = date ? `?date=${date}` : ''
  return fetchJSON<DailySummary>(`/api/behavioral/summary/daily${q}`)
}

export function fetchBehavioralWeekly(): Promise<WeeklySummary> {
  return fetchJSON<WeeklySummary>(`/api/behavioral/summary/weekly`)
}

export function fetchBehavioralBlocks(date?: string): Promise<BlockAdherence> {
  const q = date ? `?date=${date}` : ''
  return fetchJSON<BlockAdherence>(`/api/behavioral/blocks${q}`)
}

export function fetchBehavioralStreaks(): Promise<Streaks> {
  return fetchJSON<Streaks>(`/api/behavioral/streaks`)
}

export function fetchBehavioralTimeline(date?: string): Promise<Timeline> {
  const q = date ? `?date=${date}` : ''
  return fetchJSON<Timeline>(`/api/behavioral/timeline${q}`)
}

export function fetchCurrentBlock(): Promise<CurrentBlock> {
  return fetchJSON<CurrentBlock>(`/api/behavioral/current-block`)
}
