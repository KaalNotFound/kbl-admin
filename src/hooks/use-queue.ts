import { useQuery } from '@tanstack/react-query'
import { fetchQueue } from '../api'

export function useQueue() {
  return useQuery({
    queryKey: ['queue'],
    queryFn: fetchQueue,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}
