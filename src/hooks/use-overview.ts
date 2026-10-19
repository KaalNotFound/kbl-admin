import { useQuery } from '@tanstack/react-query'
import { fetchOverview } from '../api'

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}
