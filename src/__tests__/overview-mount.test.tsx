import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Overview from '../components/Overview'

import type { Overview as OverviewData } from '../types'

// Mock at the api barrel boundary (ADR-026): Overview only needs fetchOverview.
vi.mock('../api', () => ({
  fetchOverview: vi.fn(async (): Promise<OverviewData> => ({
    health: 'good',
    health_issues: [],
    vault: {
      total_notes: 10,
      areas: { '02 - AREAS': { files: 5, note_count: 5 } },
      inbox_unclassified: 0,
      entity_catalog_entries: 3,
    },
    pipeline: { pending: 1, done: 2, failed: 0, total: 3 },
    sessions: { total: 4, last_session: null },
    thermal: [],
  })),
}))

describe('Overview mount', () => {
  it('renders the healthy banner and vault distribution without crashing', async () => {
    render(<Overview />)
    // Banner label is a stable mapping of the fixture health status.
    expect(await screen.findByText('✅ Sistema saludable')).toBeTruthy()
    expect(screen.getByText('Distribución por Área')).toBeTruthy()
  })
})
