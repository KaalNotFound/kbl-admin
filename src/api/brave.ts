// brave.ts — dominio Brave Tabs (ADR-026)
import { fetchJSON } from './client'
import type { BraveTab } from '../types'

export function fetchBraveTabs(): Promise<BraveTab[]> {
  return fetchJSON<BraveTab[]>(`/api/brave/tabs`)
}

export function activateBraveTab(id: string): Promise<{ success: boolean }> {
  return fetch(`/api/brave/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId: id }),
  }).then(r => r.json())
}
