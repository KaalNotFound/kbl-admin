// market.ts — dominio Market Data (ADR-026)
import { fetchJSON } from './client'
import type { MarketData } from '../types'

export function fetchMarketData(): Promise<MarketData> {
  return fetchJSON<MarketData>(`/api/market/data`)
}
