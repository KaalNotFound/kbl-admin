// notebooklm.ts — dominio NotebookLM Proxy (ADR-026)
import { fetchJSON } from './client'
import type {
  NotebookLMHealth,
  NotebookLMAskResponse,
  NotebookLMNotebook,
} from '../types'

export function fetchNotebookLMHealth(): Promise<{ success: boolean; data: NotebookLMHealth }> {
  return fetchJSON(`/api/notebooklm/health`)
}

export function askNotebookLM(params: {
  question: string
  notebook_id?: string
  session_id?: string
  source_format?: string
}): Promise<{ success: boolean; data: NotebookLMAskResponse }> {
  return fetch(`/api/notebooklm/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(r => r.json())
}

export function fetchNotebookLMNotebooks(): Promise<{ success: boolean; data: { notebooks: NotebookLMNotebook[] } }> {
  return fetchJSON(`/api/notebooklm/notebooks`)
}

export function createNotebookLMNotebook(params: {
  url: string
  name: string
  description?: string
  topics?: string[]
}): Promise<{ success: boolean }> {
  return fetch(`/api/notebooklm/notebooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).then(r => r.json())
}
