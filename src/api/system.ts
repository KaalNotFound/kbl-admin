// system.ts — dominio Sistema (Logs + Seen) (ADR-026)
import { fetchJSON } from './client'
import type { LogsResponse, SeenResponse } from '../types'

export function fetchLogs(): Promise<LogsResponse> {
  return fetchJSON<LogsResponse>(`/api/logs`)
}

export function fetchSeen(): Promise<SeenResponse> {
  return fetchJSON<SeenResponse>(`/api/seen`)
}
