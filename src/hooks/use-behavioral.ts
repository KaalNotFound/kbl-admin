import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchBehavioralDaily, fetchBehavioralWeekly, fetchBehavioralBlocks,
  fetchBehavioralStreaks, fetchBehavioralTimeline, fetchCurrentBlock,
  startBehavioralSession, endBehavioralSession, logBehavioralActivity,
} from '../api'

export function useBehavioralDaily(date?: string) {
  return useQuery({
    queryKey: ['behavioral', 'daily', date],
    queryFn: () => fetchBehavioralDaily(date),
    staleTime: 30_000,
  })
}

export function useBehavioralWeekly() {
  return useQuery({
    queryKey: ['behavioral', 'weekly'],
    queryFn: fetchBehavioralWeekly,
    staleTime: 30_000,
  })
}

export function useBehavioralBlocks(date?: string) {
  return useQuery({
    queryKey: ['behavioral', 'blocks', date],
    queryFn: () => fetchBehavioralBlocks(date),
    staleTime: 30_000,
  })
}

export function useBehavioralStreaks() {
  return useQuery({
    queryKey: ['behavioral', 'streaks'],
    queryFn: fetchBehavioralStreaks,
    staleTime: 60_000,
  })
}

export function useBehavioralTimeline(date?: string) {
  return useQuery({
    queryKey: ['behavioral', 'timeline', date],
    queryFn: () => fetchBehavioralTimeline(date),
    staleTime: 30_000,
  })
}

export function useCurrentBlock() {
  return useQuery({
    queryKey: ['behavioral', 'current-block'],
    queryFn: fetchCurrentBlock,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useStartBehavioralSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: startBehavioralSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['behavioral'] }),
  })
}

export function useEndBehavioralSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endBehavioralSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['behavioral'] }),
  })
}

export function useLogBehavioralActivity() {
  return useMutation({
    mutationFn: ({ sessionId, ...params }: { sessionId: string; type: string; target?: string; tool_calls?: number }) =>
      logBehavioralActivity(sessionId, params),
  })
}
