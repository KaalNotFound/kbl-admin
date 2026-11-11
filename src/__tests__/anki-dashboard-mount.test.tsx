import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AnkiDashboard from '../components/AnkiDashboard'

import type { AnkiStats } from '../types'

// Mock at the api barrel boundary (ADR-026): AnkiDashboard only needs
// fetchAnkiStats. The component also polls every 10s, which the mock absorbs.
vi.mock('../api', () => ({
  fetchAnkiStats: vi.fn(async (): Promise<AnkiStats> => ({
    reviewed: 5,
    due: 3,
    total: 100,
    streak: 4,
    connected: true,
    decks: [{ name: 'Default', total: 100, due: 3, studied: 20, pct: 20 }],
    history: [['2026-11-10', 5]],
  })),
}))

describe('AnkiDashboard mount', () => {
  it('renders the connected view with deck progress without crashing', async () => {
    render(<AnkiDashboard />)
    expect(await screen.findByText('Revisadas Hoy')).toBeTruthy()
    expect(screen.getByText('🗂️ Progreso por Mazo')).toBeTruthy()
  })
})
