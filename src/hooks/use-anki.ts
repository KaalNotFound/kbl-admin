import { useQuery } from '@tanstack/react-query'
import { fetchAnkiStats } from '../api'

export function useAnkiStats() {
  return useQuery({
    queryKey: ['anki'],
    queryFn: fetchAnkiStats,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
