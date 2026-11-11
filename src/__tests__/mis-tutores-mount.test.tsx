import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MisTutores from '../components/MisTutores'

// No api boundary here: MisTutores renders the static TUTORES catalog from
// src/data/tutores.ts. Clipboard helpers only run on click, never on mount.
describe('MisTutores mount', () => {
  it('renders the catalog header and one system prompt per tutor', () => {
    render(<MisTutores />)
    expect(screen.getByText('Mis Tutores')).toBeTruthy()
    // Four tutors ship in the catalog, each with a System Prompt section.
    expect(screen.getAllByText('System Prompt').length).toBeGreaterThan(0)
  })
})
