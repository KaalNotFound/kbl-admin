// Modal semantics + focus management (issue #4 C4.1/C4.2/C4.3).
// RED drivers for: role="dialog" + aria-modal + aria-labelledby, container
// scoped Escape, focus restore to the opener, Tab trap, accessible names on
// icon-only buttons, and sr-only <label> wiring on Compras search controls.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuickCapture from '../components/QuickCapture'
import InventoryDashboard from '../components/InventoryDashboard'
import ComprasDashboard from '../components/ComprasDashboard'

// jsdom has no server: every dashboard here fetches on mount. fetchJSON only
// touches { ok, json } on the response, so a tiny route table is enough.
function stubFetch(routes: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    const key = Object.keys(routes).find(k => (url as string).includes(k))
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(key ? routes[key] : {}),
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('QuickCapture modal (APG dialog pattern)', () => {
  it('FAB exposes an accessible name (icon-only button)', () => {
    stubFetch({ '/api/entity-catalog': [] })
    render(<QuickCapture />)
    expect(screen.getByRole('button', { name: 'Captura rápida' })).toBeDefined()
  })

  it('opens a dialog with role=dialog + aria-modal + labelled title', async () => {
    const user = userEvent.setup()
    stubFetch({ '/api/entity-catalog': [] })
    render(<QuickCapture />)
    await user.click(screen.getByRole('button', { name: 'Captura rápida' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)).not.toBeNull()
  })

  it('Escape closes from any focus inside and returns focus to the FAB', async () => {
    const user = userEvent.setup()
    stubFetch({ '/api/entity-catalog': [] })
    render(<QuickCapture />)
    const fab = screen.getByRole('button', { name: 'Captura rápida' })
    await user.click(fab)
    // Focus somewhere that is NOT the textarea (which owns its own legacy
    // Escape handler): the close button. Container-level Escape must fire.
    screen.getByRole('button', { name: 'Cerrar' }).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(fab)
  })

  it('Tab cycles inside the dialog (trap wraps at the start)', async () => {
    const user = userEvent.setup()
    stubFetch({ '/api/entity-catalog': [] })
    render(<QuickCapture />)
    await user.click(screen.getByRole('button', { name: 'Captura rápida' }))
    const dialog = screen.getByRole('dialog')
    // Open state puts focus on the textarea (first-input focus), then move to
    // the first focusable: Shift+Tab from it must wrap to the last one.
    screen.getByRole('button', { name: 'Cerrar' }).focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    const focusables = dialog.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    expect(document.activeElement).toBe(focusables[focusables.length - 1])
  })

  it('structured compra fields are labelled via sr-only labels', async () => {
    const user = userEvent.setup()
    stubFetch({ '/api/entity-catalog': [] })
    render(<QuickCapture />)
    await user.click(screen.getByRole('button', { name: 'Captura rápida' }))
    await user.click(screen.getByRole('button', { name: /Sin clasificar/ }))
    await user.click(screen.getByRole('button', { name: /Compra/ }))
    expect(screen.getByLabelText('Comercio')).toBeDefined()
    expect(screen.getByLabelText('Precio')).toBeDefined()
    expect(screen.getByLabelText('Categoría')).toBeDefined()
  })
})

describe('InventoryDashboard add-item modal', () => {
  it('close ✕ has an accessible name; Escape closes and restores focus', async () => {
    const user = userEvent.setup()
    stubFetch({
      '/api/inventory': {
        items: [],
        summary: { total_items: 0, categories: {}, expiring_soon: 0, low_stock_items: 0, last_updated: '' },
      },
    })
    render(<InventoryDashboard />)
    const opener = await screen.findByRole('button', { name: '+ Agregar Item' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const close = screen.getByRole('button', { name: 'Cerrar' })
    close.focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})

describe('ComprasDashboard search controls', () => {
  it('search input and store select are labelled (sr-only)', async () => {
    stubFetch({
      '/api/summary': {
        month: '2026-11', total: 100, daily_avg: 5, tickets: 2, items: 3,
        last_month_total: 80, change_percent: null, daily_spending: [],
        top_categories: [], store_stats: [{ name: 'Chango', total: 100, visits: 2 }],
      },
      '/api/insights': { hormiga: [], top_expensive: [], preocupaciones: [], recurrencias: [] },
    })
    render(<ComprasDashboard month="2026-11" />)
    expect(await screen.findByLabelText('Buscar productos')).toBeDefined()
    expect(screen.getByLabelText('Filtrar por comercio')).toBeDefined()
  })
})
