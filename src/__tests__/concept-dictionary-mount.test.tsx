import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConceptDictionary from '../components/ConceptDictionary'
import type { StudyData } from '../types'

// Mock at the api barrel boundary (ADR-026): ConceptDictionary reads the SM-2
// store on mount and submits scores; neither endpoint is exercised in this
// mount guard, both just resolve cleanly.
vi.mock('../api', () => ({
  fetchActiveRecallAll: vi.fn(async () => ({ questions: [] })),
  submitActiveRecall: vi.fn(async () => ({
    success: true,
    item: {
      id: 'q-1',
      question: 'x',
      type: 'concept',
      concept: null,
      definition: null,
      sourceNote: null,
      sourceBloque: 0,
      createdAt: '2026-11-10T00:00:00Z',
      lastReview: null,
      reviewCount: 0,
      lastScore: null,
      interval: 0,
      nextReview: '2026-11-11T00:00:00Z',
      due: false,
    },
  })),
}))

const conceptsData: StudyData = {
  notes: [],
  concepts: [
    {
      note: 'Algoritmos.md',
      bloque: 3,
      concepto: 'Recursión',
      analogia: 'Un espejo frente a otro espejo',
      definicion: 'Función que se llama a sí misma',
    },
    {
      note: 'Algoritmos.md',
      bloque: 4,
      concepto: 'Notación O grande',
      analogia: 'Medir el tiempo según cantidad de invitados',
      definicion: '',
    },
  ],
  questions: [],
  doubts: [],
}

describe('ConceptDictionary mount', () => {
  it('renders dictionary entries and the mode toggle without crashing', async () => {
    render(<ConceptDictionary data={conceptsData} search="" />)
    expect(await screen.findByText('Recursión')).toBeTruthy()
    // Dictionary mode shows the definition right away.
    expect(screen.getByText('Función que se llama a sí misma')).toBeTruthy()
    expect(screen.getByText('Notación O grande')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Diccionario/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Repaso/ })).toBeTruthy()
  })
})
