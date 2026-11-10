import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BraveTabs from '../components/BraveTabs'

// Mock at the api barrel boundary (ADR-026): BraveTabs polls fetchBraveTabs and
// activates tabs; we only exercise the initial poll in this mount guard.
vi.mock('../api', () => ({
  fetchBraveTabs: vi.fn(async () => [
    {
      id: 'tab-1',
      title: 'Obsidian — Diario',
      url: 'https://obsidian.md/Vault/Diario',
      active: false,
      type: 'page',
      last_accessed: '2026-11-10T07:30:00Z',
    },
  ]),
  activateBraveTab: vi.fn(async () => ({ success: true })),
}))

describe('BraveTabs mount', () => {
  it('leaves the loading skeleton and renders the fetched tab cards', async () => {
    render(<BraveTabs />)
    // The card button exposes the tab title as its accessible name.
    expect(
      await screen.findByRole('button', { name: /Obsidian — Diario/ }),
    ).toBeTruthy()
    expect(screen.getByText(/pestañas abiertas/)).toBeTruthy()
  })
})
