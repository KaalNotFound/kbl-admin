// finanzas.ts — dominio Finanzas Personales (ADR-026)
import { fetchJSON } from './client'
import type {
  FinanzasData,
  PatrimonioData,
  Summary,
  Insights,
  FoodSoraDay,
  FoodSoraStats,
  CompareData,
} from '../types'

export function fetchFinanzas(signal?: AbortSignal): Promise<FinanzasData> {
  return fetchJSON<FinanzasData>(`/api/finanzas`, signal)
}

export function fetchPatrimonio(signal?: AbortSignal): Promise<PatrimonioData> {
  return fetchJSON<PatrimonioData>(`/api/patrimonio`, signal)
}

export function fetchSummary(month: string, signal?: AbortSignal): Promise<Summary> {
  return fetchJSON<Summary>(`/api/summary?month=${month}`, signal)
}

export function fetchInsights(month?: string, signal?: AbortSignal): Promise<Insights> {
  return fetchJSON<Insights>(`/api/insights${month ? `?month=${month}` : ''}`, signal)
}

export function fetchFoodSora(): Promise<FoodSoraDay[]> {
  return fetchJSON<FoodSoraDay[]>(`/api/food-sora`)
}

export function fetchFoodSoraStats(): Promise<FoodSoraStats> {
  return fetchJSON<FoodSoraStats>(`/api/food-sora/stats`)
}

export function searchItems(q: string, store: string): Promise<{ results: any[]; stores: string[] }> {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (store) params.set('store', store)
  return fetchJSON(`/api/search?${params}`)
}

export function fetchCompare(q: string): Promise<CompareData> {
  return fetchJSON<CompareData>(`/api/compare?q=${encodeURIComponent(q)}`)
}
