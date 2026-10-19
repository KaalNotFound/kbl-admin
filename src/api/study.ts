// study.ts — dominio Estudio (Study Notes + Hashmap + Anki) (ADR-026)
import { fetchJSON } from './client'
import type { StudyData, StudyHistoryResponse, AnkiStats } from '../types'

export function fetchStudyData(): Promise<StudyData> {
  return fetchJSON<StudyData>(`/api/study/data`)
}

export function fetchStudyHistory(): Promise<StudyHistoryResponse> {
  return fetchJSON<StudyHistoryResponse>(`/api/study/history`)
}

export function submitStudyAnswer(question: string, answer: string, sourceNote: string, answerType: string): Promise<{ success: boolean; path?: string; error?: string }> {
  return fetch(`/api/study/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, sourceNote, answerType }),
  }).then(r => r.json())
}

// Flow Study: request agent feedback
export function requestStudyFeedback(session: {
  sessionId: string
  total: number
  results: Array<{
    id: string
    type: string
    text: string
    concept: string | null
    answer?: string
    skipped: boolean
    score: string | null
  }>
}): Promise<{ success: boolean; path?: string; error?: string }> {
  return fetch(`/api/study/feedback-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  }).then(r => r.json())
}

export function submitSelfScore(params: {
  questionOrDoubt: string
  type: 'question' | 'doubt'
  score: 'correct' | 'partial' | 'incorrect'
  linkedConcept?: string | null
}): Promise<{ success: boolean; path?: string; error?: string }> {
  return fetch(`/api/study/self-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(r => r.json())
}

// --- Anki (fusionado con Estudio — mismo dominio) ---
export function fetchAnkiStats(): Promise<AnkiStats> {
  return fetchJSON<AnkiStats>(`/api/anki/stats`)
}
