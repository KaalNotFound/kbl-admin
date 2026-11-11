import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BehavioralDashboard from '../components/BehavioralDashboard'

import type { BlockAdherence, CurrentBlock, Streaks, WeeklySummary } from '../types'

// Mock at the api barrel boundary (ADR-026). BehavioralDashboard consumes the
// data through src/hooks/use-behavioral.ts, which imports every behavioral
// function from the barrel at module level — the factory provides all of them.
// Only the four fetchers used by the mounted hooks return fixtures.
vi.mock('../api', () => ({
  fetchBehavioralDaily: vi.fn(async () => ({})),
  fetchBehavioralWeekly: vi.fn(async (): Promise<WeeklySummary> => ({
    days: [
      {
        date: '2026-11-10',
        estudio_minutes: 60,
        infra_minutes: 30,
        descanso_minutes: 15,
        flex_minutes: 5,
        total_tool_calls: 0,
        block_violations: [],
      },
    ],
  })),
  fetchBehavioralBlocks: vi.fn(async (): Promise<BlockAdherence> => ({
    date: '2026-11-10',
    adherence_pct: 80,
    total_minutes: 110,
    violations: 0,
    breakdown: { estudio: { actual: 60, expected: 90 } },
    violation_details: [],
  })),
  fetchBehavioralStreaks: vi.fn(async (): Promise<Streaks> => ({
    current: 2,
    longest: 5,
    total_study_days: 10,
    last_study_date: '2026-11-10',
  })),
  fetchBehavioralTimeline: vi.fn(async () => ({ date: '2026-11-10', sessions: [] })),
  fetchCurrentBlock: vi.fn(async (): Promise<CurrentBlock> => ({ block: 'estudio', hour: 10 })),
  startBehavioralSession: vi.fn(async () => ({ success: true, session_id: 's1', started_at: '', block_type: 'estudio' })),
  endBehavioralSession: vi.fn(async () => ({ success: true, session_id: 's1', duration_minutes: 1, block_type: 'estudio' })),
  logBehavioralActivity: vi.fn(async () => ({ success: true, activity_id: 'a1' })),
}))

// React Query retries by default; disable it so a hiccup can't stall findBy*.
function renderWithQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('BehavioralDashboard mount', () => {
  it('renders the streak and weekly trend cards without crashing', async () => {
    renderWithQueryClient(<BehavioralDashboard />)
    expect(await screen.findByText('Racha de Estudio')).toBeTruthy()
    expect(screen.getByText('Tendencia Semanal')).toBeTruthy()
  })
})
