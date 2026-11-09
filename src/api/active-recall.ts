// active-recall.ts — dominio Active Recall Store v2 (ADR-026)
import { fetchJSON } from './client'
import type {
  ActiveRecallDueItem,
  ActiveRecallDueResponse,
  ActiveRecallQuestion,
  ActiveRecallSubmitResponse,
  ActiveRecallStoreStats,
} from '../types'

export function fetchActiveRecallAll(signal?: AbortSignal): Promise<{ questions: ActiveRecallDueItem[] }> {
  return fetchJSON<{ questions: ActiveRecallDueItem[] }>(`/api/active-recall/all`, signal)
}

export function fetchActiveRecallDue(): Promise<ActiveRecallDueResponse> {
  return fetchJSON<ActiveRecallDueResponse>(`/api/active-recall/due`)
}

export function fetchActiveRecallQuestion(id: string): Promise<ActiveRecallQuestion> {
  return fetchJSON<ActiveRecallQuestion>(`/api/active-recall/question/${encodeURIComponent(id)}`)
}

export function submitActiveRecall(params: {
  question: string
  type: 'question' | 'doubt' | 'concept'
  answer?: string
  score: 'correct' | 'partial' | 'incorrect'
  concept?: string | null
  definition?: string | null
  sourceNote?: string | null
  sourceBloque?: number
  sessionId?: string
}): Promise<ActiveRecallSubmitResponse> {
  return fetch(`/api/active-recall/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(r => r.json())
}

export function fetchActiveRecallStats(signal?: AbortSignal): Promise<ActiveRecallStoreStats> {
  return fetchJSON<ActiveRecallStoreStats>(`/api/active-recall/stats`, signal)
}

export function seedActiveRecallQuestions(questions: Array<{
  question: string
  type: string
  concept?: string | null
  definition?: string | null
  sourceNote?: string | null
  sourceBloque?: number
}>, signal?: AbortSignal): Promise<{ success: boolean; seeded: number; stats: ActiveRecallStoreStats }> {
  return fetch(`/api/active-recall/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
    signal,
  }).then(r => r.json())
}
