import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import VaultDoctorDashboard from '../components/VaultDoctorDashboard'

import type { VaultDoctorResponse } from '../types'

// Mock at the api barrel boundary (ADR-026): VaultDoctorDashboard only needs
// fetchVaultDoctor. SkeletonFin children are cheap and stay unmocked.
vi.mock('../api', () => ({
  fetchVaultDoctor: vi.fn(async (): Promise<VaultDoctorResponse> => ({
    ok: true,
    scanned: { compras: 2, food_sora: 1, assets: 1, wallet: 1 },
    findings: [
      {
        file: 'compras/2026-11.md',
        line: 3,
        kind: 'missing_field',
        severity: 'error',
        field: 'precio',
        message: 'Falta el campo precio',
        obsidian_url: 'obsidian://open?path=/vault/compras/2026-11.md',
      },
    ],
    diagnostics: { initialized: true, initFailed: false, sources: { compras: 'ok:2' } },
  })),
}))

describe('VaultDoctorDashboard mount', () => {
  it('renders the audit body with findings and runtime diagnostics', async () => {
    render(<VaultDoctorDashboard />)
    // The body carries a stable testid on the data view.
    expect(await screen.findByTestId('vault-doctor-body')).toBeTruthy()
    expect(screen.getByText('Estado de fuentes en runtime')).toBeTruthy()
  })
})
