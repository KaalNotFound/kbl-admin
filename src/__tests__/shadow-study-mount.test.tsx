import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ShadowStudy from '../components/ShadowStudy'

import type { StudyData } from '../types'

// Mock at the api barrel boundary (ADR-026). ShadowStudy imports six study
// and active-recall functions; the seed effect fires on mount because the
// fixture has cards, so every one of them must resolve. seedGuard (lib) is
// real pure logic and is intentionally not mocked.
vi.mock('../api', () => ({
  submitActiveRecall: vi.fn(async () => ({ success: true })),
  fetchActiveRecallStats: vi.fn(async () => ({
    totalQuestions: 1,
    totalReviews: 0,
    dueCount: 0,
    reviewedToday: 0,
    streak: 1,
    scores: { correct: 0, partial: 0, incorrect: 0 },
    lastUpdated: '2026-11-10',
  })),
  fetchActiveRecallAll: vi.fn(async () => ({ questions: [] })),
  seedActiveRecallQuestions: vi.fn(async () => ({ success: true, seeded: 0 })),
  requestStudyFeedback: vi.fn(async () => ({ success: true })),
  submitSelfScore: vi.fn(async () => ({ success: true })),
}))

const data: StudyData = {
  notes: [],
  concepts: [],
  questions: [
    {
      note: 'notas/logica.md',
      bloque: 1,
      question: '¿Qué es la recursividad?',
      linkedConcept: 'Recursión',
      linkedDefinition: 'Una función que se llama a sí misma.',
    },
  ],
  doubts: [],
}

describe('ShadowStudy mount', () => {
  it('renders the list mode with the fixture card without crashing', async () => {
    render(<ShadowStudy data={data} filter="all" />)
    // The card text from the fixture renders verbatim in list mode.
    expect(await screen.findByText('¿Qué es la recursividad?')).toBeTruthy()
    // Mode toggle is a stable static label.
    expect(screen.getByText('📋 Lista')).toBeTruthy()
  })
})
