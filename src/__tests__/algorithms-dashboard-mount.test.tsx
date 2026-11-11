import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AlgorithmsDashboard from '../components/AlgorithmsDashboard'

// No api boundary here: the dashboard is a pill switcher over the shared
// SortVisualizer, fed by the pure algorithm modules (engine + meta only).
describe('AlgorithmsDashboard mount', () => {
  it('renders the bubble sorter shell without crashing', () => {
    render(<AlgorithmsDashboard />)
    // Default algorithm is bubble: its pill label comes from the static meta.
    // The button renders icon + label as sibling text nodes, so match loosely.
    expect(screen.getByText(/Bubble Sort/)).toBeTruthy()
    // Shared visualizer input, wired through the htmlFor label.
    expect(screen.getByLabelText('Array a ordenar')).toBeTruthy()
  })
})
