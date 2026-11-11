import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FinanzasWrapper from '../components/FinanzasWrapper'

// FinanzasWrapper's own contract is sub-tab routing: mount on Resumen and
// swap the visible dashboard on click. Children already have their own
// mount tests, so they are stubbed here.
vi.mock('../components/FinanzasDashboard', () => ({ default: () => <div data-testid="sub-finanzas" /> }))
vi.mock('../components/PatrimonioDashboard', () => ({ default: () => <div data-testid="sub-patrimonio" /> }))
vi.mock('../components/ComprasDashboard', () => ({ default: () => <div data-testid="sub-compras" /> }))
vi.mock('../components/FoodSoraDashboard', () => ({ default: () => <div data-testid="sub-food" /> }))

describe('FinanzasWrapper sub-tab routing', () => {
  it('mounts on the Resumen tab and switches on click', () => {
    render(<FinanzasWrapper />)
    expect(screen.getByTestId('sub-finanzas')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Patrimonio/ }))
    expect(screen.getByTestId('sub-patrimonio')).toBeTruthy()
    expect(screen.queryByTestId('sub-finanzas')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Food Sora/ }))
    expect(screen.getByTestId('sub-food')).toBeTruthy()
    expect(screen.queryByTestId('sub-patrimonio')).toBeNull()
  })
})
