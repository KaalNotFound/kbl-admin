import { useQuery } from '@tanstack/react-query'
import { fetchMarketData } from '../api'

export function useMarketData() {
  return useQuery({
    queryKey: ['market'],
    queryFn: fetchMarketData,
    staleTime: 300_000,
  })
}
