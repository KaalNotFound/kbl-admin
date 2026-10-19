// search.ts — Global search (TopBar palette, "Buscar... Ctrl+K")
// Consumes GET /api/global-search — grouped cross-domain results where every
// item carries a `tab` field for navigation (server/detail contract in
// server/application/use-cases/global-search.js).
import { fetchJSON } from './client'

export interface GlobalSearchItem {
  title: string
  tab: string
  kind?: string
  path?: string
  snippet?: string
  meta?: string
}

export interface GlobalSearchGroup {
  type: string
  label: string
  items: GlobalSearchItem[]
}

export interface GlobalSearchResponse {
  query: string
  total: number
  groups: GlobalSearchGroup[]
}

export function fetchGlobalSearch(q: string): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams()
  params.set('q', q)
  return fetchJSON<GlobalSearchResponse>(`/api/global-search?${params}`)
}
