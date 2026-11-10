import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompareView from '../components/CompareView'

// Mock at the api barrel boundary (ADR-026): CompareView only needs fetchCompare.
// Fixture is inlined in the factory because vi.mock hoists above top-level consts.
vi.mock('../api', () => ({
  fetchCompare: vi.fn(async () => ({
    query: 'banana',
    comparison: [
      {
        producto: 'Bananas',
        categoria: 'Frutas',
        precios: [{ comercio: 'Coto', precio: 950, fecha: '2026-11-10' }],
        precios_mercado: null,
        min_price: 950,
        avg_price: 950,
      },
    ],
    stores: ['Coto'],
    summary: { total_products: 1, total_entries: 1, avg_price_all: 950, min_price_all: 950, max_price_all: 950 },
  })),
}))

describe('CompareView mount', () => {
  it('renders the idle search shell without crashing', () => {
    render(<CompareView />)
    expect(screen.getByText('Comparar precios entre comercios')).toBeTruthy()
    expect(screen.getByPlaceholderText(/fideos, pan, leche, arroz/)).toBeTruthy()
  })

  it('searches through the debounced api call and renders the results table', async () => {
    const user = userEvent.setup()
    render(<CompareView />)
    await user.type(screen.getByPlaceholderText(/fideos, pan, leche, arroz/), 'banana')
    // 400ms debounce + api resolution must land inside the findBy timeout.
    expect(await screen.findByText('Bananas', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeTruthy()
  })
})
