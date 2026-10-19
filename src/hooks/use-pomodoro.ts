import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPomodoroStatus, startPomodoro, stopPomodoro, skipPomodoro, pausePomodoro, resumePomodoro } from '../api'

export function usePomodoroStatus() {
  return useQuery({
    queryKey: ['pomodoro'],
    queryFn: fetchPomodoroStatus,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.active && !data?.paused ? 1000 : 30_000
    },
    staleTime: 5000,
  })
}

export function useStartPomodoro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workMin, breakMin }: { workMin: number; breakMin: number }) =>
      startPomodoro(workMin, breakMin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pomodoro'] }),
  })
}

export function useStopPomodoro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: stopPomodoro,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pomodoro'] }),
  })
}

export function useSkipPomodoro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: skipPomodoro,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pomodoro'] }),
  })
}

export function usePausePomodoro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: pausePomodoro,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pomodoro'] }),
  })
}

export function useResumePomodoro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resumePomodoro,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pomodoro'] }),
  })
}
