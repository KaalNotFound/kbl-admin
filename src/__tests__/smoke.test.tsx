// Smoke harness proof (issue #4 C1): RTL renders real components under jsdom
// with zero server. Presentational surface only — no fetch on mount.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PseudoCodePanel from '../components/algorithms/PseudoCodePanel'
import SortVisualizer from '../components/algorithms/SortVisualizer'
import { MERGE_META } from '../algorithms/merge'

describe('RTL harness (jsdom) — smoke', () => {
  it('renders a presentational panel without any server', () => {
    render(<PseudoCodePanel pseudocode={MERGE_META.pseudocode} activeIndex={null} />)
    expect(screen.getByText('Punto de ejecución')).toBeDefined()
    expect(screen.getByText(/for width in 1, 2, 4/)).toBeDefined()
  })

  it('SortVisualizer input screen accepts a seed array and renders frames', async () => {
    const user = userEvent.setup()
    render(<SortVisualizer meta={MERGE_META} />)
    const input = screen.getByLabelText('Array a ordenar')
    await user.clear(input)
    await user.type(input, '2, 1, 4')
    await user.click(screen.getByRole('button', { name: 'Generar' }))
    // The merge engine's own test asserts the frame data; here we only prove
    // the visual shell renders bars for the new seed (index labels 0..2).
    expect(screen.getByText('Visualización')).toBeDefined()
    expect(screen.getByText(/paso 0\//)).toBeDefined()
  })
})
