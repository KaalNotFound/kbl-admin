import { useQuery } from '@tanstack/react-query'
import { fetchStudyData, fetchStudyHistory, fetchActiveRecallDue, fetchActiveRecallStats, fetchActiveRecallAll } from '../api'

export function useStudyData() {
  return useQuery({
    queryKey: ['study', 'data'],
    queryFn: fetchStudyData,
    staleTime: 30_000,
  })
}

export function useStudyHistory() {
  return useQuery({
    queryKey: ['study', 'history'],
    queryFn: fetchStudyHistory,
    staleTime: 30_000,
  })
}

export function useActiveRecallDue() {
  return useQuery({
    queryKey: ['active-recall', 'due'],
    queryFn: fetchActiveRecallDue,
    staleTime: 15_000,
  })
}

export function useActiveRecallStats() {
  return useQuery({
    queryKey: ['active-recall', 'stats'],
    queryFn: fetchActiveRecallStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useActiveRecallAll() {
  return useQuery({
    queryKey: ['active-recall', 'all'],
    queryFn: fetchActiveRecallAll,
    staleTime: 30_000,
  })
}
