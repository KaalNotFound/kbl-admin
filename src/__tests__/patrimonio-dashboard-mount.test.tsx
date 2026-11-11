import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PatrimonioDashboard from '../components/PatrimonioDashboard'

import type { PatrimonioData } from '../types'

// Mock at the api barrel boundary (ADR-026): PatrimonioDashboard only needs
// fetchPatrimonio. AnimatedNumber and SkeletonFin children stay unmocked;
// recharts degrades gracefully without ResizeObserver in jsdom.
vi.mock('../api', () => ({
  fetchPatrimonio: vi.fn(async (): Promise<PatrimonioData> => ({
    assets: [
      { tipo: 'inmueble', nombre: 'Depto', valor: 100000, ingreso_generado: 0, fecha: '2026-01-01' },
    ],
    total_activos: 100000,
    ingresos_pasivos: 500,
    asset_allocation: [{ tipo: 'inmueble', total: 100000, pct: 100 }],
    income_sources: [],
    total_income_extra: 0,
    income_breakdown: {},
    perfil_ingresos: [{ fuente: 'Sueldo', monto: 1000, tipo: 'fijo' }],
    pasivos_mensuales: 200,
    net_worth: 99800,
  })),
}))

describe('PatrimonioDashboard mount', () => {
  it('renders the asset and summary sections without crashing', async () => {
    render(<PatrimonioDashboard />)
    expect(await screen.findByText('Resumen patrimonial')).toBeTruthy()
    // The Activos heading is unique (other "activos" texts are not headings).
    expect(screen.getByRole('heading', { name: 'Activos' })).toBeTruthy()
  })
})
