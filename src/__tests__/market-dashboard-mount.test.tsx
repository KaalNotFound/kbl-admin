import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MarketDashboard from '../components/MarketDashboard'

import type { MarketData } from '../types'

// Mock at the api barrel boundary (ADR-026): MarketDashboard only needs
// fetchMarketData. Fixture is inlined in the factory because vi.mock hoists
// above top-level consts.
vi.mock('../api', () => ({
  fetchMarketData: vi.fn(async (): Promise<MarketData> => ({
    trends: [
      { title: 'Tendencia', detail: 'Detalle', source: 'fuente', priority: 'alta' },
    ],
    ceo_quotes: [{ quote: 'Frase', person: 'CEO', date: '2026-11-10' }],
    recommendations: [{ skill: 'Skill', focus: 'Focus', porque: 'Porque' }],
    motivational_phrases: ['Frase uno', 'Frase dos'],
    last_updated: '2026-11-10',
  })),
}))

describe('MarketDashboard mount', () => {
  it('renders the data view with tab bar and footer without crashing', async () => {
    render(<MarketDashboard />)
    // The full tab label lives in one span (the first token repeats in a
    // second responsive span, but only the full one matches this string).
    expect(await screen.findByText('📈 Tendencias')).toBeTruthy()
    // Footer is a static fragment + interpolated date: match the stable part.
    expect(screen.getByText(/Datos curados manualmente/)).toBeTruthy()
  })
})
