import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from '../components/layout/Sidebar'

// Demo state guard: the Referencias group must not expose the Navegador
// (Brave CDP) or Conversaciones (WhatsApp) sections during the TFM demo
// window. These capabilities remain available server-side behind the
// API key; only their dashboard sections are removed. Revisit after the
// defense (restore via git history).
vi.mock('../stores/app-store', () => ({
  useAppStore: () => ({
    tab: 'overview',
    setTab: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}))

describe('Referencias group (demo state)', () => {
  it('does not render Navegador or Conversaciones entries', () => {
    render(<Sidebar />)
    expect(screen.queryByText('Navegador')).toBeNull()
    expect(screen.queryByText('Conversaciones')).toBeNull()
  })
})
