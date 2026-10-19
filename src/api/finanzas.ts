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

export function fetchFinanzas(): Promise<FinanzasData> {
  return fetchJSON<FinanzasData>(`/api/finanzas`)
}

export function fetchPatrimonio(): Promise<PatrimonioData> {
  return fetchJSON<PatrimonioData>(`/api/patrimonio`)
}

export function fetchSummary(month: string): Promise<Summary> {
  return fetchJSON<Summary>(`/api/summary?month=${month}`)
}

export function fetchInsights(month?: string): Promise<Insights> {
  return fetchJSON<Insights>(`/api/insights${month ? `?month=${month}` : ''}`)
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
