import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PomodoroTimer from '../components/PomodoroTimer'

import type { PomodoroStatus } from '../types'

// Regression for issue observed 2026-11-10: PomodoroTimer crashed on mount
// (ReferenceError: useMemo is not defined + TDZ self-reference in the
// countdown memo), taking down the whole Study tab.
vi.mock('../api', () => ({
  fetchPomodoroStatus: vi.fn(async (): Promise<PomodoroStatus> => ({
    active: false,
    paused: false,
    phase: null,
    work_min: 25,
    break_min: 5,
    long_break_min: 15,
    sessions_before_long_break: 4,
    completed_sessions: 0,
    current_timer: null,
  })),
  startPomodoro: vi.fn(async () => ({ success: true })),
  stopPomodoro: vi.fn(async () => ({ success: true })),
  skipPomodoro: vi.fn(async () => ({ success: true })),
  pausePomodoro: vi.fn(async () => ({ success: true })),
  resumePomodoro: vi.fn(async () => ({ success: true })),
}))

describe('PomodoroTimer mount regression', () => {
  it('renders the idle state without crashing', async () => {
    render(<PomodoroTimer />)
    expect(await screen.findByText('INACTIVO')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('— — : — —')).toBeTruthy()
    })
  })
})
