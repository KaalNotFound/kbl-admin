import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SessionContext from '../components/SessionContext'

import type { SessionContextData } from '../types'

// Mock at the api barrel boundary (ADR-026): SessionContext only needs
// fetchSessionContext. `sources` is omitted so the provenance chips stay out.
vi.mock('../api', () => ({
  fetchSessionContext: vi.fn(async (): Promise<SessionContextData> => ({
    pendientes: [
      {
        title: 'Pendiente',
        priority: 'Alta',
        status: 'Pendiente',
        project: 'KBL',
        what: 'Descripción',
      },
    ],
    roadmap: { current: 'Fase actual', pending: [], completed: [] },
    checkpoints: [
      { date: '2026-11-10', file: 'checkpoint.md', summary: 'Resumen', lines: 12 },
    ],
  })),
}))

describe('SessionContext mount', () => {
  it('renders the roadmap and checkpoint sections without crashing', async () => {
    render(<SessionContext />)
    expect(await screen.findByText('Últimos Checkpoints')).toBeTruthy()
    // Priority filter chips are stable static labels.
    expect(screen.getByText('Todas')).toBeTruthy()
  })
})
