import { useQuery } from '@tanstack/react-query'
import { fetchEntityTypes } from '../api'

export function useEntityTypes() {
  return useQuery({
    queryKey: ['entity-types'],
    queryFn: fetchEntityTypes,
    staleTime: 120_000,
  })
}
