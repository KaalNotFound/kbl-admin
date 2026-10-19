import { useQuery } from '@tanstack/react-query'
import { fetchSessionContext } from '../api'

export function useSessionContext() {
  return useQuery({
    queryKey: ['context'],
    queryFn: fetchSessionContext,
    staleTime: 60_000,
  })
}
